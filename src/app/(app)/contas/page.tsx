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
import { Plus, RefreshCw, Trash2, CreditCard, Landmark, Wifi, FileText, ArrowRightLeft, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


const PASTEL_COLORS = [
  "#FFF5A0", "#FFE4C0", "#FFCCAA", "#FFB5B5",
  "#E8F5A8", "#C8EFA8", "#A8F0D8", "#B8E8FF",
  "#A8CCEF", "#C8B8F0", "#DDB8F0", "#FFB8D8",
];

interface BankConnection {
  id: string;
  bankName: string;
  nickname: string | null;
  bankLogo: string | null;
  color: string | null;
  accountType: string;
  isCreditCard: boolean;
  isManual: boolean;
  status: string;
  lastSyncAt: string | null;
  _count?: { transactions: number };
  user: { id: string; name: string };
}

export default function ContasPage() {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountType, setAccountType] = useState<"PERSONAL" | "SHARED">("PERSONAL");
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"MANUAL" | "AUTOMATIC">("MANUAL");
  const [manualBankName, setManualBankName] = useState("");
  const [nickname, setNickname] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; count: number } | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  // Edit dialog state
  const [editConn, setEditConn] = useState<BankConnection | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editIsCreditCard, setEditIsCreditCard] = useState(false);
  const [editAccountType, setEditAccountType] = useState<"PERSONAL" | "SHARED">("PERSONAL");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/bank-connections");
    const data = await res.json();
    setConnections(data.connections ?? []);
    if (data.currentUserId) setCurrentUserId(data.currentUserId);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openPluggyWidget() {
    setConnecting(true);
    setWidgetError(null);
    // Close dialog first — shadcn Dialog has a focus trap that blocks external overlays
    setConnectOpen(false);

    try {
      const res = await fetch("/api/pluggy/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erro ao obter token (${res.status})`);
      }

      const { accessToken } = await res.json();
      if (!accessToken) throw new Error("Token não retornado pela API");

      // Dynamic import — pluggy-connect-sdk uses 'window', must run client-side only
      const { PluggyConnect } = await import("pluggy-connect-sdk");

      const savedNickname = nickname.trim() || null;

      const pluggy = new PluggyConnect({
        connectToken: accessToken,
        includeSandbox: true, // show sandbox connectors (e.g. "Pluggy Bank")
        onSuccess: async ({ item }: { item: { id: string } }) => {
          const connectRes = await fetch("/api/pluggy/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: item.id, accountType, isCreditCard, nickname: savedNickname }),
          });
          const { connection } = await connectRes.json();
          setConnecting(false);
          await load();

          if (connection?.id) {
            setSyncingId(connection.id);
            const syncRes = await fetch(`/api/bank-connections/${connection.id}/sync`, { method: "POST" });
            const syncData = await syncRes.json();
            setSyncingId(null);
            if (syncData.newTransactions > 0) {
              setSyncResult({ id: connection.id, count: syncData.newTransactions });
              setTimeout(() => setSyncResult(null), 5000);
            }
            await load();
          }
        },
        onError: (err: unknown) => {
          console.error("Pluggy widget error:", err);
          setConnecting(false);
        },
        onClose: () => setConnecting(false),
      });

      await pluggy.init();
    } catch (err) {
      console.error("openPluggyWidget error:", err);
      setWidgetError(err instanceof Error ? err.message : "Erro ao abrir widget");
      setConnecting(false);
    }
  }

  async function saveManualConnection() {
    if (!manualBankName.trim()) return;
    setConnecting(true);
    await fetch("/api/bank-connections/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName: manualBankName.trim(), nickname: nickname.trim() || null, accountType, isCreditCard, color: selectedColor }),
    });
    setConnectOpen(false);
    setConnecting(false);
    setManualBankName("");
    setNickname("");
    setSelectedColor(null);
    load();
  }

  function openEdit(conn: BankConnection) {
    setEditConn(conn);
    setEditNickname(conn.nickname ?? "");
    setEditColor(conn.color);
    setEditIsCreditCard(conn.isCreditCard);
    setEditAccountType(conn.accountType as "PERSONAL" | "SHARED");
  }

  async function saveEdit() {
    if (!editConn) return;
    await fetch(`/api/bank-connections/${editConn.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: editNickname || null, color: editColor, isCreditCard: editIsCreditCard, accountType: editAccountType }),
    });
    setEditConn(null);
    load();
  }

  async function syncConnection(id: string) {
    setSyncingId(id);
    setSyncResult(null);
    const res = await fetch(`/api/bank-connections/${id}/sync`, { method: "POST" });
    const data = await res.json();
    setSyncingId(null);
    setSyncResult({ id, count: data.newTransactions ?? 0 });
    setTimeout(() => setSyncResult(null), 5000);
    await load();
  }

  async function convertToAutomatic(id: string) {
    if (!confirm("Converter para automático? As transações manuais existentes ficarão pendentes de revisão e não contarão nos totais até você confirmá-las.")) return;
    const res = await fetch(`/api/bank-connections/${id}/convert`, { method: "POST" });
    const data = await res.json();
    if (data.pendingCount > 0) {
      alert(`${data.pendingCount} transaç${data.pendingCount === 1 ? "ão ficou pendente" : "ões ficaram pendentes"} de revisão. Acesse Transações para confirmar.`);
    }
    load();
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

      {/* Widget loading / error indicator */}
      {connecting && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm">
          <RefreshCw className="size-4 animate-spin shrink-0" />
          Abrindo widget do Pluggy...
        </div>
      )}
      {widgetError && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          <span>Erro: {widgetError}</span>
          <button onClick={() => setWidgetError(null)} className="text-red-600 hover:text-red-800 text-xs underline">fechar</button>
        </div>
      )}

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
                    {conn.bankLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={conn.bankLogo} alt={conn.bankName} className="size-8 rounded" />
                    ) : (
                      <div
                        className="size-8 rounded-full flex items-center justify-center"
                        style={conn.color ? { backgroundColor: conn.color } : { backgroundColor: "var(--muted)" }}
                      >
                        {conn.isCreditCard
                          ? <CreditCard className="size-4 text-muted-foreground" />
                          : <Landmark className="size-4 text-muted-foreground" />
                        }
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-sm">{conn.nickname ?? conn.bankName}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                        <Badge
                          variant={conn.user.id === currentUserId ? "default" : "outline"}
                          className="text-xs"
                        >
                          {conn.user.id === currentUserId ? "Você" : conn.user.name}
                        </Badge>
                        {syncingId === conn.id && (
                          <Badge variant="outline" className="text-xs gap-1 text-blue-600 border-blue-300">
                            <RefreshCw className="size-3 animate-spin" />
                            Sincronizando...
                          </Badge>
                        )}
                        {syncResult?.id === conn.id && (
                          <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                            {syncResult.count > 0
                              ? `+${syncResult.count} transaç${syncResult.count === 1 ? "ão" : "ões"}`
                              : "Já atualizado"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {conn.user.id === currentUserId && (
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Sincronizar agora"
                          disabled={syncingId === conn.id}
                          onClick={() => syncConnection(conn.id)}
                        >
                          <RefreshCw className={cn("size-3", syncingId === conn.id && "animate-spin")} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Editar conta"
                        onClick={() => openEdit(conn)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => deleteConnection(conn.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {conn._count?.transactions ?? 0} transaç{(conn._count?.transactions ?? 0) === 1 ? "ão" : "ões"}
                  </span>
                  {conn.isManual ? (
                    <span className="italic">Importação manual / CSV</span>
                  ) : conn.lastSyncAt ? (
                    <span>
                      Sincronizado {format(new Date(conn.lastSyncAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  ) : (
                    <span className="text-blue-500">Aguardando primeira sincronização...</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connect dialog */}
      <Dialog open={connectOpen} onOpenChange={(open) => { setConnectOpen(open); if (!open) { setNickname(""); setManualBankName(""); } }}>
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

            {/* Nickname — optional for both modes */}
            <div className="space-y-2">
              <Label>
                Apelido <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                placeholder={connectionMode === "MANUAL" ? "ex: Nubank Débito, Inter CC..." : "ex: Cartão da Pati, Conta conjunta..."}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Cor <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <div className="flex flex-wrap gap-2">
                {PASTEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(selectedColor === c ? null : c)}
                    className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: selectedColor === c ? "#555" : "transparent",
                    }}
                  />
                ))}
              </div>
              {selectedColor && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-full" style={{ backgroundColor: selectedColor }} />
                  Cor selecionada · <button type="button" className="underline" onClick={() => setSelectedColor(null)}>remover</button>
                </p>
              )}
            </div>

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

      {/* Edit dialog */}
      <Dialog open={!!editConn} onOpenChange={(open) => { if (!open) setEditConn(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Account type */}
            <div className="space-y-2">
              <Label>Esta conta é</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["PERSONAL", "SHARED"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setEditAccountType(type)}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors",
                      editAccountType === type ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                    )}
                  >
                    <span className="text-sm font-medium">{type === "PERSONAL" ? "Pessoal" : "Compartilhada"}</span>
                    <span className="text-xs text-muted-foreground">{type === "PERSONAL" ? "100% minha" : "Dividida com parceiro(a)"}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card type */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEditIsCreditCard(false)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-colors",
                    !editIsCreditCard ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <Landmark className="size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Débito / PIX</p>
                    <p className="text-xs text-muted-foreground">Conta corrente</p>
                  </div>
                </button>
                <button
                  onClick={() => setEditIsCreditCard(true)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-colors",
                    editIsCreditCard ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
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

            {/* Nickname */}
            <div className="space-y-2">
              <Label>Apelido <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                placeholder="ex: Nubank Débito, Inter CC..."
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Cor <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <div className="flex flex-wrap gap-2">
                {PASTEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(editColor === c ? null : c)}
                    className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: editColor === c ? "#555" : "transparent",
                    }}
                  />
                ))}
              </div>
              {editColor && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-full" style={{ backgroundColor: editColor }} />
                  Cor selecionada · <button type="button" className="underline" onClick={() => setEditColor(null)}>remover</button>
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditConn(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
