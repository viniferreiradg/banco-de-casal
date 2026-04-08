"use client";

import { useRef, useState } from "react";
import { Upload, FileText, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PdfToCsvTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
  }

  function clearFile() {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleConvert() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/tools/pdf-to-csv", { method: "POST", body: fd });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao converter o PDF.");
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, "") + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversor de PDF para CSV</CardTitle>
        <CardDescription>
          Envie a fatura do seu banco em PDF. A IA lê o documento e gera um arquivo CSV
          pronto para importar em <strong>Transações → Importar CSV</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => !file && fileInputRef.current?.click()}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="size-5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="size-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para selecionar um PDF</p>
              <p className="text-xs text-muted-foreground mt-1">Fatura de qualquer banco</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Action */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleConvert}
            disabled={!file || loading}
            className="gap-2"
          >
            <Download className="size-4" />
            {loading ? "Lendo PDF com IA..." : "Converter e baixar CSV"}
          </Button>
          {loading && (
            <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
