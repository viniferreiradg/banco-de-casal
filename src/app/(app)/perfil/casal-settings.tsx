"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface CasalSettingsProps {
  closingDay: number;
}

export function CasalSettings({ closingDay: initialClosingDay }: CasalSettingsProps) {
  const [closingDay, setClosingDay] = useState(String(initialClosingDay));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/couple/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingDay: Number(closingDay) }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Erro ao salvar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configurações do casal</CardTitle>
        <CardDescription>
          Defina o dia de fechamento da fatura para o casal. Compras no cartão de crédito após esse dia são atribuídas ao mês seguinte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-xs">
          <Label>Dia de fechamento da fatura</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={28}
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">de 1 a 28</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Padrão: dia 5. Ex: compra no dia 6 com fechamento no dia 5 → vai para a fatura do mês seguinte.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={save} disabled={saving} size="sm">
          {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
