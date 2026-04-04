"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // New category form
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCategory() {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || null }),
    });
    setAdding(false);
    if (res.ok) {
      setNewName("");
      setNewIcon("");
      setAdding(false);
      load();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro ao criar categoria");
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon ?? "");
  }

  async function saveEdit(id: string) {
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), icon: editIcon.trim() || null }),
    });
    setEditingId(null);
    load();
  }

  async function deleteCategory(cat: Category) {
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
    if (!res.ok) {
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      toast.error("Erro ao excluir categoria");
      return;
    }
    toast("Categoria excluída", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: cat.name, icon: cat.icon }),
          });
          load();
        },
      },
      duration: 5000,
    });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categorias</h1>
        <p className="text-muted-foreground text-sm">
          Organize suas transações por categoria
        </p>
      </div>

      {/* Add new */}
      <div className="flex gap-2 items-end">
        <div className="w-16">
          <p className="text-xs text-muted-foreground mb-1">Ícone</p>
          <Input
            placeholder="🛒"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            className="text-center text-lg"
            maxLength={4}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Nome</p>
          <Input
            placeholder="Ex: Academia, Pet, Presente..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
        </div>
        <Button onClick={addCategory} disabled={adding || !newName.trim()}>
          <Plus className="size-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="size-8 w-8 animate-pulse rounded bg-muted shrink-0" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="flex gap-1">
                <div className="size-7 animate-pulse rounded bg-muted" />
                <div className="size-7 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5">
              {editingId === cat.id ? (
                <>
                  <Input
                    className="w-14 text-center text-lg px-1"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    maxLength={4}
                  />
                  <Input
                    className="flex-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(cat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="size-7 text-green-600" onClick={() => saveEdit(cat.id)}>
                    <Check className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingId(null)}>
                    <X className="size-3" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-xl w-8 text-center shrink-0">{cat.icon ?? "📦"}</span>
                  <span className="flex-1 text-sm">{cat.name}</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => startEdit(cat)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => deleteCategory(cat)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {categories.length} categorias · As categorias são pessoais e não são compartilhadas com o(a) parceiro(a)
      </p>
    </div>
  );
}
