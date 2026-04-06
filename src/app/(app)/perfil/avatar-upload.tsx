"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Trash2 } from "lucide-react";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  initials: string;
}

export function AvatarUpload({ currentAvatarUrl, initials }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    // Optimistic preview
    const preview = URL.createObjectURL(file);
    setAvatarUrl(preview);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/user/avatar", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao enviar");
      setAvatarUrl(currentAvatarUrl);
    } else {
      setAvatarUrl(data.avatarUrl);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setError(null);
    await fetch("/api/user/avatar", { method: "DELETE" });
    setAvatarUrl(null);
    setUploading(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <Avatar className="size-20">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="Foto de perfil" className="object-cover" />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>

        {/* Hover overlay */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
          title="Alterar foto"
        >
          {uploading ? (
            <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {uploading ? "Enviando..." : "Alterar foto"}
        </button>
        {avatarUrl && !uploading && (
          <>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={removeAvatar}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              Remover
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
