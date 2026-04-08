// Use pdfjs-dist directly for position-aware text extraction.
// pdf-parse v2 fragments words and merges two-column layouts — using raw item
// coordinates we can reconstruct clean lines regardless of PDF encoding.

import type { TextItem } from "pdfjs-dist/types/src/display/api";

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
};

export interface ItauParsedTransaction {
  date: string;               // yyyy-MM-dd
  description: string;
  amount: number;
  itauCategory: string | null;
  installmentNote: string | null; // e.g. "Parcela 3/4"
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function mapItauCategory(raw: string): string | null {
  const n = normalize(raw);
  for (const [key, val] of Object.entries(ITAU_CATEGORY_MAP)) {
    if (n.includes(key)) return val;
  }
  return null;
}

function extractInstallment(desc: string): { name: string; note: string | null } {
  const m = desc.match(/^(.+?)\s+(\d{1,2})\/(\d{1,2})\s*$/);
  if (m && parseInt(m[3]) > 1) {
    return { name: m[1].trim(), note: `Parcela ${m[2]}/${m[3]}` };
  }
  return { name: desc.trim(), note: null };
}

/**
 * Extracts all text items with their normalised y-position from a PDF page
 * using pdfjs-dist, then groups them into logical lines.
 *
 * Because we work with raw coordinates we can:
 *   1. Merge fragments that are horizontally adjacent (same word, spaced apart
 *      by the PDF font encoding — common in Itaú statements).
 *   2. Separate the two-column layout by sorting by x inside each row.
 */
async function extractLines(pdfjs: typeof import("pdfjs-dist"), data: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const allLines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp   = page.getViewport({ scale: 1.0 });
    const tc   = await page.getTextContent({ includeMarkedContent: false });

    // Collect items with coordinates
    type ItemPos = { text: string; x: number; y: number; endX: number };
    const items: ItemPos[] = [];

    for (const item of tc.items) {
      const ti = item as TextItem;
      if (!ti.str || !ti.str.trim()) continue;
      const x    = ti.transform[4];
      const y    = vp.height - ti.transform[5]; // flip: PDF y is bottom-up
      const endX = x + Math.abs(ti.width ?? 0);
      items.push({ text: ti.str, x, y, endX });
    }

    if (items.length === 0) continue;

    // Sort top-to-bottom, then left-to-right within a row
    items.sort((a, b) => {
      const dy = a.y - b.y;
      if (Math.abs(dy) > 2) return dy;
      return a.x - b.x;
    });

    // Group into rows (items whose y-coordinates differ by ≤ 2 units)
    const rows: ItemPos[][] = [];
    let currentRow: ItemPos[] = [items[0]];

    for (let i = 1; i < items.length; i++) {
      if (Math.abs(items[i].y - currentRow[0].y) <= 2) {
        currentRow.push(items[i]);
      } else {
        rows.push(currentRow);
        currentRow = [items[i]];
      }
    }
    rows.push(currentRow);

    // For each row, merge adjacent fragments into words then join with spaces
    for (const row of rows) {
      let line = "";
      let prevEndX = -Infinity;

      for (const item of row) {
        const gap = item.x - prevEndX;
        // Gap < 1 unit → same word fragment; add without space
        // Gap 1-6 units → tight but still the same word
        // Gap > 6 units → word boundary
        if (prevEndX === -Infinity) {
          line = item.text;
        } else if (gap <= 6) {
          line += item.text;
        } else {
          line += " " + item.text;
        }
        prevEndX = item.endX;
      }

      const trimmed = line.trim();
      if (trimmed) allLines.push(trimmed);
    }
  }

  return allLines;
}

export async function parseItauPdf(buffer: Buffer): Promise<ItauParsedTransaction[]> {
  // Dynamic import so Next.js build doesn't try to statically analyse pdfjs
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const lines = await extractLines(pdfjs, new Uint8Array(buffer));

  // ── 1. Detect closing year/month from the statement header ────────────────
  const fullText = lines.join(" ");
  const closingMatch = fullText.match(
    /(?:Emiss[aã]o|Postagem|Fechamento)[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i
  );
  const closingMonth = closingMatch ? parseInt(closingMatch[2]) : new Date().getMonth() + 1;
  const closingYear  = closingMatch ? parseInt(closingMatch[3]) : new Date().getFullYear();

  function inferYear(month: number): number {
    // e.g. closing = March 2026, transaction Dec → 2025
    if (month > closingMonth + 3) return closingYear - 1;
    return closingYear;
  }

  // ── 2. Parse transaction lines ─────────────────────────────────────────────
  // Pattern: DD/MM  MERCHANT NAME [XX/YY]  999,99
  const TX_REGEX = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.]+,\d{2})\s*$/;

  // Category hint: lowercase word(s) followed by a CITY (2+ CAPS)
  const CAT_REGEX = /^([a-záêíóúçã\s\/]+)\s+[A-ZÁÊÍÓÚÇ]{2}/;

  const SKIP_PHRASES = [
    "pagamento via conta",
    "total dos pagamentos",
    "total dos lancamentos",
    "lancamentos no cartao",
    "lancamentos produtos",
    "proxima fatura",
    "demais faturas",
    "total para proximas",
  ];

  const transactions: ItauParsedTransaction[] = [];
  let stopImporting = false;

  for (let i = 0; i < lines.length; i++) {
    const line  = lines[i];
    const lineN = normalize(line);

    if (lineN.includes("proximas faturas") ||
        (lineN.includes("compras parceladas") && lineN.includes("proximas"))) {
      stopImporting = true;
    }
    if (stopImporting) continue;
    if (SKIP_PHRASES.some((p) => lineN.includes(p))) continue;

    const match = line.match(TX_REGEX);
    if (!match) continue;

    const [, dayStr, monthStr, rawDesc, rawAmount] = match;
    const month  = parseInt(monthStr);
    const day    = parseInt(dayStr);
    const year   = inferYear(month);
    const amount = parseFloat(rawAmount.replace(/\./g, "").replace(",", "."));
    if (amount <= 0) continue;

    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const { name: description, note: installmentNote } = extractInstallment(rawDesc.trim());

    // Look ahead for category hint
    let itauCategory: string | null = null;
    const nextLine = lines.slice(i + 1, i + 3).find((l) => l.trim()) ?? "";
    const catMatch = nextLine.match(CAT_REGEX);
    if (catMatch) itauCategory = mapItauCategory(catMatch[1].trim());

    transactions.push({ date, description, amount, itauCategory, installmentNote });
  }

  return transactions;
}
