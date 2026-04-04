import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORIES = [
  { name: "Supermercado", icon: "🛒" },
  { name: "Restaurante", icon: "🍽️" },
  { name: "Delivery", icon: "🛵" },
  { name: "Padaria / Lanchonete", icon: "🥐" },
  { name: "Combustível", icon: "⛽" },
  { name: "Uber / Táxi", icon: "🚗" },
  { name: "Estacionamento", icon: "🅿️" },
  { name: "Transporte público", icon: "🚌" },
  { name: "Aluguel", icon: "🏠" },
  { name: "Condomínio", icon: "🏢" },
  { name: "Água / Luz / Gás", icon: "💡" },
  { name: "Internet / TV / Telefone", icon: "📡" },
  { name: "Farmácia", icon: "💊" },
  { name: "Plano de saúde", icon: "🏥" },
  { name: "Consulta / Exame", icon: "🩺" },
  { name: "Streaming", icon: "📺" },
  { name: "Cinema / Teatro", icon: "🎬" },
  { name: "Viagem / Hotel", icon: "✈️" },
  { name: "Roupas / Calçados", icon: "👕" },
  { name: "Eletrônicos", icon: "💻" },
  { name: "Casa / Decoração", icon: "🛋️" },
  { name: "Escola / Faculdade", icon: "🎓" },
  { name: "Cursos", icon: "📚" },
  { name: "Investimento", icon: "📈" },
  { name: "Imposto / Taxa", icon: "🧾" },
  { name: "Pet", icon: "🐾" },
  { name: "Assinatura", icon: "🔄" },
  { name: "Outros", icon: "📦" },
];

// GET /api/categories — list user's categories, seeding defaults on first access
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  // Seed defaults if user has none yet
  if (categories.length === 0) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id })),
      skipDuplicates: true,
    });
    categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json({ categories });
}

// POST /api/categories — create a new category
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, icon } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  try {
    const category = await prisma.category.create({
      data: { name: name.trim(), icon: icon?.trim() || null, userId: user.id },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Categoria já existe" }, { status: 409 });
  }
}
