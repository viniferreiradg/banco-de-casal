"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, User } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(mode: "SOLO" | "COUPLE") {
    setLoading(mode);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (data.error) {
        setError(data.error);
        setLoading(null);
        return;
      }
      router.push(data.redirect ?? "/dashboard");
      router.refresh();
    } catch (e) {
      setError(String(e));
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Como você vai usar?</h1>
          <p className="text-muted-foreground">
            Você pode mudar isso depois nas configurações.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => choose("SOLO")}
            disabled={!!loading}
            className="flex items-start gap-4 p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-accent/50 transition-all text-left disabled:opacity-50"
          >
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-base">Sozinho(a)</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Organizo minhas próprias finanças. Controlo entradas, saídas e categorias sem divisão com ninguém.
              </p>
            </div>
          </button>

          <button
            onClick={() => choose("COUPLE")}
            disabled={!!loading}
            className="flex items-start gap-4 p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-accent/50 transition-all text-left disabled:opacity-50"
          >
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-base">Com parceiro(a)</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Divido as contas com alguém. Quero controlar gastos compartilhados, regras de divisão e acerto mensal.
              </p>
            </div>
          </button>
        </div>

        {loading && (
          <p className="text-center text-sm text-muted-foreground">Configurando...</p>
        )}
        {error && (
          <p className="text-center text-sm text-red-600 break-all">{error}</p>
        )}
      </div>
    </div>
  );
}
