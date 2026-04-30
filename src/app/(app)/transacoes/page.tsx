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
import { ChevronLeft, ChevronRight, Info, Plus, Upload, CreditCard, Check, X, AlertTriangle, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, ChevronsUpDown, Landmark, Users, Percent } from "lucide-react";
import { toast } from "sonner";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}

function SavingRow({ label = "Salvando" }: { label?: string }) {
  return (
    <TableCell colSpan={9} className="h-[62px] text-center">
      <span className="text-sm text-muted-foreground inline-flex items-center gap-0.5">
        {label}
        <span className="animate-bounce inline-block" style={{ animationDelay: "0ms" }}>.</span>
        <span className="animate-bounce inline-block" style={{ animationDelay: "150ms" }}>.</span>
        <span className="animate-bounce inline-block" style={{ animationDelay: "300ms" }}>.</span>
      </span>
    </TableCell>
  );
}

function ConfirmDeleteRow({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <TableCell colSpan={9} className="h-[62px]">
      <div className="flex items-center justify-center gap-3">
        <span className="text-sm text-muted-foreground">
          Excluir <span className="font-medium text-foreground">{name}</span>?
        </span>
        <button
          onClick={onConfirm}
          className="h-7 px-3 rounded text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          Sim, excluir
        </button>
        <button
          onClick={onCancel}
          className="h-7 px-3 rounded text-xs font-medium border border-input bg-background hover:bg-accent transition-colors"
        >
          Não
        </button>
      </div>
    </TableCell>
  );
}

interface Split {
  pctUser1: number;
  pctUser2: number;
  amountUser1: number;
  amountUser2: number;
  isManualOverride: boolean;
  appliedRuleId: string | null;
  appliedRule: { name: string } | null;
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
  bankConnection: { id: string; bankName: string; nickname: string | null; color: string | null; accountType: string; isCreditCard: boolean };
  owner: { id: string; name: string };
}

interface BankConnection {
  id: string;
  bankName: string;
  nickname: string | null;
  color: string | null;
  accountType: string;
  isCreditCard: boolean;
  user: { id: string; name: string };
}

interface InlineRow {
  uid: string;
  date: string;
  description: string;
  alias: string;
  amount: string;
  category: string;
  bankConnectionId: string;
  pct: number | null; // null = calculado automaticamente pelas regras
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pix description parser — extracts structured fields from Nubank debit descriptions
interface PixInfo {
  direction: "enviada" | "recebida";
  name: string;
  document?: string; // CPF/CNPJ (masked or not)
  bank?: string;
  agency?: string;
  account?: string;
}

function parsePixDescription(desc: string): PixInfo | null {
  const m = desc.match(
    /^transfer[eê]ncia\s+(enviada|recebida)[^-]*?-\s*(.+?)\s*-\s*([•\d][^\-]+?)\s*-\s*(.+?)(?:\s+ag[eê]ncia:\s*(\S+)\s+conta:\s*(\S+))?\.?\s*$/i
  );
  if (!m) return null;
  return {
    direction: m[1].toLowerCase().startsWith("envia") ? "enviada" : "recebida",
    name: m[2].trim(),
    document: m[3]?.trim(),
    bank: m[4]?.trim().replace(/\.$/, ""),
    agency: m[5]?.trim(),
    account: m[6]?.trim(),
  };
}

function shortPixLabel(desc: string): string {
  const pix = parsePixDescription(desc);
  if (!pix) return desc;
  return `Pix - ${pix.name}`;
}

function transactionTypeLabel(desc: string): string | null {
  const d = desc.toLowerCase();
  if (d.startsWith("transferência enviada pelo pix") || d.startsWith("transferencia enviada pelo pix")) return "Pix enviado";
  if (d.startsWith("transferência recebida pelo pix") || d.startsWith("transferencia recebida pelo pix")) return "Pix recebido";
  if (d.startsWith("pagamento de boleto")) return "Boleto";
  return null;
}

function isInstallmentNote(notes: string | null | undefined): boolean {
  return !!notes && /^Parcela\s+\d+\/\d+$/i.test(notes);
}

function isLastInstallment(notes: string | null | undefined): boolean {
  if (!notes) return false;
  const m = notes.match(/^Parcela\s+(\d+)\/(\d+)$/i);
  return !!m && m[1] === m[2];
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCurrentUserUser1, setIsCurrentUserUser1] = useState(true);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [partnerNickname, setPartnerNickname] = useState<string | null>(null);
  const [hidePartnerPersonal, setHidePartnerPersonal] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accountFilterOpen, setAccountFilterOpen] = useState(false);
  const [sortCol, setSortCol] = useState<"date" | "name" | "category" | "account" | "total" | "my" | "partner" | "pct">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  // Inline row entry
  const [inlineRows, setInlineRows] = useState<InlineRow[]>([]);
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [focusRowUid, setFocusRowUid] = useState<string | null>(null);
  const [inlineSplitOpenUid, setInlineSplitOpenUid] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Inline delete confirm
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Edit dialog
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editPct, setEditPct] = useState("50");
  const [editCustomName, setEditCustomName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick-edit inline (click on name/category in the row)
  const [quickEditTxId, setQuickEditTxId] = useState<string | null>(null);
  const [quickEditForm, setQuickEditForm] = useState<{
    date: string; description: string; customName: string;
    category: string; bankConnectionId: string; amount: string; pct: number | null;
  }>({ date: "", description: "", customName: "", category: "", bankConnectionId: "", amount: "", pct: null });
  const [quickEditSplitOpen, setQuickEditSplitOpen] = useState(false);
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const quickEditRowRef = useRef<HTMLTableRowElement>(null);
  const isSavingQuickEditRef = useRef(false);
  const pendingQuickEditTxRef = useRef<Transaction | null>(null);
  const saveQuickEditFnRef = useRef<((tx: Transaction) => Promise<void>) | null>(null);
  const quickEditOriginalRef = useRef<typeof quickEditForm | null>(null);
  const quickEditFormRef = useRef(quickEditForm);

  // Category rule prompt (after saving edit with a new category)
  const [catRulePrompt, setCatRulePrompt] = useState<{ description: string; category: string } | null>(null);
  const [savingCatRule, setSavingCatRule] = useState(false);

  // Split rule prompt (after changing percentage)
  const [splitRulePrompt, setSplitRulePrompt] = useState<{ description: string; myPct: number } | null>(null);
  const [savingSplitRule, setSavingSplitRule] = useState(false);

  // Split popover (inline quick-edit)
  const [splitPopover, setSplitPopover] = useState<{ txId: string; pct: number; originalPct: number } | null>(null);
  const [savingSplitTxId, setSavingSplitTxId] = useState<string | null>(null);

  // CSV / PDF import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importBankId, setImportBankId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ total: number; duplicates: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete all (test only)
  const [deletingAll, setDeletingAll] = useState(false);

  // Import progress
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);

  // Mantém ref da função de save sempre atualizada (evita closure stale)
  useEffect(() => { saveQuickEditFnRef.current = saveQuickEdit; });
  // Mantém ref do form sempre atualizada (evita closure stale no mousedown)
  useEffect(() => { quickEditFormRef.current = quickEditForm; });

  // Clique fora do quick-edit → salva; se for em outra transação, abre depois
  useEffect(() => {
    if (!quickEditTxId) return;
    function handleMouseDown(e: MouseEvent) {
      // Ignore clicks inside any portal/floating content (e.g. category dropdown, percent popover)
      const insideFloating = !!(e.target as Element).closest?.('[data-slot="popover-content"]');
      if (quickEditRowRef.current && !quickEditRowRef.current.contains(e.target as Node) && !insideFloating) {
        const tx = transactions.find((t) => t.id === quickEditTxId);
        const orig = quickEditOriginalRef.current;
        const form = quickEditFormRef.current;
        // Verifica se algo foi alterado comparando com os valores originais
        const changed = !orig || Object.keys(orig).some(
          (k) => (orig as Record<string, unknown>)[k] !== (form as Record<string, unknown>)?.[k]
        );
        if (tx && saveQuickEditFnRef.current && changed) {
          isSavingQuickEditRef.current = true;
          saveQuickEditFnRef.current(tx);
        } else {
          setQuickEditTxId(null);
        }
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [quickEditTxId, transactions]);

  const loadTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/transactions?month=${month}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      if (data.currentUserId) setCurrentUserId(data.currentUserId);
      if (data.isCurrentUserUser1 !== undefined) setIsCurrentUserUser1(data.isCurrentUserUser1);
      if (data.myNickname) setMyNickname(data.myNickname);
      if (data.partnerNickname) setPartnerNickname(data.partnerNickname);
    } catch (e) {
      console.error("Erro ao carregar transações:", e);
    }
  }, [month]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [txRes, bankRes, catRes] = await Promise.all([
        fetch(`/api/transactions?month=${month}`),
        fetch("/api/bank-connections"),
        fetch("/api/categories"),
      ]);
      const [txData, bankData, catData] = await Promise.all([txRes.json(), bankRes.json(), catRes.json()]);
      setTransactions(txData.transactions ?? []);
      if (txData.currentUserId) setCurrentUserId(txData.currentUserId);
      if (txData.isCurrentUserUser1 !== undefined) setIsCurrentUserUser1(txData.isCurrentUserUser1);
      if (txData.myNickname) setMyNickname(txData.myNickname);
      if (txData.partnerNickname) setPartnerNickname(txData.partnerNickname);
      setBankConnections(bankData.connections ?? []);
      setCategories(catData.categories ?? []);
      setLoading(false);
    } catch (e) {
      console.error("Erro ao carregar transações:", e);
      setLoading(false);
    }
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
        alias: "",
        amount: "",
        category: "",
        bankConnectionId: bankConnections.find((b) => b.user.id === currentUserId || b.accountType === "SHARED")?.id ?? "",
        pct: null,
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
        customName: row.alias.trim() || null,
        amount: Number(row.amount),
        category: row.category.trim() || null,
        bankConnectionId: row.bankConnectionId,
        ...(row.pct !== null ? { pctUser1: row.pct } : {}),
      }),
    });

    setSavingRows((prev) => { const s = new Set(prev); s.delete(uid); return s; });

    if (res.ok) {
      const data = await res.json();
      const newTx = data.transaction;

      // Inserir imediatamente na lista sem esperar o reload
      if (newTx) {
        setTransactions((prev) => [newTx, ...prev]);
      }

      toast.success("Transação salva");

      // Sincronizar em background (sem bloquear a UI)
      loadTransactions();

      if (addNext) {
        const newUid = crypto.randomUUID();
        setInlineRows((prev) =>
          prev.map((r) =>
            r.uid === uid
              ? {
                  uid: newUid,
                  date: row.date,
                  description: "",
                  alias: "",
                  amount: "",
                  category: "",
                  bankConnectionId: row.bankConnectionId,
                  pct: null,
                }
              : r
          )
        );
        delete inputRefs.current[uid];
        setFocusRowUid(newUid);
      } else {
        removeInlineRow(uid);
      }

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

  // ── Split popover quick-save ──────────────────────────────────

  async function saveSplitPopover(txId: string, pct: number, originalPct: number, description: string) {
    if (pct === originalPct) return;
    setSavingSplitTxId(txId);
    await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pctUser1: pct }),
    });
    await loadTransactions();
    setSavingSplitTxId(null);
    toast.success("Divisão salva");
    setSplitRulePrompt({ description, myPct: pct });
  }

  // ── Edit dialog ──────────────────────────────────────────────

  function openEdit(tx: Transaction) {
    setEditing(tx);
    // Mostrar a pct do usuário atual (não sempre user1)
    const myPct = tx.split
      ? (isCurrentUserUser1 ? tx.split.pctUser1 : tx.split.pctUser2)
      : 50;
    setEditPct(String(myPct));
    setEditCustomName(tx.customName ?? "");
    setEditCategory(tx.category ?? "");
    setEditNotes(tx.notes ?? "");
  }

  async function deleteTransaction(tx: Transaction) {
    setEditing(null);
    setConfirmDeleteTxId(null);
    setDeletingTxId(tx.id);
    // Small delay so the "excluindo..." row is visible before the row disappears
    await new Promise((r) => setTimeout(r, 600));
    setDeletingTxId(null);
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
    const previousCategory = editing.category ?? "";
    const previousMyPct = editing.split
      ? (isCurrentUserUser1 ? Number(editing.split.pctUser1) : Number(editing.split.pctUser2))
      : 50;
    const newMyPct = Number(editPct);
    await fetch(`/api/transactions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pctUser1: newMyPct,
        customName: editCustomName || null,
        category: editCategory || null,
        notes: editNotes || null,
      }),
    });
    setSaving(false);
    const description = editing.description;
    const newCategory = editCategory.trim();
    setEditing(null);
    load(true);
    // Se mudou a categoria, pergunta se quer criar regra de categoria
    if (newCategory && newCategory !== previousCategory) {
      setCatRulePrompt({ description, category: newCategory });
    // Se mudou só a porcentagem, pergunta se quer criar regra de divisão
    } else if (newMyPct !== previousMyPct) {
      setSplitRulePrompt({ description, myPct: newMyPct });
    }
  }

  function openQuickEdit(tx: Transaction) {
    // Se ainda está salvando outra transação, guarda como pendente e aguarda
    if (isSavingQuickEditRef.current) {
      pendingQuickEditTxRef.current = tx;
      return;
    }
    const myPct = tx.split
      ? (isCurrentUserUser1 ? Number(tx.split.pctUser1) : Number(tx.split.pctUser2))
      : null;
    setQuickEditForm({
      date: format(new Date(tx.date), "yyyy-MM-dd"),
      description: tx.description,
      customName: tx.customName ?? "",
      category: tx.category ?? "",
      bankConnectionId: tx.bankConnectionId,
      amount: String(Number(tx.amount)),
      pct: tx.split?.isManualOverride ? myPct : null,
    });
    quickEditOriginalRef.current = {
      date: format(new Date(tx.date), "yyyy-MM-dd"),
      description: tx.description,
      customName: tx.customName ?? "",
      category: tx.category ?? "",
      bankConnectionId: tx.bankConnectionId,
      amount: String(Number(tx.amount)),
      pct: tx.split?.isManualOverride ? myPct : null,
    };
    setQuickEditTxId(tx.id);
    setQuickEditSplitOpen(false);
  }

  async function saveQuickEdit(tx: Transaction) {
    if (savingQuickEdit) return;
    setSavingQuickEdit(true);
    const previousCategory = tx.category ?? "";
    const previousMyPct = tx.split
      ? (isCurrentUserUser1 ? Number(tx.split.pctUser1) : Number(tx.split.pctUser2))
      : 50;
    const body: Record<string, unknown> = {
      date: quickEditForm.date,
      description: quickEditForm.description.trim() || tx.description,
      customName: quickEditForm.customName || null,
      category: quickEditForm.category || null,
      bankConnectionId: quickEditForm.bankConnectionId || tx.bankConnectionId,
      amount: Number(quickEditForm.amount) || Number(tx.amount),
    };
    if (quickEditForm.pct !== null) body.pctUser1 = quickEditForm.pct;
    await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    isSavingQuickEditRef.current = false;
    setSavingQuickEdit(false);
    setQuickEditTxId(null);
    toast.success("Transação salva");
    load(true);
    // Abre a transação que o usuário tentou clicar enquanto salvava
    const pending = pendingQuickEditTxRef.current;
    pendingQuickEditTxRef.current = null;
    if (pending) openQuickEdit(pending);
    const newCategory = quickEditForm.category.trim();
    const newMyPct = quickEditForm.pct ?? previousMyPct;
    if (newCategory && newCategory !== previousCategory) {
      setCatRulePrompt({ description: tx.description, category: newCategory });
    } else if (quickEditForm.pct !== null && newMyPct !== previousMyPct) {
      setSplitRulePrompt({ description: tx.description, myPct: newMyPct });
    }
  }

  async function createSplitRuleFromPrompt() {
    if (!splitRulePrompt) return;
    setSavingSplitRule(true);
    await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: splitRulePrompt.description,
        matchField: "DESCRIPTION",
        matchValue: splitRulePrompt.description,
        pctUser1: splitRulePrompt.myPct,
        priority: 0,
      }),
    });
    setSavingSplitRule(false);
    setSplitRulePrompt(null);
  }

  async function createCatRuleFromPrompt(applyToExisting = false) {
    if (!catRulePrompt) return;
    setSavingCatRule(true);
    await fetch("/api/category-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: catRulePrompt.description,
        matchValue: catRulePrompt.description,
        category: catRulePrompt.category,
      }),
    });
    if (applyToExisting) {
      await fetch("/api/transactions/bulk-category", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchValue: catRulePrompt.description,
          category: catRulePrompt.category,
        }),
      });
      load(true);
    }
    setSavingCatRule(false);
    setCatRulePrompt(null);
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

  // ── Delete all (test only) ───────────────────────────────────

  async function deleteAll() {
    const hasAccountFilter = selectedAccounts.length > 0;
    const accountNames = hasAccountFilter
      ? selectedAccounts.map((id) => {
          const b = bankConnections.find((b) => b.id === id);
          return b?.nickname ?? b?.bankName ?? id;
        }).join(", ")
      : null;
    const msg = hasAccountFilter
      ? `Apagar todas as transações de ${monthLabel(month)} das contas: ${accountNames}? Essa ação não pode ser desfeita.`
      : `Apagar todas as transações de ${monthLabel(month)}? Essa ação não pode ser desfeita.`;
    if (!confirm(msg)) return;
    setDeletingAll(true);
    try {
      const params = new URLSearchParams({ month });
      if (hasAccountFilter) selectedAccounts.forEach((id) => params.append("accountId", id));
      await fetch(`/api/transactions/delete-all?${params}`, { method: "DELETE" });
      load(true);
    } finally {
      setDeletingAll(false);
    }
  }

  // ── CSV import ───────────────────────────────────────────────

  function autoDetectBank(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const firstLine = (e.target?.result as string ?? "").split(/\r?\n/)[0].toLowerCase();
      const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const headers = norm(firstLine);

      const myConnections = bankConnections.filter(
        (b) => b.user.id === currentUserId || b.accountType === "SHARED"
      );

      let match: BankConnection | undefined;

      if (headers.includes("title") && headers.includes("amount")) {
        // Nubank credit: date,title,amount
        match = myConnections.find(
          (b) => b.bankName.toLowerCase().includes("nubank") && b.isCreditCard
        );
      } else if (headers.includes("identificador")) {
        // Nubank debit: Data,Valor,Identificador,Descrição
        match = myConnections.find(
          (b) => b.bankName.toLowerCase().includes("nubank") && !b.isCreditCard
        );
      } else if (headers.includes("detalhe") || headers.includes("lancamento")) {
        // Banco do Brasil
        match = myConnections.find((b) => b.bankName.toLowerCase().includes("brasil"));
      }

      if (match) setImportBankId(match.id);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!importFile || !importBankId) return;
    setImporting(true);
    setAnalyzing(true);
    setImportProgress(null);
    setDuplicateCheck(null);
    try {
      // Phase 1: check for duplicates
      const checkFd = new FormData();
      checkFd.append("file", importFile);
      checkFd.append("bankConnectionId", importBankId);
      checkFd.append("checkOnly", "true");
      const checkRes = await fetch("/api/transactions/import", { method: "POST", body: checkFd });
      setAnalyzing(false);
      if (!checkRes.ok) {
        const data = await checkRes.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao verificar arquivo.");
        return;
      }
      const check = await checkRes.json() as { total: number; duplicates: number };
      if (check.duplicates > 0) {
        // Show modal and wait for user choice
        setDuplicateCheck(check);
        setImporting(false);
        return;
      }
      // No duplicates: proceed directly
      await doImport(true);
    } catch {
      setAnalyzing(false);
      toast.error("Erro ao importar. Tente novamente.");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function doImport(skipDuplicates: boolean) {
    if (!importFile || !importBankId) return;
    setDuplicateCheck(null);
    setImporting(true);
    setImportProgress(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("bankConnectionId", importBankId);
      fd.append("skipDuplicates", skipDuplicates ? "true" : "false");
      const res = await fetch("/api/transactions/import", { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao importar.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "total") {
            setImportProgress({ processed: 0, total: msg.total });
          } else if (msg.type === "progress") {
            setImportProgress({ processed: msg.processed, total: msg.total });
          } else if (msg.type === "done") {
            setImportOpen(false);
            setImportFile(null);
            setImportBankId("");
            const skippedMsg = msg.skipped > 0 ? ` · ${msg.skipped} ignoradas` : "";
            toast.success(`${msg.imported} transações importadas${skippedMsg}`);
            load(true);
          }
        }
      }
    } catch {
      toast.error("Erro ao importar. Tente novamente.");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  // ── Derived values ───────────────────────────────────────────

  const categoryIconMap = Object.fromEntries(
    categories.map((c) => [c.name.toLowerCase(), c.icon])
  );
  const getCategoryIcon = (name: string) => categoryIconMap[name.toLowerCase()] ?? null;

  const filtered = transactions.filter((tx) => {
    if (hidePartnerPersonal && currentUserId && tx.owner.id !== currentUserId) {
      // Só oculta se o usuário logado tem 0% de participação
      const myAmount = isCurrentUserUser1 ? Number(tx.split?.amountUser1 ?? 0) : Number(tx.split?.amountUser2 ?? 0);
      if (myAmount === 0) return false;
    }
    if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.bankConnectionId)) return false;
    const search = filter.toLowerCase();
    return (
      tx.description.toLowerCase().includes(search) ||
      (tx.customName ?? "").toLowerCase().includes(search) ||
      (tx.category ?? "").toLowerCase().includes(search)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    else if (sortCol === "name") cmp = (a.customName ?? a.description).localeCompare(b.customName ?? b.description);
    else if (sortCol === "category") cmp = (a.category ?? "").localeCompare(b.category ?? "");
    else if (sortCol === "account") cmp = a.bankConnection.bankName.localeCompare(b.bankConnection.bankName);
    else if (sortCol === "total") cmp = Number(a.amount) - Number(b.amount);
    else if (sortCol === "my") {
      const aAmt = isCurrentUserUser1 ? Number(a.split?.amountUser1 ?? 0) : Number(a.split?.amountUser2 ?? 0);
      const bAmt = isCurrentUserUser1 ? Number(b.split?.amountUser1 ?? 0) : Number(b.split?.amountUser2 ?? 0);
      cmp = aAmt - bAmt;
    } else if (sortCol === "partner") {
      const aAmt = isCurrentUserUser1 ? Number(a.split?.amountUser2 ?? 0) : Number(a.split?.amountUser1 ?? 0);
      const bAmt = isCurrentUserUser1 ? Number(b.split?.amountUser2 ?? 0) : Number(b.split?.amountUser1 ?? 0);
      cmp = aAmt - bAmt;
    } else if (sortCol === "pct") {
      const aPct = isCurrentUserUser1 ? Number(a.split?.pctUser1 ?? 0) : Number(a.split?.pctUser2 ?? 0);
      const bPct = isCurrentUserUser1 ? Number(b.split?.pctUser1 ?? 0) : Number(b.split?.pctUser2 ?? 0);
      cmp = aPct - bPct;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const pendingCount = filtered.filter((tx) => tx.pendingReview).length;
  const confirmed = filtered.filter((tx) => !tx.pendingReview);
  const totalSpent = confirmed.reduce((s, tx) => s + Number(tx.amount), 0);

  // "gastou" = pagou do próprio bolso (transações que são suas)
  // "deve"   = saldo líquido: o que deve ao outro menos o que o outro deve a ele
  const mySpent   = confirmed.reduce((s, tx) => tx.owner.id === currentUserId ? s + Number(tx.amount) : s, 0);
  const partnerSpent = confirmed.reduce((s, tx) => tx.owner.id !== currentUserId ? s + Number(tx.amount) : s, 0);

  // Bruto: parte de cada um nas transações DO OUTRO
  const myGrossOwed = confirmed.filter((tx) => tx.owner.id !== currentUserId && tx.split)
    .reduce((s, tx) => s + Number(isCurrentUserUser1 ? tx.split!.amountUser1 : tx.split!.amountUser2), 0);
  const partnerGrossOwed = confirmed.filter((tx) => tx.owner.id === currentUserId && tx.split)
    .reduce((s, tx) => s + Number(isCurrentUserUser1 ? tx.split!.amountUser2 : tx.split!.amountUser1), 0);

  // Líquido: quem deve a quem depois de neteado
  const myOwed      = Math.max(0, myGrossOwed - partnerGrossOwed);
  const partnerOwed = Math.max(0, partnerGrossOwed - myGrossOwed);

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
          <Button size="sm" variant="destructive" onClick={deleteAll} disabled={deletingAll}>
            {deletingAll ? "Apagando..." : "Apagar tudo"}
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Card className="p-3">
          <p className="text-muted-foreground text-xs">Total gasto</p>
          {loading ? <Skeleton className="h-6 w-24 mt-1" /> : <p className="font-semibold text-base">{formatBRL(totalSpent)}</p>}
        </Card>
        <Card className="p-3">
          <p className="font-medium text-xs mb-1">{myNickname ?? "Eu"}</p>
          {loading ? (
            <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /></div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">gastou <span className="text-foreground font-medium">{formatBRL(mySpent)}</span></p>
              <p className="text-xs text-muted-foreground">deve <span className={`font-medium ${myOwed > 0 ? "text-orange-500" : "text-foreground"}`}>{formatBRL(myOwed)}</span></p>
            </div>
          )}
        </Card>
        <Card className="p-3">
          <p className="font-medium text-xs mb-1">{partnerNickname ?? "Parceiro(a)"}</p>
          {loading ? (
            <div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /></div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">gastou <span className="text-foreground font-medium">{formatBRL(partnerSpent)}</span></p>
              <p className="text-xs text-muted-foreground">deve <span className={`font-medium ${partnerOwed > 0 ? "text-orange-500" : "text-foreground"}`}>{formatBRL(partnerOwed)}</span></p>
            </div>
          )}
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

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Filtrar por nome, apelido ou categoria..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Popover open={accountFilterOpen} onOpenChange={setAccountFilterOpen}>
          <PopoverTrigger className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors">
            <Landmark className="size-4" />
            {selectedAccounts.length === 0
              ? "Todas as contas"
              : selectedAccounts.length === 1
                ? (bankConnections.find((b) => b.id === selectedAccounts[0])?.nickname ?? bankConnections.find((b) => b.id === selectedAccounts[0])?.bankName ?? "1 conta")
                : `${selectedAccounts.length} contas`}
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="space-y-1">
              <button
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-accent transition-colors ${selectedAccounts.length === 0 ? "font-medium" : ""}`}
                onClick={() => setSelectedAccounts([])}
              >
                <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${selectedAccounts.length === 0 ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                  {selectedAccounts.length === 0 && <Check className="size-3" />}
                </span>
                Todas as contas
              </button>
              <div className="my-1 border-t" />
              {bankConnections.map((b) => {
                const checked = selectedAccounts.includes(b.id);
                return (
                  <button
                    key={b.id}
                    className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-accent transition-colors"
                    onClick={() => {
                      setSelectedAccounts((prev) =>
                        prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                      );
                    }}
                  >
                    <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="flex items-center gap-1.5 min-w-0">
                      {b.color && <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />}
                      <span className="truncate">{b.nickname ?? b.bankName}</span>
                      {b.isCreditCard && <CreditCard className="size-3 shrink-0 text-muted-foreground" />}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{b.user.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant={hidePartnerPersonal ? "outline" : "secondary"}
          size="sm"
          onClick={() => setHidePartnerPersonal((v) => !v)}
          className="shrink-0 gap-1.5"
        >
          {hidePartnerPersonal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {hidePartnerPersonal ? "Pessoais ocultos" : "Ver todos"}
        </Button>
        <Button size="sm" onClick={addInlineRow} className="shrink-0">
          <Plus className="size-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {(["date", "name", "category", "account", "total", "my", "partner"] as const).map((col, i) => {
                  const labels: Record<string, string> = {
                    date: "Data", name: "Nome", category: "Categoria", account: "Conta",
                    total: "Total", my: myNickname ?? "Eu", partner: partnerNickname ?? "Parceiro(a)",
                  };
                  const isRight = ["total", "my", "partner"].includes(col);
                  const widths: Record<string, string> = {
                    date: "w-[110px] min-w-[110px]",
                    total: "w-[90px] min-w-[90px]",
                    my: "w-[80px] min-w-[80px]",
                    partner: "w-[80px] min-w-[80px]",
                  };
                  const active = sortCol === col;
                  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                  return (
                    <TableHead key={col} className={`${isRight ? "text-right" : ""} ${widths[col] ?? ""}`}>
                      <button
                        onClick={() => handleSort(col)}
                        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                      >
                        {labels[col]}
                        <Icon className="size-3 shrink-0" />
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead className="text-right">
                  {(() => {
                    const active = sortCol === "pct";
                    const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                    return (
                      <button
                        onClick={() => handleSort("pct")}
                        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                      >
                        %
                        <Icon className="size-3 shrink-0" />
                      </button>
                    );
                  })()}
                </TableHead>
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
                  {isSaving ? <SavingRow /> : (<>
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
                    {/* Descrição + Apelido */}
                    <TableCell className="py-2 max-w-[220px]">
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          className="h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Descrição..."
                          value={row.description}
                          onChange={(e) => updateInlineRow(row.uid, "description", e.target.value)}
                          onKeyDown={(e) => handleInlineKeyDown(e, row.uid, false)}
                          disabled={isSaving}
                        />
                        <input
                          type="text"
                          className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Apelido (opcional)..."
                          value={row.alias}
                          onChange={(e) => updateInlineRow(row.uid, "alias", e.target.value)}
                          onKeyDown={(e) => handleInlineKeyDown(e, row.uid, false)}
                          disabled={isSaving}
                        />
                      </div>
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
                        {bankConnections.filter((b) => b.user.id === currentUserId || b.accountType === "SHARED").map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nickname ?? b.bankName}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    {/* Valor */}
                    <TableCell className="py-1.5 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="R$ 0,00"
                        value={row.amount
                          ? `R$ ${Number(row.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          const numeric = digits ? (Number(digits) / 100).toString() : "";
                          updateInlineRow(row.uid, "amount", numeric);
                        }}
                        onKeyDown={(e) => handleInlineKeyDown(e, row.uid, true)}
                        disabled={isSaving}
                      />
                    </TableCell>
                    {/* Eu / Parceira / % — divisão opcional */}
                    {(() => {
                      const conn = bankConnections.find((b) => b.id === row.bankConnectionId);
                      const isShared = conn?.accountType === "SHARED";
                      const defaultPct = isShared ? 50 : 100;
                      const effectivePct = row.pct !== null ? row.pct : defaultPct;
                      const amount = Number(row.amount) || 0;
                      const myAmt = amount * effectivePct / 100;
                      const partnerAmt = amount - myAmt;
                      return (<>
                        <TableCell className="text-right text-xs py-1.5">
                          {formatBRL(myAmt)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground py-1.5">
                          {formatBRL(partnerAmt)}
                        </TableCell>
                        <TableCell className="text-right py-1.5">
                      {isSaving ? (
                        <span className="text-xs text-muted-foreground">...</span>
                      ) : (
                        <Popover
                          open={inlineSplitOpenUid === row.uid}
                          onOpenChange={(open) => setInlineSplitOpenUid(open ? row.uid : null)}
                        >
                          <PopoverTrigger className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer tabular-nums">
                            {effectivePct}/{100 - effectivePct}
                          </PopoverTrigger>
                          <PopoverContent side="left" className="w-64 p-4 space-y-3">
                            <p className="text-xs font-medium">Divisão</p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium">{myNickname ?? "Você"}: {row.pct ?? 50}%</span>
                                <span className="text-muted-foreground">{partnerNickname ?? "Parceiro(a)"}: {100 - (row.pct ?? 50)}%</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={row.pct ?? 50}
                                onChange={(e) => setInlineRows((prev) =>
                                  prev.map((r) => r.uid === row.uid ? { ...r, pct: Number(e.target.value) } : r)
                                )}
                                className="w-full accent-primary"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>0%</span>
                                <span>50%</span>
                                <span>100%</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                                onClick={() => {
                                  setInlineRows((prev) => prev.map((r) => r.uid === row.uid ? { ...r, pct: null } : r));
                                  setInlineSplitOpenUid(null);
                                }}
                              >
                                Automático
                              </button>
                              <Button size="sm" className="h-7 text-xs" onClick={() => setInlineSplitOpenUid(null)}>
                                OK
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                        </TableCell>
                      </>);
                    })()}
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
                  </>)}
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
                sorted.map((tx) => {
                  /* ── Delete confirmation / deleting row ── */
                  if (deletingTxId === tx.id) {
                    return (
                      <TableRow key={tx.id} className="bg-red-50 hover:bg-red-50">
                        <SavingRow label="Excluindo" />
                      </TableRow>
                    );
                  }
                  if (confirmDeleteTxId === tx.id) {
                    return (
                      <TableRow key={tx.id} className="bg-red-50 hover:bg-red-50">
                        <ConfirmDeleteRow
                          name={tx.customName ?? tx.description}
                          onConfirm={() => deleteTransaction(tx)}
                          onCancel={() => setConfirmDeleteTxId(null)}
                        />
                      </TableRow>
                    );
                  }

                  /* ── Quick-edit inline row ── */
                  if (quickEditTxId === tx.id) {
                    const isOwner = tx.owner.id === currentUserId;
                    const conn = bankConnections.find((b) => b.id === quickEditForm.bankConnectionId);
                    const isShared = conn?.accountType === "SHARED";
                    const defaultPct = isShared ? 50 : 100;
                    const effectivePct = quickEditForm.pct !== null ? quickEditForm.pct : defaultPct;
                    const amount = Number(quickEditForm.amount) || 0;
                    const myAmt = amount * effectivePct / 100;
                    const partnerAmt = amount - myAmt;
                    return (
                      <TableRow key={tx.id} ref={quickEditRowRef} className="bg-blue-50 hover:bg-blue-50">
                      {savingQuickEdit ? <SavingRow /> : (<>
                        {/* Data */}
                        <TableCell className="py-1.5">
                          <input
                            type="date"
                            className="h-7 w-28 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            value={quickEditForm.date}
                            onChange={(e) => setQuickEditForm((f) => ({ ...f, date: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Escape") setQuickEditTxId(null); if (e.key === "Enter") saveQuickEdit(tx); }}
                            disabled={savingQuickEdit}
                          />
                        </TableCell>
                        {/* Descrição + Apelido */}
                        <TableCell className="py-2 max-w-[220px]">
                          <div className="flex flex-col gap-1 overflow-hidden">
                            <input
                              autoFocus
                              type="text"
                              className="h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              placeholder="Descrição..."
                              value={quickEditForm.description}
                              onChange={(e) => setQuickEditForm((f) => ({ ...f, description: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Escape") setQuickEditTxId(null); if (e.key === "Enter") saveQuickEdit(tx); }}
                              disabled={savingQuickEdit}
                            />
                            <input
                              type="text"
                              className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              placeholder="Apelido (opcional)..."
                              value={quickEditForm.customName}
                              onChange={(e) => setQuickEditForm((f) => ({ ...f, customName: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Escape") setQuickEditTxId(null); if (e.key === "Enter") saveQuickEdit(tx); }}
                              disabled={savingQuickEdit}
                            />
                          </div>
                        </TableCell>
                        {/* Categoria */}
                        <TableCell className="py-1.5 min-w-[160px]">
                          <CategoryCombobox
                            categories={categories}
                            value={quickEditForm.category}
                            onChange={(v) => setQuickEditForm((f) => ({ ...f, category: v }))}
                            placeholder="Categoria..."
                            onCreateNew={async (name) => {
                              await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
                              load(true);
                            }}
                          />
                        </TableCell>
                        {/* Conta */}
                        <TableCell className="py-1.5">
                          <select
                            className="h-7 w-32 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            value={quickEditForm.bankConnectionId}
                            onChange={(e) => setQuickEditForm((f) => ({ ...f, bankConnectionId: e.target.value }))}
                            disabled={savingQuickEdit}
                          >
                            {bankConnections.filter((b) => b.user.id === currentUserId || b.accountType === "SHARED").map((b) => (
                              <option key={b.id} value={b.id}>{b.nickname ?? b.bankName}</option>
                            ))}
                          </select>
                        </TableCell>
                        {/* Valor */}
                        <TableCell className="py-1.5 text-right">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="R$ 0,00"
                            value={quickEditForm.amount
                              ? `R$ ${Number(quickEditForm.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : ""}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              const numeric = digits ? (Number(digits) / 100).toString() : "";
                              setQuickEditForm((f) => ({ ...f, amount: numeric }));
                            }}
                            onKeyDown={(e) => { if (e.key === "Escape") setQuickEditTxId(null); if (e.key === "Enter") saveQuickEdit(tx); }}
                            disabled={savingQuickEdit}
                          />
                        </TableCell>
                        {/* Vini / Pati / % */}
                        <TableCell className="text-right text-xs py-1.5">{formatBRL(myAmt)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground py-1.5">{formatBRL(partnerAmt)}</TableCell>
                        <TableCell className="text-right py-1.5">
                          {savingQuickEdit ? (
                            <span className="text-xs text-muted-foreground">...</span>
                          ) : isOwner ? (
                            <Popover open={quickEditSplitOpen} onOpenChange={setQuickEditSplitOpen}>
                              <PopoverTrigger className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer tabular-nums">
                                {effectivePct}/{100 - effectivePct}
                              </PopoverTrigger>
                              <PopoverContent side="left" className="w-64 p-4 space-y-3">
                                <p className="text-xs font-medium">Divisão</p>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs">
                                    <span className="font-medium">{myNickname ?? "Você"}: {effectivePct}%</span>
                                    <span className="text-muted-foreground">{partnerNickname ?? "Parceiro(a)"}: {100 - effectivePct}%</span>
                                  </div>
                                  <input type="range" min={0} max={100} value={effectivePct}
                                    onChange={(e) => setQuickEditForm((f) => ({ ...f, pct: Number(e.target.value) }))}
                                    className="w-full accent-primary" />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>0%</span><span>50%</span><span>100%</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <button className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                                    onClick={() => { setQuickEditForm((f) => ({ ...f, pct: null })); setQuickEditSplitOpen(false); }}>
                                    Automático
                                  </button>
                                  <Button size="sm" className="h-7 text-xs" onClick={() => setQuickEditSplitOpen(false)}>OK</Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : null}
                        </TableCell>
                        {/* Ações */}
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="size-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Salvar (Enter)" onClick={() => saveQuickEdit(tx)} disabled={savingQuickEdit}>
                              <Check className="size-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                              title="Cancelar (Esc)" onClick={() => setQuickEditTxId(null)} disabled={savingQuickEdit}>
                              <X className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </>)}
                      </TableRow>
                    );
                  }

                  /* ── Normal row ── */
                  return (
                  <TableRow key={tx.id} className={tx.pendingReview ? "bg-yellow-50 hover:bg-yellow-100" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(tx.date), "dd/MM")}
                    </TableCell>
                    <TableCell className="max-w-[220px] cursor-pointer" onClick={() => openQuickEdit(tx)}>
                      {tx.customName ? (
                        <>
                          <p className="text-sm font-medium truncate">{tx.customName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {transactionTypeLabel(tx.description) ?? shortPixLabel(tx.description)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm truncate">{shortPixLabel(tx.description)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{tx.owner.name}</p>
                      {tx.notes && isInstallmentNote(tx.notes) ? (
                        <p className={`text-xs font-medium ${isLastInstallment(tx.notes) ? "text-amber-600" : "text-muted-foreground"}`}>
                          {tx.notes}{isLastInstallment(tx.notes) ? " ✓" : ""}
                        </p>
                      ) : tx.notes ? (
                        <p className="text-xs text-muted-foreground italic truncate">{tx.notes}</p>
                      ) : null}
                      {tx.pendingReview && (
                        <Badge className="text-xs mt-0.5 bg-yellow-100 text-yellow-800 border-yellow-300" variant="outline">
                          Revisão pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="cursor-pointer" onClick={() => openQuickEdit(tx)}>
                      {tx.category ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          {getCategoryIcon(tx.category) && <span>{getCategoryIcon(tx.category)}</span>}
                          {tx.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium truncate max-w-[110px]"
                        style={tx.bankConnection.color
                          ? { backgroundColor: tx.bankConnection.color, color: "#444" }
                          : { backgroundColor: "#e5e7eb", color: "#6b7280" }
                        }
                      >
                        {tx.bankConnection.nickname ?? tx.bankConnection.bankName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatBRL(Number(tx.amount))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {tx.split
                        ? formatBRL(Number(isCurrentUserUser1 ? tx.split.amountUser1 : tx.split.amountUser2))
                        : formatBRL(Number(tx.amount))}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {tx.split
                        ? formatBRL(Number(isCurrentUserUser1 ? tx.split.amountUser2 : tx.split.amountUser1))
                        : formatBRL(0)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {tx.split ? (() => {
                        const myPct = isCurrentUserUser1 ? Number(tx.split.pctUser1) : Number(tx.split.pctUser2);
                        const isOpen = splitPopover?.txId === tx.id;
                        const displayPct = isOpen ? splitPopover!.pct : myPct;
                        const hasRule = !tx.split.isManualOverride && !!tx.split.appliedRule;
                        const hasOverride = tx.split.isManualOverride;
                        const isOwner = tx.owner.id === currentUserId;
                        const colorClass = hasOverride ? "text-orange-500" : hasRule ? "text-blue-500" : "text-muted-foreground";

                        if (!isOwner) return (
                          <span className={`font-medium tabular-nums ${colorClass}`}>
                            {Number(tx.split.pctUser1)}/{Number(tx.split.pctUser2)}
                          </span>
                        );

                        return (
                          <Popover
                            open={isOpen}
                            onOpenChange={(open) => {
                              if (open) {
                                setSplitPopover({ txId: tx.id, pct: myPct, originalPct: myPct });
                              } else {
                                if (splitPopover) saveSplitPopover(splitPopover.txId, splitPopover.pct, splitPopover.originalPct, tx.description);
                                setSplitPopover(null);
                              }
                            }}
                          >
                            <PopoverTrigger className={`cursor-pointer font-medium tabular-nums rounded px-1 py-0.5 hover:bg-muted transition-colors ${colorClass}`}>
                              {savingSplitTxId === tx.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <svg className="animate-spin size-3" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                  </svg>
                                </span>
                              ) : (
                                <>{Number(tx.split.pctUser1)}/{Number(tx.split.pctUser2)}</>
                              )}
                            </PopoverTrigger>
                            <PopoverContent side="left" className="w-64 p-4 space-y-3">
                              <div className="space-y-1">
                                <p className="text-xs font-medium">Divisão rápida</p>
                                {hasRule && !hasOverride && (
                                  <p className="text-xs text-blue-500">Regra: {tx.split.appliedRule!.name}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{myNickname ?? "Você"}: {isOpen ? splitPopover!.pct : myPct}%</span>
                                  <span>{partnerNickname ?? "Parceiro(a)"}: {100 - (isOpen ? splitPopover!.pct : myPct)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={isOpen ? splitPopover!.pct : myPct}
                                  onChange={(e) => setSplitPopover((prev) => prev ? { ...prev, pct: Number(e.target.value) } : null)}
                                  className="w-full accent-primary"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>0%</span>
                                  <span>50%</span>
                                  <span>100%</span>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">Clique fora para salvar</p>
                            </PopoverContent>
                          </Popover>
                        );
                      })() : <span className="text-muted-foreground">—</span>}
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
                        tx.owner.id === currentUserId ? (
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(tx)}>
                              <Info className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => { setQuickEditTxId(null); setConfirmDeleteTxId(tx.id); }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        ) : null
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mais informações</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              {(() => {
                const pix = parsePixDescription(editing.description);
                if (pix) {
                  return (
                    <div className="bg-muted/50 rounded p-3 space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Pix {pix.direction}
                      </p>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        <span className="text-muted-foreground text-xs">{pix.direction === "enviada" ? "Para" : "De"}</span>
                        <span className="font-medium truncate">{pix.name}</span>
                        {pix.document && <>
                          <span className="text-muted-foreground text-xs">Doc</span>
                          <span className="text-xs">{pix.document}</span>
                        </>}
                        {pix.bank && <>
                          <span className="text-muted-foreground text-xs">Banco</span>
                          <span className="text-xs truncate">{pix.bank}</span>
                        </>}
                        {pix.agency && <>
                          <span className="text-muted-foreground text-xs">Ag / Conta</span>
                          <span className="text-xs">{pix.agency} / {pix.account}</span>
                        </>}
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">
                        {formatBRL(Number(editing.amount))} · {format(new Date(editing.date), "dd/MM/yyyy")}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="bg-muted/50 rounded p-3">
                    <p className="text-xs text-muted-foreground">Nome original do banco</p>
                    <p className="text-sm font-medium">{editing.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatBRL(Number(editing.amount))} · {format(new Date(editing.date), "dd/MM/yyyy")}
                    </p>
                  </div>
                );
              })()}
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
                  <span>{myNickname ?? "Eu"}: {formatBRL(Number(editing.amount) * Number(editPct) / 100)}</span>
                  <span>{partnerNickname ?? "Parceiro(a)"}: {formatBRL(Number(editing.amount) * (100 - Number(editPct)) / 100)}</span>
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

      {/* Split rule prompt */}
      <Dialog open={!!splitRulePrompt} onOpenChange={(open) => { if (!open) setSplitRulePrompt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar regra de divisão?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja que próximas compras com o nome{" "}
            <strong className="text-foreground">&quot;{splitRulePrompt?.description}&quot;</strong>{" "}
            sejam divididas automaticamente como{" "}
            <strong className="text-foreground">
              {isCurrentUserUser1
                ? `você: ${splitRulePrompt?.myPct}% / parceiro(a): ${100 - (splitRulePrompt?.myPct ?? 0)}%`
                : `parceiro(a): ${100 - (splitRulePrompt?.myPct ?? 0)}% / você: ${splitRulePrompt?.myPct}%`}
            </strong>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSplitRulePrompt(null)}>Não</Button>
            <Button onClick={createSplitRuleFromPrompt} disabled={savingSplitRule}>
              {savingSplitRule ? "Criando..." : "Sim, criar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category rule prompt */}
      <Dialog open={!!catRulePrompt} onOpenChange={(open) => { if (!open) setCatRulePrompt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar regra automática?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja que próximas compras com o nome{" "}
            <strong className="text-foreground">&quot;{catRulePrompt?.description}&quot;</strong>{" "}
            sejam categorizadas automaticamente como{" "}
            <strong className="text-foreground">{catRulePrompt?.category}</strong>?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => createCatRuleFromPrompt(true)} disabled={savingCatRule} className="w-full">
              {savingCatRule ? "Aplicando..." : "Sim, para todas as compras"}
            </Button>
            <Button variant="outline" onClick={() => createCatRuleFromPrompt(false)} disabled={savingCatRule} className="w-full">
              Sim, só para as próximas
            </Button>
            <Button variant="ghost" onClick={() => setCatRulePrompt(null)} disabled={savingCatRule} className="w-full">
              Não
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setDuplicateCheck(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importar extrato (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporte o extrato do seu banco em CSV. O arquivo precisa ter colunas de <strong>data</strong>, <strong>descrição</strong> e <strong>valor</strong>.
            </p>
            <div className="space-y-2">
              <Label>Conta</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={importBankId}
                onChange={(e) => setImportBankId(e.target.value)}
              >
                <option value="">Selecionar conta...</option>
                {bankConnections.map((b) => (
                  <option key={b.id} value={b.id}>
                    {(b.nickname ?? b.bankName)}{b.accountType === "SHARED" ? " (Compartilhada)" : ""}{b.user.id !== currentUserId ? ` — ${b.user.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo CSV</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => fileInputRef.current?.click()}>
                {importFile ? (
                  <div>
                    <p className="text-sm font-medium">{importFile.name}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar</p>
                    <p className="text-xs text-muted-foreground mt-1">.csv, .txt</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setImportFile(file);
                if (file) autoDetectBank(file);
              }} />
            </div>
            {analyzing && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Analisando transações...</p>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: "40%", animation: "indeterminate 1.4s ease-in-out infinite" }} />
                </div>
              </div>
            )}
            {importProgress && !analyzing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Importando transações...</span>
                  <span>{importProgress.processed} / {importProgress.total}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          {duplicateCheck && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <p className="text-sm font-medium text-amber-900">
                Encontrei {duplicateCheck.duplicates} transaç{duplicateCheck.duplicates === 1 ? "ão idêntica" : "ões idênticas"} às já cadastradas
                {duplicateCheck.total > duplicateCheck.duplicates && ` (de ${duplicateCheck.total} no arquivo)`}.
              </p>
              <p className="text-xs text-amber-700">O que deseja fazer com elas?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => doImport(true)}>
                  Ignorar duplicatas
                </Button>
                <Button size="sm" onClick={() => doImport(false)}>
                  Adicionar mesmo assim
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Fechar</Button>
            <Button onClick={runImport} disabled={importing || !importFile || !importBankId || !!duplicateCheck}>
              {importing ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
