export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { applySplitRules, applyCategoryRules } from "@/lib/split-engine";
import { PRIMARY_CATEGORY_RULES } from "@/lib/primary-rules";
import { resolveBillingMonth } from "@/lib/billing-month";
import { parseItauPdf } from "@/lib/itau-pdf-parser";

// POST /api/transactions/import/pdf — import from Itaú PDF statement
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bankConnectionId = formData.get("bankConnectionId") as string | null;
  const checkOnly = formData.get("checkOnly") === "true";
  const skipDuplicates = formData.get("skipDuplicates") !== "false";

  if (!file || !bankConnectionId) {
    return NextResponse.json({ error: "file e bankConnectionId são obrigatórios" }, { status: 400 });
  }

  const bankConnection = await prisma.bankConnection.findUnique({
    where: { id: bankConnectionId },
    include: {
      user: {
        include: {
          couple: {
            include: {
              splitRules:    { where: { isActive: true } },
              categoryRules: { where: { isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!bankConnection || bankConnection.userId !== user.id) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  // Parse the PDF
  let parsed;
  try {
    const bytes = await file.arrayBuffer();
    parsed = await parseItauPdf(Buffer.from(bytes));
  } catch (err) {
    console.error("PDF parse error:", err);
    return NextResponse.json({ error: "Não foi possível ler o PDF. Verifique se é uma fatura Itaú válida." }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Nenhuma transação encontrada no PDF." }, { status: 400 });
  }

  const rules         = bankConnection.user.couple?.splitRules ?? [];
  const categoryRules = bankConnection.user.couple?.categoryRules ?? [];
  const closingDay    = bankConnection.user.couple?.closingDay ?? 5;
  const isCreditCard  = bankConnection.isCreditCard ?? true; // Itaú PDF is always a credit card
  const ownerIsUser1  = bankConnection.user.couple
    ? bankConnection.user.id === bankConnection.user.couple.user1Id
    : true;

  // Phase 1: checkOnly — count duplicates without importing
  if (checkOnly) {
    let duplicates = 0;
    for (const tx of parsed) {
      const date          = new Date(tx.date + "T12:00:00");
      const decimalAmount = new Decimal(tx.amount);
      const existing = await prisma.transaction.findFirst({
        where: { bankConnectionId, ownerUserId: user.id, date, description: tx.description, amount: decimalAmount },
        select: { id: true },
      });
      if (existing) duplicates++;
    }
    return NextResponse.json({ total: parsed.length, duplicates });
  }

  // Phase 2: actual import (streaming NDJSON)
  const encoder = new TextEncoder();
  let imported = 0;
  let skipped  = 0;
  const total  = parsed.length;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      send({ type: "total", total });

      for (const tx of parsed) {
        const date          = new Date(tx.date + "T12:00:00");
        const decimalAmount = new Decimal(tx.amount);
        const billingMonth  = resolveBillingMonth(date, isCreditCard, closingDay);

        if (skipDuplicates) {
          const existing = await prisma.transaction.findFirst({
            where: { bankConnectionId, ownerUserId: user.id, date, description: tx.description, amount: decimalAmount },
            select: { id: true },
          });
          if (existing) {
            skipped++;
            send({ type: "progress", processed: imported + skipped, total });
            continue;
          }
        }

        // Resolve category: user rules → primary rules → PDF category hint
        const resolvedCategory =
          applyCategoryRules(tx.description, categoryRules) ??
          applyCategoryRules(tx.description, PRIMARY_CATEGORY_RULES) ??
          tx.itauCategory ??
          "Crédito";

        const split = applySplitRules(
          {
            description: tx.description,
            category: resolvedCategory,
            amount: decimalAmount,
            accountType: bankConnection.accountType as "SHARED" | "PERSONAL",
            ownerIsUser1,
          },
          rules as Parameters<typeof applySplitRules>[1]
        );

        await prisma.transaction.create({
          data: {
            date,
            billingMonth,
            description:  tx.description,
            amount:       decimalAmount,
            category:     resolvedCategory,
            customName:   null,
            notes:        tx.installmentNote ?? null,
            isShared:     bankConnection.accountType === "SHARED",
            isCreditCard,
            bankConnectionId,
            ownerUserId:  user.id,
            split: {
              create: {
                pctUser1:      split.pctUser1,
                pctUser2:      split.pctUser2,
                amountUser1:   split.amountUser1,
                amountUser2:   split.amountUser2,
                appliedRuleId: split.appliedRuleId,
              },
            },
          },
        });

        imported++;
        send({ type: "progress", processed: imported + skipped, total });
      }

      send({ type: "done", imported, skipped });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Transfer-Encoding": "chunked" },
  });
}
