import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { FerramentasTabs } from "./ferramentas-tabs";

export default async function FerramentasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      bankConnections: { select: { id: true, bankName: true, nickname: true, accountType: true, isCreditCard: true } },
      couple: {
        include: {
          members: {
            include: {
              bankConnections: { select: { id: true, bankName: true, nickname: true, accountType: true, isCreditCard: true } },
            },
          },
        },
      },
    },
  });

  // Collect all connections visible to this user (own + shared)
  const allConnections = dbUser?.couple?.members.flatMap((m) =>
    m.bankConnections.map((b) => ({ ...b, userId: m.id }))
  ) ?? dbUser?.bankConnections.map((b) => ({ ...b, userId: user.id })) ?? [];

  // Deduplicate by id
  const seen = new Set<string>();
  const bankConnections = allConnections.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ferramentas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Utilitários para facilitar o uso do app.
        </p>
      </div>
      <FerramentasTabs bankConnections={bankConnections} currentUserId={user.id} />
    </div>
  );
}
