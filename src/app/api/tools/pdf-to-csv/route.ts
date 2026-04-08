export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor." }, { status: 500 });
  }

  const bytes = await file.arrayBuffer();
  const pdfBase64 = Buffer.from(bytes).toString("base64");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `Extraia todas as transações de compra desta fatura bancária em CSV.

Formato obrigatório — sem cabeçalho, sem bloco de código markdown, sem texto extra:
data,descricao,valor

Regras:
- data: DD/MM/YYYY
- descricao: nome do estabelecimento limpo (sem códigos, sem abreviações desnecessárias, capitalize corretamente)
- valor: número positivo com vírgula decimal, sem símbolo de moeda (ex: 45,90)
- Ignore: pagamentos recebidos, saldo anterior, totais, subtotais, linhas de cabeçalho, tarifas bancárias
- Inclua parcelamentos (ex: "Panificadora Padeirinhl 2/5" deve virar descricao "Panificadora Padeirinhl")

Retorne APENAS as linhas CSV, uma por linha, nada mais.`,
          },
        ],
      },
    ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido na API do Claude.";
    return NextResponse.json({ error: `Erro ao chamar Claude API: ${msg}` }, { status: 502 });
  }

  const csvText = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("")
    .trim();

  if (!csvText) {
    return NextResponse.json({ error: "Não foi possível extrair transações do PDF." }, { status: 422 });
  }

  return new Response(csvText, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transacoes.csv"`,
    },
  });
}
