import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Decimal } from "decimal.js";
import { SettleButton } from "./settle-button";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

function formatBRL(value: Decimal | number) {
  const num = typeof value === "number" ? value : Number(value);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 2), "yyyy-MM");
}

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m), "yyyy-MM");
}

export default async function ResumoPage({
  params,
}: {
  params: Promise<{ mes: string }>;
}) {
  const { mes } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { couple: { include: { members: { select: { id: true, name: true } } } } },
  });

  if (!dbUser?.coupleId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-muted-foreground">Você precisa vincular um(a) parceiro(a) primeiro.</p>
        <Link href="/perfil" className={cn(buttonVariants(), "mt-4")}>Ir para Perfil</Link>
      </div>
    );
  }

  const [year, mon] = mes.split("-").map(Number);
  const from = new Date(year, mon - 1, 1);
  const to = new Date(year, mon, 0, 23, 59, 59);
  const partner = dbUser.couple!.members.find((m) => m.id !== user.id);
  const isUser1 = dbUser.couple!.user1Id ? user.id === dbUser.couple!.user1Id : true;

  const transactions = await prisma.transaction.findMany({
    where: {
      ownerUserId: { in: dbUser.couple!.members.map((m) => m.id) },
      date: { gte: from, lte: to },
      isShared: true,
    },
    include: { split: true, owner: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  let myTotal = new Decimal(0);
  let partnerTotal = new Decimal(0);
  let paidByMe = new Decimal(0);
  let paidByPartner = new Decimal(0);

  for (const tx of transactions) {
    if (!tx.split) continue;
    // amountUser1 = sempre a parte do user1 do casal (fixo, independente de quem comprou)
    myTotal = myTotal.plus(isUser1 ? tx.split.amountUser1 : tx.split.amountUser2);
    partnerTotal = partnerTotal.plus(isUser1 ? tx.split.amountUser2 : tx.split.amountUser1);
    if (tx.ownerUserId === user.id) paidByMe = paidByMe.plus(tx.amount);
    else paidByPartner = paidByPartner.plus(tx.amount);
  }

  const balance = myTotal.minus(paidByMe);

  const summary = await prisma.monthlySummary.findUnique({
    where: { coupleId_month: { coupleId: dbUser.coupleId, month: mes } },
  });

  const isSettled = !!summary?.settledAt;
  const monthLabel = format(new Date(year, mon - 1), "MMMM 'de' yyyy", { locale: ptBR });
  const currentMonth = format(new Date(), "yyyy-MM");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">{monthLabel}</h1>
          <p className="text-muted-foreground text-sm">{transactions.length} transações compartilhadas</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/resumo/${prevMonth(mes)}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
            <ChevronLeft className="size-4" />
          </Link>
          {mes < currentMonth ? (
            <Link href={`/resumo/${nextMonth(mes)}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "outline", size: "icon" }), "opacity-50 pointer-events-none")}>
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      </div>

      {/* Settlement status */}
      {isSettled ? (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          ✓ Acertado em {format(summary!.settledAt!, "dd/MM/yyyy")}
          {summary!.settledNote && <span> — {summary!.settledNote}</span>}
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
          Este mês ainda não foi acertado
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Minha parte</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="font-semibold">{formatBRL(myTotal)}</p>
          </CardContent>
        </Card>
        {partner && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground">Parte de {partner.name}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="font-semibold">{formatBRL(partnerTotal)}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">Eu paguei</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="font-semibold">{formatBRL(paidByMe)}</p>
          </CardContent>
        </Card>
        {partner && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground">{partner.name} pagou</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="font-semibold">{formatBRL(paidByPartner)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Balance */}
      <Card className={balance.isNegative() ? "border-green-300" : balance.isZero() ? "" : "border-red-300"}>
        <CardContent className="pt-4">
          {balance.abs().lessThan("0.01") ? (
            <p className="text-center font-medium">Tudo certo! Nenhum acerto necessário.</p>
          ) : balance.isNegative() ? (
            <p className="text-center">
              <span className="font-semibold text-green-700">{partner?.name ?? "Parceiro(a)"} te deve {formatBRL(balance.abs())}</span>
            </p>
          ) : (
            <p className="text-center">
              <span className="font-semibold text-red-700">Você deve {formatBRL(balance)} para {partner?.name ?? "parceiro(a)"}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Settle button */}
      {!isSettled && !balance.abs().lessThan("0.01") && (
        <SettleButton month={mes} />
      )}

      {/* Transaction list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Detalhamento</h2>
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
            <div className="min-w-0">
              <p className="text-sm truncate">{tx.description}</p>
              <p className="text-xs text-muted-foreground">
                {format(tx.date, "dd/MM")} · {tx.owner.name}
                {tx.category && ` · ${tx.category}`}
              </p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className="text-sm font-medium">{formatBRL(Number(tx.amount))}</p>
              {tx.split && (
                <Badge variant="outline" className="text-xs">
                  {tx.ownerUserId === user.id
                    ? `minha parte: ${formatBRL(Number(tx.split.amountUser1))}`
                    : `minha parte: ${formatBRL(Number(tx.split.amountUser2))}`}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
