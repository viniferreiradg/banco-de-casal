"use client";

import { useRef, useState, useEffect } from "react";
import { Upload, FileText, X, Download, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoryEntry {
  id: string;
  filename: string;
  transactions: number;
  fileMonth: string;   // "março/2025"
  generatedAt: string; // ISO string
  csvContent: string;
}

const STORAGE_KEY = "pdf-to-csv-history";

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function inferFileMonth(csvContent: string): string {
  // Conta a frequência de cada MM/YYYY nas datas do CSV
  const dateRegex = /\d{2}\/\d{2}\/(\d{4})/g;
  const counts: Record<string, number> = {};
  const lines = csvContent.split("\n").slice(1); // skip header
  for (const line of lines) {
    const match = line.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const key = `${match[2]}/${match[3]}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  void dateRegex;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "—";
  const [mm, yyyy] = top[0].split("/");
  const date = new Date(Number(yyyy), Number(mm) - 1, 1);
  return format(date, "MMMM/yyyy", { locale: ptBR });
}

function triggerDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PdfToCsvTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    setSuccess(false);
  }

  function clearFile() {
    setFile(null);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function deleteEntry(id: string) {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  }

  async function handleConvert() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/tools/pdf-to-csv", { method: "POST", body: fd });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao converter o PDF.");
      }

      const csvContent = await res.text();
      const csvFilename = file.name.replace(/\.pdf$/i, "") + ".csv";

      // Download
      triggerDownload(csvContent, csvFilename);

      // Count transactions (lines minus header)
      const transactions = csvContent.split("\n").filter((l, i) => i > 0 && l.trim()).length;
      const fileMonth = inferFileMonth(csvContent);

      // Save to history
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        filename: csvFilename,
        transactions,
        fileMonth,
        generatedAt: new Date().toISOString(),
        csvContent,
      };
      const updated = [entry, ...loadHistory()];
      setHistory(updated);
      saveHistory(updated);

      setSuccess(true);
      clearFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="size-4 shrink-0" />
              CSV gerado e baixado com sucesso!
            </div>
          )}

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

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de conversões</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Arquivo</th>
                  <th className="text-left px-4 py-2 font-medium">Mês da fatura</th>
                  <th className="text-left px-4 py-2 font-medium">Transações</th>
                  <th className="text-left px-4 py-2 font-medium">Gerado em</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium truncate max-w-[200px]">{entry.filename}</td>
                    <td className="px-4 py-2 capitalize">{entry.fileMonth}</td>
                    <td className="px-4 py-2">{entry.transactions}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {format(new Date(entry.generatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => triggerDownload(entry.csvContent, entry.filename)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Baixar novamente"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remover do histórico"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
