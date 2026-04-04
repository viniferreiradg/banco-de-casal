"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";

export function InviteButton() {
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/invite", { method: "POST" });
    const data = await res.json();
    setInviteUrl(data.inviteUrl);
    setLoading(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!inviteUrl) {
    return (
      <Button onClick={generate} disabled={loading}>
        {loading ? "Gerando..." : "Gerar link de convite"}
      </Button>
    );
  }

  return (
    <div className="flex gap-2 w-full max-w-sm mx-auto">
      <Input value={inviteUrl} readOnly className="text-xs" />
      <Button size="icon" variant="outline" onClick={copy}>
        {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
