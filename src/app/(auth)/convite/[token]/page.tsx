"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InviteInfo {
  senderName: string;
  senderEmail: string;
  token: string;
}

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    params.then(({ token }) => {
      fetch(`/api/invite?token=${token}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setError(data.error);
          else setInvite(data);
        })
        .catch(() => setError("Erro ao carregar convite"))
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function handleAccept() {
    if (!invite) return;
    setAccepting(true);

    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: invite.token }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error ?? "Erro ao aceitar convite");
      setAccepting(false);
    }
  }

  if (loading) return <p className="text-center text-muted-foreground">Carregando convite...</p>;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Convite inválido</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
            Ir para o login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convite de {invite?.senderName}</CardTitle>
        <CardDescription>
          {invite?.senderName} ({invite?.senderEmail}) te convidou para gerenciar as finanças juntos no Banco de Casal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full" onClick={handleAccept} disabled={accepting}>
          {accepting ? "Aceitando..." : "Aceitar convite"}
        </Button>
        <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
          Cancelar
        </Button>
      </CardContent>
    </Card>
  );
}
