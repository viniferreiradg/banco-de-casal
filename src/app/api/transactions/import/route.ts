import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { applySplitRules, applyCategoryRules } from "@/lib/split-engine";
import { PRIMARY_CATEGORY_RULES } from "@/lib/primary-rules";
import { resolveBillingMonth } from "@/lib/billing-month";

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && line.startsWith(sep, i)) {
      result.push(current.trim());
      current = "";
      i += sep.length - 1;
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(headerLine: string): string {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  for (const sep of Object.keys(counts)) {
    counts[sep] = (headerLine.match(new RegExp(sep === "|" ? "\\|" : sep, "g")) ?? []).length;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  // Brazilian format: "1.234,56"
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  // Only comma: "1234,56"
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(",", "."));
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Derive a default category from description when the CSV has no category column (e.g. Nubank debit)
function inferCategory(description: string): string | null {
  const d = description.toLowerCase();
  if (d.startsWith("transferência enviada pelo pix") || d.startsWith("transferencia enviada pelo pix")) return "Pix enviado";
  if (d.startsWith("pagamento de boleto")) return "Boleto";
  return null;
}

// Extract a short display name and optional installment notes from descriptions
function extractDisplayName(description: string): { customName: string; notes?: string } | null {
  // Installment: "NAME - Parcela X/Y" (Nubank credit, BB parcelado)
  const installmentMatch = description.match(/^(.+?)\s*-\s*(Parcela\s+(\d+)\/(\d+))\s*$/i);
  if (installmentMatch) {
    return { customName: installmentMatch[1].trim(), notes: installmentMatch[2].trim() };
  }
  const d = description.toLowerCase();
  // Pix: "Transferência enviada/recebida pelo Pix - NOME - ..."
  const pixMatch = description.match(
    /^transfer[eê]ncia\s+(enviada|recebida)[^-]*?-\s*(.+?)\s*(?:-\s*[•\d].*)?$/i
  );
  if (pixMatch) {
    return { customName: pixMatch[2].trim() };
  }
  // Boleto: "Pagamento de boleto efetuado - NOME"
  if (d.startsWith("pagamento de boleto")) {
    const boletoMatch = description.match(/pagamento de boleto[^-]*-\s*(.+)$/i);
    if (boletoMatch) return { customName: boletoMatch[1].trim() };
  }
  return null;
}

function cleanDescription(raw: string): string {
  // Remove BB timestamp prefix: "12/03 14:30 Descrição"
  const d = raw.replace(/^\d{2}\/\d{2}\s+\d{2}:\d{2}\s+/, "").trim();
  // Keep full description (Pix details, boleto, etc.) — display shortening is done client-side
  return d || raw;
}

function parseDate(raw: string): Date | null {
  // dd/MM/yyyy or dd-MM-yyyy
  const ddmmyyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  // yyyy-MM-dd or yyyy/MM/dd
  const yyyymmdd = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ddmmyyyy) {
    const d = new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  if (yyyymmdd) {
    const d = new Date(Number(yyyymmdd[1]), Number(yyyymmdd[2]) - 1, Number(yyyymmdd[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// POST /api/transactions/import — import CSV from bank statement
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bankConnectionId = formData.get("bankConnectionId") as string | null;
  const checkOnly = formData.get("checkOnly") === "true";
  const skipDuplicates = formData.get("skipDuplicates") !== "false"; // default: skip

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
              splitRules: { where: { isActive: true } },
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

  // Decode file — try UTF-8, fall back to windows-1252 (common in Brazilian bank exports)
  const bytes = await file.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }

  const rawLines = text.split(/\r?\n/).filter((l) => l.trim());
  if (rawLines.length < 2) {
    return NextResponse.json({ error: "CSV vazio ou sem dados" }, { status: 400 });
  }

  const sep = detectSeparator(rawLines[0]);
  const normHeaders = parseCsvLine(rawLines[0], sep).map(normalizeHeader);

  // Column detection
  const dateIdx = normHeaders.findIndex((h) => h === "data" || h === "date" || h.startsWith("data "));

  // Description: prefer "detalhe(s)", then "descri/hist/memo", then "title" (Nubank), fallback "lancamento" (not "tipo")
  let descIdx = normHeaders.findIndex((h) => h.includes("detalhe"));
  if (descIdx === -1) descIdx = normHeaders.findIndex((h) => h.includes("descri") || h.includes("hist") || h.includes("memo"));
  if (descIdx === -1) descIdx = normHeaders.findIndex((h) => h === "title" || h === "titulo" || h === "nome");
  if (descIdx === -1) descIdx = normHeaders.findIndex((h) => h.includes("lan") && !h.includes("tipo"));

  const amtIdx = normHeaders.findIndex((h) => h.includes("valor") || h.includes("amount") || h === "value");

  // Category: "lancamento" type column (e.g. "Compra com Cartão") or explicit "categ"
  let catIdx = normHeaders.findIndex((h) => h.includes("categ"));
  if (catIdx === -1) catIdx = normHeaders.findIndex((h) => h.includes("lan") && !h.includes("tipo") && h !== normHeaders[descIdx]);

  if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) {
    return NextResponse.json({
      error: `CSV não reconhecido. Colunas encontradas: ${normHeaders.join(", ")}. O arquivo precisa ter colunas de data, descrição e valor.`,
    }, { status: 400 });
  }

  const rules = bankConnection.user.couple?.splitRules ?? [];
  const categoryRules = bankConnection.user.couple?.categoryRules ?? [];
  const closingDay = bankConnection.user.couple?.closingDay ?? 5;
  const isCreditCard = bankConnection.isCreditCard ?? false;
  const ownerIsUser1 = bankConnection.user.couple
    ? bankConnection.user.id === bankConnection.user.couple.user1Id
    : true;

  // Detect "tipo" column (e.g. "Tipo Lançamento" in BB) for credit/debit detection
  const tipoIdx = normHeaders.findIndex((h) => h.includes("tipo"));

  // Nubank credit CSV: header uses "title" and amounts are positive for expenses, negative for payments
  const isNubankStyle = normHeaders.includes("title");

  // Keywords that indicate a non-expense row to skip
  const isPaymentRow = (desc: string) => {
    const n = normalizeHeader(desc);
    return (
      n.includes("pagamento recebido") ||       // Nubank crédito: credit received
      n.includes("pagamento de fatura") ||       // Nubank débito: credit card bill payment (would double-count)
      (n.includes("estorno") && n.includes("pagamento"))
    );
  };

  // Early incompatibility check: scan ALL raw amounts (before sign filtering) to detect
  // if this is a credit card CSV uploaded to a debit account (or vice versa)
  if (!isCreditCard && !isNubankStyle && tipoIdx === -1) {
    const rawAmounts: number[] = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCsvLine(rawLines[i], sep);
      if (cols.length <= amtIdx) continue;
      const amount = parseAmount(cols[amtIdx] ?? "");
      if (amount !== null && amount !== 0) rawAmounts.push(amount);
    }
    const allPositiveRaw = rawAmounts.length > 0 && rawAmounts.every((a) => a > 0);
    if (allPositiveRaw) {
      return NextResponse.json({
        error: "Este CSV parece ser de um cartão de crédito (todos os valores são positivos), mas a conta selecionada não está marcada como cartão de crédito. Selecione a conta correta ou edite a conta em Contas → marque como cartão de crédito.",
      }, { status: 400 });
    }
  }

  // Pre-scan: collect valid rows to know total before streaming
  type ValidRow = { rawDate: string; rawDescription: string; rawAmount: string; rawCategory: string };
  const validRows: ValidRow[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const cols = parseCsvLine(rawLines[i], sep);
    if (cols.length <= Math.max(dateIdx, descIdx, amtIdx)) continue;
    const rawDescription = cols[descIdx] ?? "";
    const rawAmount = cols[amtIdx] ?? "";
    const rawTipo = tipoIdx >= 0 ? normalizeHeader(cols[tipoIdx] ?? "") : "";
    // Check saldo in description AND in category/type column (e.g. BB's "S A L D O" is in lançamento col)
    const isSaldo = (txt: string) => { const n = normalizeHeader(txt); return n.includes("saldo") || n.replace(/\s/g, "") === "saldo"; };
    const rawCat = catIdx >= 0 ? (cols[catIdx] ?? "") : "";
    if (isSaldo(rawDescription) || isSaldo(rawCat)) continue;
    if (isPaymentRow(rawDescription)) continue;
    if (rawTipo === "entrada") continue;
    const amount = parseAmount(rawAmount);
    if (amount === null || amount === 0) continue;
    if (isNubankStyle || isCreditCard) {
      // Nubank / cartão de crédito: positivo = despesa, negativo = pagamento (já filtrado acima)
      if (amount < 0) continue;
    } else {
      // Débito (BB etc): negativo = despesa; sem coluna "tipo", pula positivos (receitas)
      if (tipoIdx === -1 && amount > 0) continue;
    }
    const rawDate = cols[dateIdx] ?? "";
    if (!parseDate(rawDate)) continue;
    validRows.push({ rawDate, rawDescription, rawAmount, rawCategory: rawCat });
  }

  const total = validRows.length;

  // Phase 1: checkOnly — count duplicates and return JSON (no streaming)
  if (checkOnly) {
    let duplicates = 0;
    for (const { rawDate, rawDescription, rawAmount } of validRows) {
      const date = parseDate(rawDate)!;
      const description = cleanDescription(rawDescription);
      const decimalAmount = new Decimal(Math.abs(parseAmount(rawAmount)!));
      const existing = await prisma.transaction.findFirst({
        where: { bankConnectionId, ownerUserId: user.id, date, description, amount: decimalAmount },
        select: { id: true },
      });
      if (existing) duplicates++;
    }
    return NextResponse.json({ total, duplicates });
  }

  // Phase 2: actual import (streaming)
  const encoder = new TextEncoder();
  let imported = 0;
  let skipped = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      send({ type: "total", total });

      for (let i = 0; i < validRows.length; i++) {
        const { rawDate, rawDescription, rawAmount, rawCategory } = validRows[i];
        const date = parseDate(rawDate)!;
        const amount = parseAmount(rawAmount)!;
        const description = cleanDescription(rawDescription);
        const rawCategoryFallback = rawCategory || inferCategory(description) || undefined;
        const displayName = extractDisplayName(description);
        const decimalAmount = new Decimal(Math.abs(amount));
        const billingMonth = resolveBillingMonth(date, isCreditCard, closingDay);

        // Resolve final category BEFORE split, so category-based rules can match correctly
        const resolvedCategory =
          applyCategoryRules(description, categoryRules) ??
          applyCategoryRules(description, PRIMARY_CATEGORY_RULES) ??
          rawCategoryFallback ??
          (isCreditCard ? "Crédito" : null);

        if (skipDuplicates) {
          const existing = await prisma.transaction.findFirst({
            where: { bankConnectionId, ownerUserId: user.id, date, description, amount: decimalAmount },
            select: { id: true },
          });
          if (existing) {
            skipped++;
            send({ type: "progress", processed: imported + skipped, total });
            continue;
          }
        }

        const split = applySplitRules(
          { description, category: resolvedCategory, amount: decimalAmount, accountType: bankConnection.accountType as "SHARED" | "PERSONAL", ownerIsUser1 },
          rules as Parameters<typeof applySplitRules>[1]
        );

        await prisma.transaction.create({
          data: {
            date, billingMonth, description, amount: decimalAmount,
            category: resolvedCategory,
            customName: displayName?.customName ?? null,
            notes: displayName?.notes ?? null,
            isShared: bankConnection.accountType === "SHARED",
            isCreditCard, bankConnectionId, ownerUserId: user.id,
            split: {
              create: {
                pctUser1: split.pctUser1, pctUser2: split.pctUser2,
                amountUser1: split.amountUser1, amountUser2: split.amountUser2,
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

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Transfer-Encoding": "chunked" } });
}
