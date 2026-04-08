// pdf-parse v2 uses a class-based API
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

export interface ItauParsedTransaction {
  date: string;           // yyyy-MM-dd
  description: string;
  amount: number;
  itauCategory: string | null;  // mapped category from PDF (e.g. "Restaurante")
  installmentNote: string | null; // e.g. "Parcela 3/4"
}

// Map Itaú PDF category words → app category names
const ITAU_CATEGORY_MAP: Record<string, string> = {
  supermercado: "Supermercado",
  restaurante:  "Restaurante",
  saude:        "Saúde",
  transporte:   "Transporte",
  educacao:     "Educação",
  vestuario:    "Vestuário",
  combustivel:  "Combustível",
  farmacia:     "Farmácia",
  servico:      "Serviços",
  turismo:      "Viagem",
  assinatura:   "Assinatura",
  streaming:    "Streaming",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function mapItauCategory(raw: string): string | null {
  const n = normalize(raw);
  for (const [key, val] of Object.entries(ITAU_CATEGORY_MAP)) {
    if (n.includes(key)) return val;
  }
  return null; // "outros" → null, so category rules can handle it
}

/**
 * Extracts installment notation from the end of a merchant name.
 * e.g. "GRUPO BM PZLAG 03/03" → { name: "GRUPO BM PZLAG", note: "Parcela 3/3" }
 * e.g. "CASSIA MODA E 03/04"  → { name: "CASSIA MODA E",  note: "Parcela 3/4" }
 * e.g. "ANGELONI SUPER LOJA"  → { name: "ANGELONI SUPER LOJA", note: null }
 */
function extractInstallment(desc: string): { name: string; note: string | null } {
  const installMatch = desc.match(/^(.+?)\s+(\d{1,2})\/(\d{1,2})\s*$/);
  if (installMatch) {
    const current = parseInt(installMatch[2]);
    const total   = parseInt(installMatch[3]);
    // Only treat as installment if total > 1 (avoid catching things like "02/03" dates)
    if (total > 1) {
      return {
        name: installMatch[1].trim(),
        note: `Parcela ${current}/${total}`,
      };
    }
  }
  return { name: desc.trim(), note: null };
}

/**
 * Parses an Itaú credit card PDF statement and returns structured transactions.
 */
export async function parseItauPdf(buffer: Buffer): Promise<ItauParsedTransaction[]> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const rawText: string = result.text;

  // ── 1. Detect statement closing date ──────────────────────────────────────
  // Looks for "Emissão: 02/03/2026" or "Postagem: 02/03/2026"
  const closingMatch = rawText.match(
    /(?:Emiss[aã]o|Postagem|Fechamento)[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i
  );
  const closingMonth = closingMatch ? parseInt(closingMatch[2]) : new Date().getMonth() + 1;
  const closingYear  = closingMatch ? parseInt(closingMatch[3]) : new Date().getFullYear();

  // Transactions from months "far ahead" of the closing month belong to the previous year.
  // e.g. closing = March 2026, transaction month = December → year = 2025
  function inferYear(month: number): number {
    if (month > closingMonth + 3) return closingYear - 1;
    return closingYear;
  }

  // ── 2. Parse lines ─────────────────────────────────────────────────────────
  const lines = rawText.split(/\n/).map((l) => l.trim());

  // Transaction line: DD/MM followed by merchant name and a Brazilian amount at the end
  // Handles installment notations like "GRUPO BM PZLAG 03/03 79,93"
  // Note: installment markers use "/" while amounts use "," — no ambiguity
  const TX_REGEX = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.]+,\d{2})\s*$/;

  // Category hint line: lowercase word(s) followed by a CITY in CAPS
  // e.g. "restaurante LAGUNA" or "supermercado SAO PAULO"
  const CAT_REGEX = /^([a-záêíóúçã\s\/]+)\s+[A-ZÁÊÍÓÚÇ]{2}/;

  // Words that signal non-transaction lines to skip
  const SKIP_PHRASES = [
    "pagamento via conta",
    "total dos pagamentos",
    "total dos lancamentos",
    "lancamentos no cartao",
    "lancamentos produtos e servicos",
    "proxima fatura",
    "demais faturas",
    "total para proximas",
  ];

  const transactions: ItauParsedTransaction[] = [];
  let stopImporting = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lineN = normalize(line);

    // Stop processing at "Compras parceladas - próximas faturas" section
    if (
      lineN.includes("proximas faturas") ||
      (lineN.includes("compras parceladas") && lineN.includes("proximas"))
    ) {
      stopImporting = true;
    }
    if (stopImporting) continue;

    // Skip known non-transaction lines
    if (SKIP_PHRASES.some((p) => lineN.includes(p))) continue;

    const match = line.match(TX_REGEX);
    if (!match) continue;

    const [, dayStr, monthStr, rawDesc, rawAmount] = match;
    const day   = parseInt(dayStr);
    const month = parseInt(monthStr);
    const year  = inferYear(month);

    // Skip credits / refunds (negative amounts are rare in this format since
    // Itaú PDFs show payments separately, but just in case)
    const amount = parseFloat(rawAmount.replace(/\./g, "").replace(",", "."));
    if (amount <= 0) continue;

    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Extract installment notation from merchant name
    const { name: description, note: installmentNote } = extractInstallment(rawDesc.trim());

    // Look at the next non-empty line for the category hint
    let itauCategory: string | null = null;
    const nextLine = lines.slice(i + 1, i + 3).find((l) => l.trim()) ?? "";
    const catMatch = nextLine.match(CAT_REGEX);
    if (catMatch) {
      itauCategory = mapItauCategory(catMatch[1].trim());
    }

    transactions.push({ date, description, amount, itauCategory, installmentNote });
  }

  return transactions;
}
