"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { TagInput } from "@/components/ui/tag-input";
import { PRIMARY_CATEGORY_RULES } from "@/lib/primary-rules";

interface SplitRule {
  id: string;
  name: string;
  matchField: string;
  matchValue: string;
  pctUser1: number;
  pctUser2: number;
  priority: number;
  isActive: boolean;
  creatorIsUser1: boolean;
  userId: string | null;
}

interface CategoryRule {
  id: string;
  name: string;
  matchValue: string;
  category: string;
  isActive: boolean;
  userId: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  CATEGORY: "Categoria",
  DESCRIPTION: "Descrição contém",
  ACCOUNT_TYPE: "Tipo de conta",
};

export default function RegrasPage() {
  // ── Split rules state ─────────────────────────────────────────
  const [splitRules, setSplitRules] = useState<SplitRule[]>([]);
  const [splitLoading, setSplitLoading] = useState(true);
  const [splitOpen, setSplitOpen] = useState(false);
  const [editingSplit, setEditingSplit] = useState<SplitRule | null>(null);
  const [isCurrentUserUser1, setIsCurrentUserUser1] = useState(true);
  const [user1Name, setUser1Name] = useState<string | null>(null);
  const [user2Name, setUser2Name] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [splitForm, setSplitForm] = useState({
    name: "",
    matchField: "CATEGORY",
    matchValue: "",
    pctUser1: 50,
    priority: 0,
  });

  // ── Category rules state ──────────────────────────────────────
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryRule | null>(null);
  const [catForm, setCatForm] = useState({ name: "", matchValue: [] as string[], category: "" });

  // ── Shared ────────────────────────────────────────────────────
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string | null }[]>([]);

  const loadSplitRules = useCallback(async () => {
    setSplitLoading(true);
    const [rulesRes, catRes] = await Promise.all([fetch("/api/rules"), fetch("/api/categories")]);
    const [rulesData, catData] = await Promise.all([rulesRes.json(), catRes.json()]);
    setSplitRules(rulesData.rules ?? []);
    if (rulesData.isCurrentUserUser1 !== undefined) setIsCurrentUserUser1(rulesData.isCurrentUserUser1);
    if (rulesData.user1Name) setUser1Name(rulesData.user1Name);
    if (rulesData.user2Name) setUser2Name(rulesData.user2Name);
    if (rulesData.currentUserId) setCurrentUserId(rulesData.currentUserId);
    setCategories(catData.categories ?? []);
    setSplitLoading(false);
  }, []);

  const loadCategoryRules = useCallback(async () => {
    setCatLoading(true);
    const res = await fetch("/api/category-rules");
    const data = await res.json();
    setCategoryRules(data.rules ?? []);
    setCatLoading(false);
  }, []);

  useEffect(() => {
    loadSplitRules();
    loadCategoryRules();
  }, [loadSplitRules, loadCategoryRules]);

  // ── Split rule actions ────────────────────────────────────────
  function openCreateSplit() {
    setEditingSplit(null);
    setSplitForm({ name: "", matchField: "CATEGORY", matchValue: "", pctUser1: 50, priority: 0 });
    setSplitOpen(true);
  }

  function openEditSplit(rule: SplitRule) {
    setEditingSplit(rule);
    const myPct = isCurrentUserUser1 ? Number(rule.pctUser1) : Number(rule.pctUser2);
    setSplitForm({ name: rule.name, matchField: rule.matchField, matchValue: rule.matchValue, pctUser1: myPct, priority: rule.priority });
    setSplitOpen(true);
  }

  async function saveSplit() {
    setSplitOpen(false);
    setSplitLoading(true);
    if (editingSplit) {
      await fetch(`/api/rules/${editingSplit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(splitForm) });
    } else {
      await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(splitForm) });
    }
    loadSplitRules();
  }

  async function toggleSplit(rule: SplitRule) {
    setSplitLoading(true);
    await fetch(`/api/rules/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !rule.isActive }) });
    loadSplitRules();
  }

  async function deleteSplit(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    loadSplitRules();
  }

  // ── Category rule actions ─────────────────────────────────────
  function openCreateCat() {
    setEditingCat(null);
    setCatForm({ name: "", matchValue: [], category: "" });
    setCatOpen(true);
  }

  function openEditCat(rule: CategoryRule) {
    setEditingCat(rule);
    const tags = rule.matchValue.split(",").map((t) => t.trim()).filter(Boolean);
    setCatForm({ name: rule.name, matchValue: tags, category: rule.category });
    setCatOpen(true);
  }

  async function saveCat() {
    setCatOpen(false);
    setCatLoading(true);
    if (editingCat) {
      await fetch(`/api/category-rules/${editingCat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catForm) });
    } else {
      await fetch("/api/category-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catForm) });
    }
    loadCategoryRules();
  }

  async function toggleCat(rule: CategoryRule) {
    setCatLoading(true);
    await fetch(`/api/category-rules/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !rule.isActive }) });
    loadCategoryRules();
  }

  async function deleteCat(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await fetch(`/api/category-rules/${id}`, { method: "DELETE" });
    loadCategoryRules();
  }

  async function refreshCategories() {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Regras</h1>
        <p className="text-muted-foreground text-sm">Automatize como as transações são divididas e categorizadas</p>
      </div>

      <Tabs defaultValue="divisao">
        <TabsList>
          <TabsTrigger value="divisao">Regras de Divisão</TabsTrigger>
          <TabsTrigger value="categoria">Regras de Categoria</TabsTrigger>
          <TabsTrigger value="primarias">Regras primárias</TabsTrigger>
        </TabsList>

        {/* ── Aba Divisão ─────────────────────────────────────────── */}
        <TabsContent value="divisao" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Regras com maior prioridade são aplicadas primeiro</p>
            <Button onClick={openCreateSplit} size="sm">
              <Plus className="size-4 mr-2" />
              Nova regra
            </Button>
          </div>

          <Card className="bg-muted/40">
            <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
              <p><strong>Padrão — Conta compartilhada:</strong> 50% / 50%</p>
              <p><strong>Padrão — Conta pessoal:</strong> 100% / 0% (editável por transação)</p>
            </CardContent>
          </Card>

          {splitLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-56 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="flex gap-1">
                    <div className="size-7 animate-pulse rounded bg-muted" />
                    <div className="size-7 animate-pulse rounded bg-muted" />
                    <div className="size-7 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : splitRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma regra criada ainda.</p>
              <p className="text-sm mt-1">Crie regras para automatizar a divisão (ex: gasolina = 80% você).</p>
            </div>
          ) : (
            <div className="space-y-2">
              {splitRules.map((rule) => (
                <div key={rule.id} className={`flex items-center gap-4 p-4 rounded-lg border transition-opacity ${rule.isActive ? "" : "opacity-50"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{rule.name}</p>
                      {rule.priority > 0 && <Badge variant="secondary" className="text-xs">prioridade {rule.priority}</Badge>}
                      {!rule.isActive && <Badge variant="outline" className="text-xs">inativa</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {FIELD_LABELS[rule.matchField]} &quot;{rule.matchValue}&quot;
                      {" → "}
                      {rule.creatorIsUser1
                        ? <><strong>{user1Name ?? "você"}: {Number(rule.pctUser1)}%</strong> / {user2Name ?? "parceiro(a)"}: {Number(rule.pctUser2)}%</>
                        : <>{user1Name ?? "você"}: {Number(rule.pctUser1)}% / <strong>{user2Name ?? "parceiro(a)"}: {Number(rule.pctUser2)}%</strong></>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {rule.userId === currentUserId && (<>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => toggleSplit(rule)}>
                        {rule.isActive ? <ToggleRight className="size-4 text-green-600" /> : <ToggleLeft className="size-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditSplit(rule)}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deleteSplit(rule.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Aba Categoria ────────────────────────────────────────── */}
        <TabsContent value="categoria" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Categoriza automaticamente ao importar transações</p>
            <Button onClick={openCreateCat} size="sm">
              <Plus className="size-4 mr-2" />
              Nova regra
            </Button>
          </div>

          {catLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-56 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="flex gap-1">
                    <div className="size-7 animate-pulse rounded bg-muted" />
                    <div className="size-7 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : categoryRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma regra criada ainda.</p>
              <p className="text-sm mt-1">Ex: se contiver &quot;CIA SUCOS&quot; → categoria Lanche.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryRules.map((rule) => (
                <div key={rule.id} className={`flex items-center gap-4 p-4 rounded-lg border transition-opacity ${rule.isActive ? "" : "opacity-50"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{rule.name}</p>
                      {!rule.isActive && <Badge variant="outline" className="text-xs">inativa</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                      {rule.matchValue.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                        <span key={t} className="inline-flex rounded bg-secondary text-secondary-foreground px-1.5 py-0.5 text-xs">{t}</span>
                      ))}
                      <span>→ <span className="text-primary font-medium">{rule.category}</span></span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => toggleCat(rule)}>
                      {rule.isActive ? <ToggleRight className="size-4 text-green-600" /> : <ToggleLeft className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditCat(rule)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deleteCat(rule.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Aba Regras Primárias ─────────────────────────────────── */}
        <TabsContent value="primarias" className="space-y-4 mt-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Lock className="size-4 mt-0.5 shrink-0" />
            <p>
              Estas regras vêm pré-cadastradas no sistema. Elas são aplicadas automaticamente, mas{" "}
              <strong className="text-foreground">suas regras sempre têm prioridade</strong> — se você criar uma regra de categoria que conflite com uma regra primária, a sua prevalece.
            </p>
          </div>

          <div className="space-y-2">
            {PRIMARY_CATEGORY_RULES.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 p-4 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{rule.name}</p>
                    <Badge variant="secondary" className="text-xs">sistema</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                    {rule.matchValue.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="inline-flex rounded bg-secondary text-secondary-foreground px-1.5 py-0.5 text-xs">{t}</span>
                    ))}
                    <span>→ <span className="text-primary font-medium">{rule.category}</span></span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Regra de Divisão ──────────────────────────────── */}
      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingSplit ? "Editar regra de divisão" : "Nova regra de divisão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da regra</Label>
              <Input value={splitForm.name} onChange={(e) => setSplitForm({ ...splitForm, name: e.target.value })} placeholder="Ex: Gasolina" />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-2">
                <Label>Quando o campo</Label>
                <Select value={splitForm.matchField} onValueChange={(v) => v && setSplitForm({ ...splitForm, matchField: v, matchValue: "" })}>
                  <SelectTrigger><SelectValue>{FIELD_LABELS[splitForm.matchField]}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CATEGORY">Categoria</SelectItem>
                    <SelectItem value="DESCRIPTION">Descrição contém</SelectItem>
                    <SelectItem value="ACCOUNT_TYPE">Tipo de conta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>For igual a</Label>
                {splitForm.matchField === "CATEGORY" ? (
                  <CategoryCombobox categories={categories} value={splitForm.matchValue} onChange={(v) => setSplitForm({ ...splitForm, matchValue: v })}
                    onCreateNew={async (name) => {
                      await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
                      refreshCategories();
                    }} />
                ) : splitForm.matchField === "ACCOUNT_TYPE" ? (
                  <Select value={splitForm.matchValue} onValueChange={(v) => v && setSplitForm({ ...splitForm, matchValue: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar tipo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHARED">Compartilhada</SelectItem>
                      <SelectItem value="PERSONAL">Pessoal</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={splitForm.matchValue} onChange={(e) => setSplitForm({ ...splitForm, matchValue: e.target.value })} placeholder="Ex: amazon, netflix..." />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Minha porcentagem: <strong>{splitForm.pctUser1}%</strong></Label>
              <input type="range" min={0} max={100} value={splitForm.pctUser1} onChange={(e) => setSplitForm({ ...splitForm, pctUser1: Number(e.target.value) })} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{isCurrentUserUser1 ? (user1Name ?? "Você") : (user2Name ?? "Você")}: {splitForm.pctUser1}%</span>
                <span>{isCurrentUserUser1 ? (user2Name ?? "Parceiro(a)") : (user1Name ?? "Parceiro(a)")}: {100 - splitForm.pctUser1}%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancelar</Button>
            <Button onClick={saveSplit} disabled={!splitForm.name || !splitForm.matchValue}>
              {editingSplit ? "Salvar" : "Criar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Regra de Categoria ────────────────────────────── */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar regra de categoria" : "Nova regra de categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da regra</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ex: Suco da CIA" />
            </div>
            <div className="space-y-2">
              <Label>Se contiver no nome</Label>
              <TagInput value={catForm.matchValue} onChange={(tags) => setCatForm({ ...catForm, matchValue: tags })} placeholder="Ex: suco, sucos, cia do suco..." />
              <p className="text-xs text-muted-foreground">Digite um termo e pressione vírgula ou Enter para adicionar mais.</p>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <CategoryCombobox categories={categories} value={catForm.category} onChange={(v) => setCatForm({ ...catForm, category: v })}
                onCreateNew={async (name) => {
                  await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
                  refreshCategories();
                  setCatForm({ ...catForm, category: name });
                }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button onClick={saveCat} disabled={!catForm.name || catForm.matchValue.length === 0 || !catForm.category}>
              {editingCat ? "Salvar" : "Criar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
