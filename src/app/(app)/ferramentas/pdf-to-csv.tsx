"use client";

import { useRef, useState, useEffect } from "react";
import { Upload, FileText, X, Download, CheckCircle, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankConnection {
  id: string;
  bankName: string;
  nickname: string | null;
  accountType: string;
  isCreditCard: boolean;
  userId: string;
}

interface HistoryEntry {
  id: string;
  filename: string;
  transactions: number;
  fileMonth: string;
  generatedAt: string;
  csvContent: string;
}

interface Props {
  bankConnections: BankConnection[];
  currentUserId: string;
}

const STORAGE_KEY = "pdf-to-csv-history";

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

function inferFileMonth(csv: string): string {
  const counts: Record<string, number> = {};
  for (const line of csv.split("\n").slice(1)) {
    const m = line.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) { const k = `${m[2]}/${m[3]}`; counts[k] = (counts[k] ?? 0) + 1; }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "—";
  const [mm, yyyy] = top[0].split("/");
  return format(new Date(Number(yyyy), Number(mm) - 1, 1), "MMMM/yyyy", { locale: ptBR });
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

export function PdfToCsvTool({ bankConnections, currentUserId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [bankId, setBankId] = useState("");
  const [converting, setConverting] = useState(false);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [csvFilename, setCsvFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);
  const [importDone, setImportDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<{ total: number; duplicates: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => { setHistory(loadHistory()); }, []);

  // Filter connections: own + shared
  const myConnections = bankConnections.filter(
    (b) => b.userId === currentUserId || b.accountType === "SHARED"
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    setCsvContent(null);
    setImportDone(null);
    setDuplicateCheck(null);
  }

  function clearFile() {
    setFile(null);
    setError(null);
    setCsvContent(null);
    setImportDone(null);
    setDuplicateCheck(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function deleteEntry(id: string) {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  }

  async function handleConvert() {
    if (!file) return;
    setConverting(true);
    setError(null);
    setCsvContent(null);
    setImportDone(null);
    setDuplicateCheck(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tools/pdf-to-csv", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao converter o PDF.");
      }
      const csv = await res.text();
      const filename = file.name.replace(/\.pdf$/i, "") + ".csv";
      setCsvContent(csv);
      setCsvFilename(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setConverting(false);
    }
  }

  function handleDownload() {
    if (!csvContent || !csvFilename) return;
    triggerDownload(csvContent, csvFilename);
    saveToHistory(csvContent, csvFilename);
  }

  async function handleImport(skipDuplicates: boolean) {
    if (!csvContent || !csvFilename) return;
    if (!bankId) {
      toast.error("Selecione uma conta antes de importar.");
      return;
    }

    // Always download too
    triggerDownload(csvContent, csvFilename);
    saveToHistory(csvContent, csvFilename);

    setImporting(true);
    setImportProgress(null);
    setImportDone(null);
    setDuplicateCheck(null);

    try {
      const csvFile = new File([csvContent], csvFilename, { type: "text/csv" });

      if (!skipDuplicates) {
        // Phase 1: check duplicates
        const checkFd = new FormData();
        checkFd.append("file", csvFile);
        checkFd.append("bankConnectionId", bankId);
        checkFd.append("checkOnly", "true");
        const checkRes = await fetch("/api/transactions/import", { method: "POST", body: checkFd });
        if (!checkRes.ok) {
          const data = await checkRes.json().catch(() => ({}));
          throw new Error(data.error ?? "Erro ao verificar arquivo.");
        }
        const check = await checkRes.json() as { total: number; duplicates: number };
        if (check.duplicates > 0) {
          setDuplicateCheck(check);
          setImporting(false);
          return;
        }
      }

      // Phase 2: import with streaming
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("bankConnectionId", bankId);
      fd.append("skipDuplicates", skipDuplicates ? "true" : "false");
      const res = await fetch("/api/transactions/import", { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao importar.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "total") setImportProgress({ processed: 0, total: msg.total });
          else if (msg.type === "progress") setImportProgress({ processed: msg.processed, total: msg.total });
          else if (msg.type === "done") setImportDone({ imported: msg.imported, skipped: msg.skipped ?? 0 });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar.");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  function saveToHistory(csv: string, filename: string) {
    const transactions = csv.split("\n").filter((l, i) => i > 0 && l.trim()).length;
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      filename,
      transactions,
      fileMonth: inferFileMonth(csv),
      generatedAt: new Date().toISOString(),
      csvContent: csv,
    };
    const updated = [entry, ...loadHistory()];
    setHistory(updated);
    saveHistory(updated);
  }

  const txCount = csvContent ? csvContent.split("\n").filter((l, i) => i > 0 && l.trim()).length : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversor de PDF para CSV</CardTitle>
          <CardDescription>
            Envie a fatura do seu banco em PDF. A IA lê o documento e gera um CSV
            pronto para importar em <strong>Transações → Importar CSV</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Account selector */}
          <div className="space-y-2">
            <Label>Conta <span className="text-muted-foreground text-xs">(necessário para importar)</span></Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
            >
              <option value="">Selecionar conta...</option>
              {myConnections.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nickname ?? b.bankName}
                  {" "}({b.accountType === "SHARED" ? "Compartilhada" : "Pessoal"})
                  {b.isCreditCard ? " · Crédito" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div className="space-y-2">
            <Label>Arquivo PDF</Label>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => !file && fileInputRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="size-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    className="text-muted-foreground hover:text-foreground transition-colors">
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
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Convert button */}
          {!csvContent && (
            <Button onClick={handleConvert} disabled={!file || converting} className="gap-2">
              <RefreshCw className={`size-4 ${converting ? "animate-spin" : ""}`} />
              {converting ? "Lendo PDF com IA..." : "Converter"}
            </Button>
          )}
          {converting && <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos...</p>}

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* CSV ready — action buttons */}
          {csvContent && !importing && !importDone && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="size-4 shrink-0" />
                CSV pronto! <strong>{txCount} transações</strong> detectadas — {inferFileMonth(csvContent)}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleDownload} className="gap-2">
                  <Download className="size-4" />
                  Só baixar
                </Button>
                <Button onClick={() => handleImport(false)} disabled={!bankId} className="gap-2">
                  <Download className="size-4" />
                  Baixar e importar
                </Button>
              </div>
              {!bankId && (
                <p className="text-xs text-amber-600">Selecione uma conta acima para poder importar.</p>
              )}
              <button onClick={() => { setCsvContent(null); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-xs text-muted-foreground hover:text-foreground underline">
                Converter outro PDF
              </button>
            </div>
          )}

          {/* Duplicate check */}
          {duplicateCheck && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm text-amber-800">
                <strong>{duplicateCheck.duplicates}</strong> de {duplicateCheck.total} transações já existem. Deseja importar mesmo assim?
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleImport(true)}>Importar mesmo assim</Button>
                <Button size="sm" variant="outline" onClick={() => setDuplicateCheck(null)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Import progress */}
          {importing && importProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Importando transações...</span>
                <span>{importProgress.processed} / {importProgress.total}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          {importing && !importProgress && (
            <p className="text-xs text-muted-foreground">Verificando duplicatas...</p>
          )}

          {/* Import done */}
          {importDone && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="size-4 shrink-0" />
              <span>
                <strong>{importDone.imported} transações importadas</strong>
                {importDone.skipped > 0 ? ` · ${importDone.skipped} ignoradas` : ""}
              </span>
            </div>
          )}

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
                        <button onClick={() => triggerDownload(entry.csvContent, entry.filename)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Baixar novamente">
                          <Download className="size-4" />
                        </button>
                        <button onClick={() => deleteEntry(entry.id)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Remover do histórico">
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
