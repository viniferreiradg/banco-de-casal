import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/category-rules/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.matchValue !== undefined) update.matchValue = (Array.isArray(body.matchValue) ? body.matchValue.join(",") : body.matchValue).trim();
  if (body.category !== undefined) update.category = body.category.trim();
  if (body.isActive !== undefined) update.isActive = body.isActive;

  const rule = await prisma.categoryRule.update({ where: { id }, data: update });
  return NextResponse.json({ rule });
}

// DELETE /api/category-rules/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.categoryRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
