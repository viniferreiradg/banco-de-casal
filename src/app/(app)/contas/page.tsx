"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Trash2, CreditCard, Landmark, Wifi, FileText, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PluggyConnect: any;
  }
}

interface BankConnection {
  id: string;
  bankName: string;
  bankLogo: string | null;
  accountType: string;
  isCreditCard: boolean;
  isManual: boolean;
  status: string;
  lastSyncAt: string | null;
  _count?: { transactions: number };
}

export default function ContasPage() {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountType, setAccountType] = useState<"PERSONAL" | "SHARED">("PERSONAL");
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"MANUAL" | "AUTOMATIC">("MANUAL");
  const [manualBankName, setManualBankName] = useState("");
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/bank-connections");
    const data = await res.json();
    setConnections(data.connections ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openPluggyWidget() {
    setConnecting(true);
    const res = await fetch("/api/pluggy/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const { accessToken } = await res.json();

    // Load Pluggy Connect widget script dynamically
    if (!document.getElementById("pluggy-script")) {
      const script = document.createElement("script");
      script.id = "pluggy-script";
      script.src = "https://cdn.pluggy.ai/pluggy-connect/v3/pluggy-connect.js";
      document.body.appendChild(script);
      await new Promise((resolve) => { script.onload = resolve; });
    }

    const pluggy = new window.PluggyConnect({
      connectToken: accessToken,
      onSuccess: async ({ itemId }: { itemId: string }) => {
        await fetch("/api/pluggy/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, accountType, isCreditCard }),
        });
        setConnectOpen(false);
        setConnecting(false);
        load();
      },
      onError: () => setConnecting(false),
      onClose: () => setConnecting(false),
    });

    pluggy.init();
  }

  async function saveManualConnection() {
    if (!manualBankName.trim()) return;
    setConnecting(true);
    await fetch("/api/bank-connections/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName: manualBankName.trim(), accountType, isCreditCard }),
    });
    setConnectOpen(false);
    setConnecting(false);
    setManualBankName("");
    load();
  }

  async function convertToAutomatic(id: string) {
    if (!confirm("Converter para automático? As transações manuais existentes ficarão pendentes de revisão e não contarão nos totais até você confirmá-las.")) return;
    const res = await fetch(`/api/bank-connections/${id}/convert`, { method: "POST" });
    const data = await res.json();
    if (data.pendingCount > 0) {
      alert(`${data.pendingCount} transaç${data.pendingCount === 1 ? "ão ficou pendente" : "ões ficaram pendentes"} de revisão. Acesse Transações para confirmar.`);
    }
    load();
    // Open Pluggy widget to link the real account
    setConnectOpen(true);
  }

  async function deleteConnection(id: string) {
    if (!confirm("Desconectar esta conta? As transações já importadas serão mantidas.")) return;
    await fetch(`/api/bank-connections/${id}`, { method: "DELETE" });
    load();
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    ERROR: "bg-red-100 text-red-800",
    DISCONNECTED: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground text-sm">
            Conecte seus bancos para importar transações automaticamente
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)} size="sm">
          <Plus className="size-4 mr-2" />
          Conectar banco
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border">
              <div className="flex items-center gap-3 py-3 px-4">
                <div className="size-8 animate-pulse rounded bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="flex gap-2">
                    <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </div>
              <div className="border-t px-4 py-2">
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma conta conectada ainda.</p>
          <p className="text-sm mt-1">Conecte seus bancos para começar a importar transações.</p>
          <Button className="mt-4" onClick={() => setConnectOpen(true)}>
            <Plus className="size-4 mr-2" />
            Conectar primeiro banco
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {conn.bankLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={conn.bankLogo} alt={conn.bankName} className="size-8 rounded" />
                    )}
                    <div>
                      <CardTitle className="text-sm">{conn.bankName}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          className={`text-xs ${statusColors[conn.status] ?? ""}`}
                          variant="outline"
                        >
                          {conn.status === "ACTIVE" ? "Ativa" : conn.status === "ERROR" ? "Erro" : "Desconectada"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {conn.accountType === "SHARED" ? "Compartilhada" : "Pessoal"}
                        </Badge>
                        {conn.isCreditCard && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <CreditCard className="size-3" />
                            Crédito
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {conn.isManual ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Converter para automático"
                        onClick={() => convertToAutomatic(conn.id)}
                      >
                        <ArrowRightLeft className="size-3" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="size-7" title="Sincronizar agora">
                        <RefreshCw className="size-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => deleteConnection(conn.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {conn._count?.transactions ?? 0} transaç{(conn._count?.transactions ?? 0) === 1 ? "ão" : "ões"}
                  </span>
                  {conn.lastSyncAt && (
                    <span>
                      Sincronizado {format(new Date(conn.lastSyncAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connect dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">

            {/* Account type */}
            <div className="space-y-2">
              <Label>Esta conta é</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["PERSONAL", "SHARED"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAccountType(type)}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors",
                      accountType === type ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                    )}
                  >
                    <span className="text-sm font-medium">{type === "PERSONAL" ? "Pessoal" : "Compartilhada"}</span>
                    <span className="text-xs text-muted-foreground">
                      {type === "PERSONAL" ? "100% minha" : "Dividida com parceiro(a)"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card type */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsCreditCard(false)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-colors",
                    !isCreditCard ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <Landmark className="size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Débito / PIX</p>
                    <p className="text-xs text-muted-foreground">Conta corrente</p>
                  </div>
                </button>
                <button
                  onClick={() => setIsCreditCard(true)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-colors",
                    isCreditCard ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <CreditCard className="size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Crédito</p>
                    <p className="text-xs text-muted-foreground">Fatura mensal</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Connection mode */}
            <div className="space-y-2">
              <Label>Como entram as transações?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConnectionMode("MANUAL")}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-colors",
                    connectionMode === "MANUAL" ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <FileText className="size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Manual / CSV</p>
                    <p className="text-xs text-muted-foreground">Você adiciona</p>
                  </div>
                </button>
                <button
                  onClick={() => setConnectionMode("AUTOMATIC")}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-colors",
                    connectionMode === "AUTOMATIC" ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <Wifi className="size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Automático</p>
                    <p className="text-xs text-muted-foreground">Via Open Finance</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Manual: bank name input */}
            {connectionMode === "MANUAL" && (
              <div className="space-y-2">
                <Label>Nome do banco ou conta</Label>
                <Input
                  placeholder="ex: Nubank, Inter, Bradesco..."
                  value={manualBankName}
                  onChange={(e) => setManualBankName(e.target.value)}
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={connectionMode === "AUTOMATIC" ? openPluggyWidget : saveManualConnection}
              disabled={connecting || (connectionMode === "MANUAL" && !manualBankName.trim())}
            >
              {connecting ? "Aguarde..." : connectionMode === "AUTOMATIC" ? "Conectar via Open Finance" : "Adicionar conta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
