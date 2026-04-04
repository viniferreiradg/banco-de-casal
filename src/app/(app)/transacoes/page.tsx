"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Pencil, Plus, Upload, CreditCard, Check, X, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryCombobox } from "@/components/ui/category-combobox";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}

interface Split {
  pctUser1: number;
  pctUser2: number;
  amountUser1: number;
  amountUser2: number;
  isManualOverride: boolean;
}

interface Transaction {
  id: string;
  date: string;
  billingMonth: string | null;
  description: string;
  customName: string | null;
  amount: number;
  category: string | null;
  notes: string | null;
  isShared: boolean;
  isCreditCard: boolean;
  pendingReview: boolean;
  split: Split | null;
  bankConnectionId: string;
  bankConnection: { id: string; bankName: string; accountType: string; isCreditCard: boolean };
  owner: { id: string; name: string };
}

interface BankConnection {
  id: string;
  bankName: string;
  accountType: string;
  isCreditCard: boolean;
}

interface InlineRow {
  uid: string;
  date: string;
  description: string;
  amount: string;
  category: string;
  bankConnectionId: string;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1), "MMMM 'de' yyyy", { locale: ptBR });
}

function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 2), "yyyy-MM");
}

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m), "yyyy-MM");
}

export default function TransacoesPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // Inline row entry
  const [inlineRows, setInlineRows] = useState<InlineRow[]>([]);
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [focusRowUid, setFocusRowUid] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Edit dialog
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editPct, setEditPct] = useState("50");
  const [editCustomName, setEditCustomName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // CSV import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importBankId, setImportBankId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [txRes, bankRes, catRes] = await Promise.all([
      fetch(`/api/transactions?month=${month}`),
      fetch("/api/bank-connections"),
      fetch("/api/categories"),
    ]);
    const [txData, bankData, catData] = await Promise.all([txRes.json(), bankRes.json(), catRes.json()]);
    setTransactions(txData.transactions ?? []);
    setBankConnections(bankData.connections ?? []);
    setCategories(catData.categories ?? []);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Focus new inline row when added
  useEffect(() => {
    if (focusRowUid && inputRefs.current[focusRowUid]) {
      inputRefs.current[focusRowUid]?.focus();
      setFocusRowUid(null);
    }
  }, [focusRowUid, inlineRows]);

  // ── Inline rows ──────────────────────────────────────────────

  function addInlineRow() {
    const uid = crypto.randomUUID();
    setInlineRows((prev) => [
      ...prev,
      {
        uid,
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        amount: "",
        category: "",
        bankConnectionId: bankConnections[0]?.id ?? "",
      },
    ]);
    setFocusRowUid(uid);
  }

  function updateInlineRow(uid: string, field: keyof Omit<InlineRow, "uid">, value: string) {
    setInlineRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, [field]: value } : r)));
  }

  function removeInlineRow(uid: string) {
    setInlineRows((prev) => prev.filter((r) => r.uid !== uid));
    delete inputRefs.current[uid];
  }

  async function saveInlineRow(uid: string, addNext: boolean) {
    const row = inlineRows.find((r) => r.uid === uid);
    if (!row || !row.description.trim() || !row.amount || !row.bankConnectionId) return;
    if (savingRows.has(uid)) return;

    setSavingRows((prev) => new Set(prev).add(uid));

    const res = await fetch("/api/transactions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: row.date,
        description: row.description.trim(),
        amount: Number(row.amount),
        category: row.category.trim() || null,
        bankConnectionId: row.bankConnectionId,
      }),
    });

    setSavingRows((prev) => { const s = new Set(prev); s.delete(uid); return s; });

    if (res.ok) {
      if (addNext) {
        const newUid = crypto.randomUUID();
        setInlineRows((prev) =>
          prev.map((r) =>
            r.uid === uid
              ? {
                  uid: newUid,
                  date: row.date,
                  description: "",
                  amount: "",
                  category: "",
                  bankConnectionId: row.bankConnectionId,
                }
              : r
          )
        );
        delete inputRefs.current[uid];
        setFocusRowUid(newUid);
      } else {
        removeInlineRow(uid);
      }
      load(true);
    }
  }

  function handleInlineKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    uid: string,
    isLast: boolean
  ) {
    if (e.key === "Escape") {
      e.preventDefault();
      removeInlineRow(uid);
    } else if (e.key === "Enter") {
      e.preventDefault();
      saveInlineRow(uid, true);
    } else if (e.key === "Tab" && !e.shiftKey && isLast) {
      e.preventDefault();
      saveInlineRow(uid, true);
    }
  }

  // ── Edit dialog ──────────────────────────────────────────────

  function openEdit(tx: Transaction) {
    setEditing(tx);
    setEditPct(tx.split ? String(tx.split.pctUser1) : "50");
    setEditCustomName(tx.customName ?? "");
    setEditCategory(tx.category ?? "");
    setEditNotes(tx.notes ?? "");
  }

  async function deleteTransaction(tx: Transaction) {
    setEditing(null);
    // Optimistic: remove from UI immediately
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));

    const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    if (!res.ok) {
      // Rollback
      setTransactions((prev) => [tx, ...prev]);
      toast.error("Erro ao excluir transação.");
      return;
    }

    toast("Transação excluída", {
      description: tx.customName ?? tx.description,
      action: {
        label: "Desfazer",
        onClick: async () => {
          await fetch("/api/transactions/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: tx.date.slice(0, 10),
              description: tx.description,
              customName: tx.customName ?? undefined,
              amount: Number(tx.amount),
              category: tx.category ?? undefined,
              notes: tx.notes ?? undefined,
              bankConnectionId: tx.bankConnectionId,
              pctUser1: tx.split ? Number(tx.split.pctUser1) : undefined,
            }),
          });
          load(true);
          toast.success("Transação restaurada.");
        },
      },
      duration: 5000,
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/transactions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pctUser1: Number(editPct),
        customName: editCustomName || null,
        category: editCategory || null,
        notes: editNotes || null,
      }),
    });
    setSaving(false);
    setEditing(null);
    load(true);
  }

  // ── Pending review ───────────────────────────────────────────

  async function confirmReview(id: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingReview: false }),
    });
    load(true);
  }

  async function discardReview(tx: Transaction) {
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    toast("Transação descartada", { duration: 3000 });
    load(true);
  }

  // ── CSV import ───────────────────────────────────────────────

  async function runImport() {
    if (!importFile || !importBankId) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", importFile);
    fd.append("bankConnectionId", importBankId);
    const res = await fetch("/api/transactions/import", { method: "POST", body: fd });
    const data = await res.json();
    setImporting(false);
    setImportResult(data);
    if (res.ok) load(true);
  }

  // ── Derived values ───────────────────────────────────────────

  const filtered = transactions.filter((tx) => {
    const search = filter.toLowerCase();
    return (
      tx.description.toLowerCase().includes(search) ||
      (tx.customName ?? "").toLowerCase().includes(search) ||
      (tx.category ?? "").toLowerCase().includes(search)
    );
  });

  const pendingCount = filtered.filter((tx) => tx.pendingReview).length;
  const confirmed = filtered.filter((tx) => !tx.pendingReview);
  const totalShared = confirmed.filter((tx) => tx.isShared).reduce((s, tx) => s + Number(tx.amount), 0);
  const myShare = confirmed.filter((tx) => tx.isShared && tx.split).reduce((s, tx) => s + Number(tx.split!.amountUser1), 0);
  const partnerShare = confirmed.filter((tx) => tx.isShared && tx.split).reduce((s, tx) => s + Number(tx.split!.amountUser2), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Transações</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setMonth(prevMonth(month))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium w-40 text-center capitalize">
              {monthLabel(month)}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth(nextMonth(month))}
              disabled={month >= format(new Date(), "yyyy-MM")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 mr-1" />
            Importar CSV
          </Button>
          <Button size="sm" onClick={addInlineRow}>
            <Plus className="size-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Card className="p-3">
          <p className="text-muted-foreground text-xs">Total compartilhado</p>
          {loading ? <Skeleton className="h-6 w-24 mt-1" /> : <p className="font-semibold text-base">{formatBRL(totalShared)}</p>}
        </Card>
        <Card className="p-3">
          <p className="text-muted-foreground text-xs">Minha parte</p>
          {loading ? <Skeleton className="h-6 w-20 mt-1" /> : <p className="font-semibold text-base">{formatBRL(myShare)}</p>}
        </Card>
        <Card className="p-3">
          <p className="text-muted-foreground text-xs">Parte da parceira</p>
          {loading ? <Skeleton className="h-6 w-20 mt-1" /> : <p className="font-semibold text-base">{formatBRL(partnerShare)}</p>}
        </Card>
        <Card className="p-3">
          <p className="text-muted-foreground text-xs">Lançamentos</p>
          {loading ? <Skeleton className="h-6 w-8 mt-1" /> : <p className="font-semibold text-base">{filtered.length}</p>}
        </Card>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {pendingCount === 1
              ? "1 transação pendente de revisão — confirme ou descarte antes do acerto do mês."
              : `${pendingCount} transações pendentes de revisão — confirme ou descarte antes do acerto do mês.`}
          </span>
        </div>
      )}

      <Input
        placeholder="Filtrar por nome, apelido ou categoria..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Eu</TableHead>
                <TableHead className="text-right">Parceira</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* ── Skeleton rows while loading ── */}
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {/* ── Inline entry rows ── */}
              {!loading && inlineRows.map((row) => {
                const isSaving = savingRows.has(row.uid);
                const canSave = row.description.trim() && row.amount && row.bankConnectionId;
                return (
                  <TableRow key={row.uid} className="bg-blue-50/40 hover:bg-blue-50/60">
                    {/* Data */}
                    <TableCell className="py-1.5">
                      <input
                        type="date"
                        className="h-7 w-28 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={row.date}
                        ref={(el) => { inputRefs.current[row.uid] = el; }}
                        onChange={(e) => updateInlineRow(row.uid, "date", e.target.value)}
                        onKeyDown={(e) => handleInlineKeyDown(e, row.uid, false)}
                        disabled={isSaving}
                      />
                    </TableCell>
                    {/* Descrição */}
                    <TableCell className="py-1.5 max-w-[220px]">
                      <input
                        type="text"
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Descrição..."
                        value={row.description}
                        onChange={(e) => updateInlineRow(row.uid, "description", e.target.value)}
                        onKeyDown={(e) => handleInlineKeyDown(e, row.uid, false)}
                        disabled={isSaving}
                      />
                    </TableCell>
                    {/* Categoria */}
                    <TableCell className="py-1.5 min-w-[160px]">
                      <CategoryCombobox
                        categories={categories}
                        value={row.category}
                        onChange={(v) => updateInlineRow(row.uid, "category", v)}
                        placeholder="Categoria..."
                        onCreateNew={async (name) => {
                          await fetch("/api/categories", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name }),
                          });
                          load(true);
                        }}
                      />
                    </TableCell>
                    {/* Conta */}
                    <TableCell className="py-1.5">
                      <select
                        className="h-7 w-32 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={row.bankConnectionId}
                        onChange={(e) => updateInlineRow(row.uid, "bankConnectionId", e.target.value)}
                        onKeyDown={(e) => handleInlineKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>, row.uid, false)}
                        disabled={isSaving}
                      >
                        <option value="">Conta...</option>
                        {bankConnections.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bankName}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    {/* Valor */}
                    <TableCell className="py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-7 w-24 rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="0,00"
                        value={row.amount}
                        onChange={(e) => updateInlineRow(row.uid, "amount", e.target.value)}
                        onKeyDown={(e) => handleInlineKeyDown(e, row.uid, true)}
                        disabled={isSaving}
                      />
                    </TableCell>
                    {/* Eu / Parceira / % — auto */}
                    <TableCell colSpan={3} className="text-xs text-muted-foreground text-center py-1.5">
                      {isSaving ? "salvando..." : "calculado ao salvar"}
                    </TableCell>
                    {/* Actions */}
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Salvar (Enter)"
                          onClick={() => saveInlineRow(row.uid, false)}
                          disabled={isSaving || !canSave}
                        >
                          <Check className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title="Cancelar (Esc)"
                          onClick={() => removeInlineRow(row.uid)}
                          disabled={isSaving}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* ── Existing transactions ── */}
              {!loading && filtered.length === 0 && inlineRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              ) : !loading && (
                filtered.map((tx) => (
                  <TableRow key={tx.id} className={tx.pendingReview ? "bg-yellow-50 hover:bg-yellow-100" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(tx.date), "dd/MM")}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {tx.customName ? (
                        <>
                          <p className="text-sm font-medium truncate">{tx.customName}</p>
                          <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                        </>
                      ) : (
                        <p className="text-sm truncate">{tx.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{tx.owner.name}</p>
                      {tx.notes && (
                        <p className="text-xs text-muted-foreground italic truncate">{tx.notes}</p>
                      )}
                      {tx.pendingReview && (
                        <Badge className="text-xs mt-0.5 bg-yellow-100 text-yellow-800 border-yellow-300" variant="outline">
                          Revisão pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {tx.category ? (
                        <Badge variant="outline" className="text-xs">{tx.category}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {tx.bankConnection.isCreditCard && <CreditCard className="size-3 shrink-0" />}
                        <span className="truncate max-w-[100px]">{tx.bankConnection.bankName}</span>
                      </div>
                      {tx.bankConnection.accountType === "SHARED" && (
                        <Badge variant="secondary" className="text-xs mt-0.5">Compartilhada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatBRL(Number(tx.amount))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {tx.isShared && tx.split
                        ? formatBRL(Number(tx.split.amountUser1))
                        : <span className="text-muted-foreground text-xs">pessoal</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {tx.isShared && tx.split
                        ? formatBRL(Number(tx.split.amountUser2))
                        : <span className="text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {tx.split ? (
                        <span className={tx.split.isManualOverride ? "text-orange-500" : ""}>
                          {Number(tx.split.pctUser1)}/{Number(tx.split.pctUser2)}
                          {tx.split.isManualOverride && " ✎"}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {tx.pendingReview ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Confirmar transação"
                            onClick={() => confirmReview(tx.id)}
                          >
                            <Check className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Descartar transação"
                            onClick={() => discardReview(tx)}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(tx)}>
                          <Pencil className="size-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar transação</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded p-3">
                <p className="text-xs text-muted-foreground">Nome original do banco</p>
                <p className="text-sm font-medium">{editing.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatBRL(Number(editing.amount))} · {format(new Date(editing.date), "dd/MM/yyyy")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Apelido <span className="text-muted-foreground text-xs">(substitui o nome acima)</span></Label>
                <Input
                  value={editCustomName}
                  onChange={(e) => setEditCustomName(e.target.value)}
                  placeholder="Ex: Disco do Pink Floyd (4/5)"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <CategoryCombobox
                  categories={categories}
                  value={editCategory}
                  onChange={setEditCategory}
                  placeholder="Sem categoria"
                  onCreateNew={async (name) => {
                    await fetch("/api/categories", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name }),
                    });
                    load(true);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Ex: castração do gato" />
              </div>
              <div className="space-y-2">
                <Label>Divisão — minha porcentagem: <strong>{editPct}%</strong></Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={editPct}
                  onChange={(e) => setEditPct(e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Eu: {formatBRL(Number(editing.amount) * Number(editPct) / 100)}</span>
                  <span>Parceira: {formatBRL(Number(editing.amount) * (100 - Number(editPct)) / 100)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => editing && deleteTransaction(editing)}
            >
              <Trash2 className="size-3 mr-1.5" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importar extrato (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporte o extrato do seu banco em CSV. O arquivo precisa ter colunas de <strong>data</strong>, <strong>descrição</strong> e <strong>valor</strong>.
            </p>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={importBankId} onValueChange={(v) => v && setImportBankId(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                <SelectContent>
                  {bankConnections.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bankName} ({b.accountType === "SHARED" ? "Compartilhada" : "Pessoal"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo CSV</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => fileInputRef.current?.click()}>
                {importFile ? (
                  <p className="text-sm font-medium">{importFile.name}</p>
                ) : (
                  <>
                    <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar</p>
                    <p className="text-xs text-muted-foreground mt-1">.csv, .txt</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
            </div>
            {importResult && (
              <div className={`p-3 rounded text-sm ${importResult.imported > 0 ? "bg-green-50 text-green-800" : "bg-muted"}`}>
                ✓ {importResult.imported} transações importadas
                {importResult.skipped > 0 && ` · ${importResult.skipped} ignoradas`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Fechar</Button>
            <Button onClick={runImport} disabled={importing || !importFile || !importBankId}>
              {importing ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
