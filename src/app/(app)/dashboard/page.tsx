import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import Link from "next/link";
import { ArrowRight, AlertCircle, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Decimal } from "decimal.js";
import { cn } from "@/lib/utils";

function formatBRL(value: Decimal | number) {
  const num = typeof value === "number" ? value : Number(value);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { couple: { include: { members: { select: { id: true, name: true } } } } },
  });

  const isSolo = !dbUser?.coupleId;
  const now = new Date();
  const currentMonth = format(now, "yyyy-MM");
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const memberIds = dbUser?.couple?.members.map((m) => m.id) ?? [user.id];
  const partner = dbUser?.couple?.members.find((m) => m.id !== user.id);

  const brokenConnections = await prisma.bankConnection.findMany({
    where: { userId: { in: memberIds }, status: { in: ["ERROR", "DISCONNECTED"] } },
    select: { id: true, bankName: true, status: true, userId: true },
  });

  const recentTransactions = await prisma.transaction.findMany({
    where: { ownerUserId: { in: memberIds }, date: { gte: from, lte: to } },
    include: { split: true, owner: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 5,
  });

  // Solo: sum all my transactions. Couple: sum by split.
  let myTotal = new Decimal(0);
  let partnerTotal = new Decimal(0);
  let balance = new Decimal(0);

  if (isSolo) {
    const allTx = await prisma.transaction.findMany({
      where: { ownerUserId: user.id, date: { gte: from, lte: to }, pendingReview: false },
    });
    for (const tx of allTx) myTotal = myTotal.plus(tx.amount);
  } else {
    const allMonthTx = await prisma.transaction.findMany({
      where: { ownerUserId: { in: memberIds }, date: { gte: from, lte: to }, isShared: true, pendingReview: false },
      include: { split: true },
    });
    let paidByMe = new Decimal(0);
    for (const tx of allMonthTx) {
      if (!tx.split) continue;
      if (tx.ownerUserId === user.id) {
        myTotal = myTotal.plus(tx.split.amountUser1);
        partnerTotal = partnerTotal.plus(tx.split.amountUser2);
        paidByMe = paidByMe.plus(tx.amount);
      } else {
        myTotal = myTotal.plus(tx.split.amountUser2);
        partnerTotal = partnerTotal.plus(tx.split.amountUser1);
      }
    }
    balance = myTotal.minus(paidByMe);
  }

  const prevMonth = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), "yyyy-MM");
  const prevUnsettled = !isSolo && dbUser?.coupleId
    ? await prisma.monthlySummary.findUnique({
        where: { coupleId_month: { coupleId: dbUser.coupleId, month: prevMonth } },
      }).then((s) => s && !s.settledAt)
    : false;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olá, {dbUser?.name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground text-sm">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {prevUnsettled && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm flex-1">
            O mês de {format(new Date(now.getFullYear(), now.getMonth() - 1), "MMMM", { locale: ptBR })} ainda não foi acertado.
          </p>
          <Link href={`/resumo/${prevMonth}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Ver
          </Link>
        </div>
      )}

      {brokenConnections.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800">
          <WifiOff className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium">
              {brokenConnections.length === 1
                ? "Uma conta bancária precisa ser reconectada"
                : `${brokenConnections.length} contas bancárias precisam ser reconectadas`}
            </p>
            <p className="text-xs mt-0.5 text-red-700">
              {brokenConnections.map((c) => {
                const owner = dbUser?.couple?.members.find((m) => m.id === c.userId);
                return owner && owner.id !== user.id ? `${c.bankName} (${owner.name})` : c.bankName;
              }).join(", ")}
            </p>
          </div>
          <Link href="/contas" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-red-300 text-red-800 hover:bg-red-100")}>
            Reconectar
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isSolo ? "Total gasto" : "Minha parte"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(myTotal)}</p>
          </CardContent>
        </Card>

        {!isSolo && partner && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Parte de {partner.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatBRL(partnerTotal)}</p>
            </CardContent>
          </Card>
        )}

        {!isSolo && (
          <Card className={balance.isNegative() ? "border-green-200" : balance.isZero() ? "" : "border-red-200"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
            </CardHeader>
            <CardContent>
              {balance.isNegative() ? (
                <>
                  <p className="text-2xl font-bold text-green-600">{formatBRL(balance.abs())}</p>
                  <p className="text-xs text-muted-foreground mt-1">{partner?.name ?? "parceiro(a)"} te deve</p>
                </>
              ) : balance.isZero() ? (
                <p className="text-2xl font-bold">R$ 0,00</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-red-600">{formatBRL(balance)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Você deve a {partner?.name ?? "parceiro(a)"}</p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas transações</CardTitle>
          <Link href="/transacoes" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex items-center gap-1")}>
            Ver todas <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma transação este mês
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(tx.date, "dd/MM")}
                      {!isSolo && ` · ${tx.owner.name}`}
                      {tx.category && ` · ${tx.category}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">{formatBRL(tx.amount)}</p>
                    {!isSolo && tx.split && (
                      <Badge variant="secondary" className="text-xs">
                        {tx.ownerUserId === user.id
                          ? `sua parte: ${formatBRL(tx.split.amountUser1)}`
                          : `sua parte: ${formatBRL(tx.split.amountUser2)}`}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href={`/resumo/${currentMonth}`} className={cn(buttonVariants({ variant: "outline" }))}>
          Ver resumo do mês
        </Link>
        <Link href="/regras" className={cn(buttonVariants({ variant: "outline" }))}>
          Gerenciar regras
        </Link>
        <Link href="/contas" className={cn(buttonVariants({ variant: "outline" }))}>
          Contas bancárias
        </Link>
      </div>
    </div>
  );
}
