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
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryCombobox } from "@/components/ui/category-combobox";

interface Rule {
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

const FIELD_LABELS: Record<string, string> = {
  CATEGORY: "Categoria",
  DESCRIPTION: "Descrição contém",
  ACCOUNT_TYPE: "Tipo de conta",
};

export default function RegrasPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [isCurrentUserUser1, setIsCurrentUserUser1] = useState(true);
  const [user1Name, setUser1Name] = useState<string | null>(null);
  const [user2Name, setUser2Name] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    matchField: "CATEGORY",
    matchValue: "",
    pctUser1: 50,
    priority: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [rulesRes, catRes] = await Promise.all([
      fetch("/api/rules"),
      fetch("/api/categories"),
    ]);
    const [rulesData, catData] = await Promise.all([rulesRes.json(), catRes.json()]);
    setRules(rulesData.rules ?? []);
    if (rulesData.isCurrentUserUser1 !== undefined) setIsCurrentUserUser1(rulesData.isCurrentUserUser1);
    if (rulesData.user1Name) setUser1Name(rulesData.user1Name);
    if (rulesData.user2Name) setUser2Name(rulesData.user2Name);
    if (rulesData.currentUserId) setCurrentUserId(rulesData.currentUserId);
    setCategories(catData.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", matchField: "CATEGORY", matchValue: "", pctUser1: 50, priority: 0 });
    setOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditing(rule);
    // Mostrar a pct do usuário atual: user1 vê pctUser1, user2 vê pctUser2
    const myPct = isCurrentUserUser1 ? Number(rule.pctUser1) : Number(rule.pctUser2);
    setForm({
      name: rule.name,
      matchField: rule.matchField,
      matchValue: rule.matchValue,
      pctUser1: myPct,
      priority: rule.priority,
    });
    setOpen(true);
  }

  async function save() {
    setOpen(false);
    setLoading(true);
    if (editing) {
      await fetch(`/api/rules/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    load();
  }

  async function toggleActive(rule: Rule) {
    setLoading(true);
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    load();
  }

  async function deleteRule(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Regras de Divisão</h1>
          <p className="text-muted-foreground text-sm">
            Regras com maior prioridade são aplicadas primeiro
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4 mr-2" />
          Nova regra
        </Button>
      </div>

      {/* Default rules info */}
      <Card className="bg-muted/40">
        <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
          <p><strong>Padrão — Conta compartilhada:</strong> 50% / 50%</p>
          <p><strong>Padrão — Conta pessoal:</strong> 100% / 0% (editável por transação)</p>
        </CardContent>
      </Card>

      {loading ? (
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
      ) : rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhuma regra criada ainda.</p>
          <p className="text-sm mt-1">Crie regras para automatizar a divisão (ex: gasolina = 80% você).</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-opacity ${rule.isActive ? "" : "opacity-50"}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{rule.name}</p>
                  {rule.priority > 0 && (
                    <Badge variant="secondary" className="text-xs">prioridade {rule.priority}</Badge>
                  )}
                  {!rule.isActive && (
                    <Badge variant="outline" className="text-xs">inativa</Badge>
                  )}
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
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => toggleActive(rule)}>
                    {rule.isActive
                      ? <ToggleRight className="size-4 text-green-600" />
                      : <ToggleLeft className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(rule)}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar regra" : "Nova regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da regra</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Gasolina"
              />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-2">
                <Label>Quando o campo</Label>
                <Select value={form.matchField} onValueChange={(v) => v && setForm({ ...form, matchField: v, matchValue: "" })}>
                  <SelectTrigger>
                    <SelectValue>{FIELD_LABELS[form.matchField]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CATEGORY">Categoria</SelectItem>
                    <SelectItem value="DESCRIPTION">Descrição contém</SelectItem>
                    <SelectItem value="ACCOUNT_TYPE">Tipo de conta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>For igual a</Label>
                {form.matchField === "CATEGORY" ? (
                  <CategoryCombobox
                    categories={categories}
                    value={form.matchValue}
                    onChange={(v) => setForm({ ...form, matchValue: v })}
                    onCreateNew={async (name) => {
                      await fetch("/api/categories", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name }),
                      });
                      const res = await fetch("/api/categories");
                      const data = await res.json();
                      setCategories(data.categories ?? []);
                    }}
                  />
                ) : form.matchField === "ACCOUNT_TYPE" ? (
                  <Select
                    value={form.matchValue}
                    onValueChange={(v) => v && setForm({ ...form, matchValue: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHARED">Compartilhada</SelectItem>
                      <SelectItem value="PERSONAL">Pessoal</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.matchValue}
                    onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
                    placeholder="Ex: amazon, netflix..."
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Minha porcentagem: <strong>{form.pctUser1}%</strong></Label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.pctUser1}
                onChange={(e) => setForm({ ...form, pctUser1: Number(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{isCurrentUserUser1 ? (user1Name ?? "Você") : (user2Name ?? "Você")}: {form.pctUser1}%</span>
                <span>{isCurrentUserUser1 ? (user2Name ?? "Parceiro(a)") : (user1Name ?? "Parceiro(a)")}: {100 - form.pctUser1}%</span>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name || !form.matchValue}>
              {editing ? "Salvar" : "Criar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
