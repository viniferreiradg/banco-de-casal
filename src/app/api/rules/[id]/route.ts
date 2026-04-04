import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/rules/[id]
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
  if (body.matchField !== undefined) update.matchField = body.matchField;
  if (body.matchValue !== undefined) update.matchValue = body.matchValue.toLowerCase();
  if (body.pctUser1 !== undefined) {
    update.pctUser1 = body.pctUser1;
    update.pctUser2 = 100 - body.pctUser1;
  }
  if (body.priority !== undefined) update.priority = body.priority;
  if (body.isActive !== undefined) update.isActive = body.isActive;

  const rule = await prisma.splitRule.update({ where: { id }, data: update });
  return NextResponse.json({ rule });
}

// DELETE /api/rules/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.splitRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
