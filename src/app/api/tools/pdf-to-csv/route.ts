export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "O arquivo deve ser um PDF." }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY não configurada no servidor." }, { status: 500 });
  }

  const bytes = await file.arrayBuffer();
  const pdfBase64 = Buffer.from(bytes).toString("base64");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let result;
  try {
    result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      `Extraia todas as transações de compra desta fatura bancária em CSV.

Formato obrigatório — sem cabeçalho, sem bloco de código markdown, sem texto extra:
data,descricao,valor

Regras:
- data: DD/MM/YYYY
- descricao: nome do estabelecimento limpo (sem códigos, sem abreviações desnecessárias, capitalize corretamente)
- valor: número positivo com PONTO decimal, sem símbolo de moeda (ex: 45.90) — NUNCA use vírgula no valor pois o CSV usa vírgula como separador
- Ignore: pagamentos recebidos, saldo anterior, totais, subtotais, linhas de cabeçalho, tarifas bancárias
- Inclua parcelamentos (ex: "Panificadora 2/5" deve virar descricao "Panificadora")

Retorne APENAS as linhas CSV, uma por linha, nada mais.`,
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Erro ao chamar Gemini API: ${msg}` }, { status: 502 });
  }

  const rawText = result.response.text().trim();

  if (!rawText) {
    return NextResponse.json({ error: "Não foi possível extrair transações do PDF." }, { status: 422 });
  }

  // Garante que o CSV sempre tem o cabeçalho correto
  const csvText = "data,descricao,valor\n" + rawText;

  return new Response(csvText, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transacoes.csv"`,
    },
  });
}
