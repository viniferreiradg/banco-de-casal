import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { applySplitRules } from "@/lib/split-engine";

interface CsvRow {
  date: string;
  description: string;
  amount: string;
  category?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseAmount(raw: string): number | null {
  // Handle Brazilian format: "1.234,56" or "-1.234,56" or "1234.56"
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  // If contains comma and dot: Brazilian format (1.234,56)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  // Only comma: 1234,56
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(",", "."));
  }
  return parseFloat(cleaned) || null;
}

// POST /api/transactions/import — import CSV from bank statement
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bankConnectionId = formData.get("bankConnectionId") as string | null;

  if (!file || !bankConnectionId) {
    return NextResponse.json({ error: "file e bankConnectionId são obrigatórios" }, { status: 400 });
  }

  const bankConnection = await prisma.bankConnection.findUnique({
    where: { id: bankConnectionId },
    include: {
      user: {
        include: {
          couple: { include: { splitRules: { where: { isActive: true } } } },
        },
      },
    },
  });

  if (!bankConnection || bankConnection.userId !== user.id) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV vazio ou sem dados" }, { status: 400 });
  }

  // Detect header
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("data") || h.includes("date"));
  const descIdx = headers.findIndex((h) => h.includes("descri") || h.includes("hist") || h.includes("memo"));
  const amtIdx = headers.findIndex((h) => h.includes("valor") || h.includes("amount") || h.includes("value"));
  const catIdx = headers.findIndex((h) => h.includes("categ"));

  if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) {
    return NextResponse.json({
      error: "CSV não reconhecido. O arquivo precisa ter colunas de data, descrição e valor.",
    }, { status: 400 });
  }

  const rules = bankConnection.user.couple?.splitRules ?? [];
  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 3) continue;

    const rawDate = cols[dateIdx];
    const description = cols[descIdx];
    const rawAmount = cols[amtIdx];
    const category = catIdx >= 0 ? cols[catIdx] : undefined;

    const amount = parseAmount(rawAmount);
    if (!amount || amount <= 0) { skipped++; continue; }

    // Parse date (try dd/MM/yyyy, yyyy-MM-dd, MM/dd/yyyy)
    let date: Date | null = null;
    const ddmmyyyy = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    const yyyymmdd = rawDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ddmmyyyy) {
      date = new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    } else if (yyyymmdd) {
      date = new Date(Number(yyyymmdd[1]), Number(yyyymmdd[2]) - 1, Number(yyyymmdd[3]));
    }
    if (!date || isNaN(date.getTime())) { skipped++; continue; }

    const decimalAmount = new Decimal(amount);
    const split = applySplitRules(
      {
        description,
        category: category ?? null,
        amount: decimalAmount,
        accountType: bankConnection.accountType as "SHARED" | "PERSONAL",
      },
      rules as Parameters<typeof applySplitRules>[1]
    );

    await prisma.transaction.create({
      data: {
        date,
        description,
        amount: decimalAmount,
        category: category || null,
        isShared: bankConnection.accountType === "SHARED",
        bankConnectionId,
        ownerUserId: user.id,
        split: {
          create: {
            pctUser1: split.pctUser1,
            pctUser2: split.pctUser2,
            amountUser1: split.amountUser1,
            amountUser2: split.amountUser2,
            appliedRuleId: split.appliedRuleId,
          },
        },
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
