import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useClients, useDocumentTypes, useDocumentMonthlyStatus, useDocumentReportLogs } from "@/hooks/useSupabaseQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, FileText, Settings2, Download,
  FileDown, Search, AlertTriangle, CheckCircle2, Loader2
} from "lucide-react";
import DocumentMonthlyChecklist from "@/components/DocumentMonthlyChecklist";
import DocumentTypeManager from "@/components/DocumentTypeManager";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").substring(0, 100);
}

const classificationLabels: Record<string, string> = {
  essencial: "Essencial",
  necessario: "Necessário",
  irrelevante: "Irrelevante",
};

const classificationColors: Record<string, string> = {
  essencial: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  necessario: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  irrelevante: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function Documents() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients, isLoading: loadingClients } = useClients();
  const pdfRef = useRef<HTMLDivElement>(null);

  // Month selector
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const yearMonth = formatYearMonth(currentDate);

  // Report logs for current month
  const { data: reportLogs } = useDocumentReportLogs(yearMonth);

  // Selected client
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [showMassGenerate, setShowMassGenerate] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [massGenerating, setMassGenerating] = useState(false);

  // Mass generation selections
  const [massSelected, setMassSelected] = useState<Set<string>>(new Set());

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Filter clients
  const filteredClients = clients?.filter((c: any) => {
    if (c.status !== "Ativo") return false;
    const term = search.toLowerCase();
    return (
      c.legal_name.toLowerCase().includes(term) ||
      (c.trade_name || "").toLowerCase().includes(term) ||
      (c.cnpj || "").includes(term)
    );
  }) || [];

  const selectedClient = clients?.find((c: any) => c.id === selectedClientId);

  // Get set of client IDs that have logs for current month
  const clientsWithLogs = new Set(reportLogs?.map((l: any) => l.client_id) || []);

  // Eligible clients for mass generation (active, not excluded, not archived)
  const eligibleClients = clients?.filter((c: any) =>
    c.status === "Ativo" && !c.exclude_from_doc_report && !c.is_archived
  ) || [];

  const clientsNotGenerated = eligibleClients.filter((c: any) => !clientsWithLogs.has(c.id));

  // ── PDF Generation ──

  const generatePdfForClient = useCallback(async (clientId: string, clientName: string): Promise<Blob | null> => {
    try {
      // Fetch document types
      const { data: docTypes } = await supabase
        .from("document_types")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .eq("include_in_report", true)
        .order("order_index");

      if (!docTypes || docTypes.length === 0) return null;

      // Fetch monthly status
      const { data: statuses } = await supabase
        .from("document_monthly_status")
        .select("*")
        .eq("client_id", clientId)
        .eq("year_month", yearMonth);

      const statusMap: Record<string, any> = {};
      statuses?.forEach((s: any) => { statusMap[s.document_type_id] = s; });

      // Filter: only missing documents (not marked or has_document=false)
      const missingDocs = docTypes.filter((d: any) => {
        const status = statusMap[d.id];
        return !status || !status.has_document;
      });

      if (missingDocs.length === 0) return null;

      // Build HTML for PDF
      const monthLabel = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      const now = new Date().toLocaleString("pt-BR");

      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a1a;">
          <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="margin: 0 0 4px 0; font-size: 22px; color: #1e3a5f;">Solicitação de Documentos</h1>
            <h2 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 500; color: #4b5563;">${clientName}</h2>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">Referência: <strong>${monthLabel}</strong> | Gerado em: ${now}</p>
          </div>

          <p style="font-size: 13px; color: #374151; margin-bottom: 16px;">
            Os documentos abaixo estão <strong>pendentes de envio</strong> para o mês de referência.
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f0f4ff;">
                <th style="text-align: left; padding: 10px 12px; border: 1px solid #d1d5db; font-weight: 600;">#</th>
                <th style="text-align: left; padding: 10px 12px; border: 1px solid #d1d5db; font-weight: 600;">Documento</th>
                <th style="text-align: left; padding: 10px 12px; border: 1px solid #d1d5db; font-weight: 600;">Classificação</th>
                <th style="text-align: left; padding: 10px 12px; border: 1px solid #d1d5db; font-weight: 600;">Observação</th>
              </tr>
            </thead>
            <tbody>
              ${missingDocs.map((d: any, i: number) => {
                const status = statusMap[d.id];
                const obs = status?.observation || "—";
                const classColor = d.classification === "essencial" ? "#dc2626" : d.classification === "necessario" ? "#d97706" : "#6b7280";
                return `
                  <tr style="background: ${i % 2 === 0 ? "#fff" : "#fafafa"};">
                    <td style="padding: 8px 12px; border: 1px solid #d1d5db;">${i + 1}</td>
                    <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-weight: 500;">${d.name}</td>
                    <td style="padding: 8px 12px; border: 1px solid #d1d5db;">
                      <span style="color: ${classColor}; font-weight: 600;">${classificationLabels[d.classification]}</span>
                    </td>
                    <td style="padding: 8px 12px; border: 1px solid #d1d5db; color: #4b5563;">${obs}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 11px; color: #9ca3af; margin: 0;">
              Total de documentos pendentes: ${missingDocs.length} | ContaOffice - Solicitação de Documentos
            </p>
          </div>
        </div>
      `;

      // Render to hidden div and generate PDF
      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "-9999px";
      document.body.appendChild(container);

      const html2pdf = (await import("html2pdf.js")).default;
      const blob = await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `Documentos_${sanitizeFilename(clientName)}_${yearMonth}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container)
        .outputPdf("blob");

      document.body.removeChild(container);
      return blob as Blob;
    } catch (err: any) {
      console.error("PDF generation error:", err);
      return null;
    }
  }, [yearMonth, currentDate]);

  const handleGeneratePdf = async () => {
    if (!selectedClientId || !selectedClient) return;
    setGeneratingPdf(true);
    try {
      const blob = await generatePdfForClient(selectedClientId, selectedClient.legal_name);
      if (!blob) {
        toast({ title: "Nenhum documento pendente para gerar relatório." });
        return;
      }

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Documentos_${sanitizeFilename(selectedClient.legal_name)}_${yearMonth}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Log
      await supabase.from("document_report_logs").insert({
        client_id: selectedClientId,
        year_month: yearMonth,
        generated_by: user!.id,
      });
      queryClient.invalidateQueries({ queryKey: ["document_report_logs", yearMonth] });
      toast({ title: "PDF gerado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Mass PDF Generation ──

  const handleOpenMassGenerate = () => {
    setMassSelected(new Set(eligibleClients.map((c: any) => c.id)));
    setShowMassGenerate(true);
  };

  const selectNotGenerated = () => {
    setMassSelected(new Set(clientsNotGenerated.map((c: any) => c.id)));
  };

  const selectAll = () => {
    setMassSelected(new Set(eligibleClients.map((c: any) => c.id)));
  };

  const selectNone = () => {
    setMassSelected(new Set());
  };

  const toggleMassClient = (id: string) => {
    setMassSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMassGenerate = async () => {
    if (massSelected.size === 0) return;
    setMassGenerating(true);
    const selectedIds = [...massSelected];
    const blobs: { name: string; blob: Blob; clientId: string }[] = [];

    try {
      for (const clientId of selectedIds) {
        const client = clients?.find((c: any) => c.id === clientId);
        if (!client) continue;
        const blob = await generatePdfForClient(clientId, client.legal_name);
        if (blob) {
          blobs.push({ name: `Documentos_${sanitizeFilename(client.legal_name)}_${yearMonth}.pdf`, blob, clientId });
        }
      }

      if (blobs.length === 0) {
        toast({ title: "Nenhum relatório gerado", description: "Nenhuma empresa possui documentos pendentes." });
        setMassGenerating(false);
        return;
      }

      // Download using JSZip if multiple, or single file
      if (blobs.length === 1) {
        const url = URL.createObjectURL(blobs[0].blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = blobs[0].name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Dynamic import JSZip
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const b of blobs) {
          zip.file(b.name, b.blob);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Documentos_${yearMonth}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Log all generated reports
      const logEntries = blobs.map((b) => ({
        client_id: b.clientId,
        year_month: yearMonth,
        generated_by: user!.id,
      }));
      await supabase.from("document_report_logs").insert(logEntries);
      queryClient.invalidateQueries({ queryKey: ["document_report_logs", yearMonth] });
      toast({ title: `${blobs.length} relatório(s) gerado(s) com sucesso!` });
      setShowMassGenerate(false);
    } catch (err: any) {
      toast({ title: "Erro na geração em massa", description: err.message, variant: "destructive" });
    } finally {
      setMassGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Solicitação de Documentos</h1>
          <p className="text-sm text-muted-foreground">Controle mensal de documentos por empresa</p>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleOpenMassGenerate}>
          <FileDown className="h-4 w-4 mr-1" /> Gerar PDFs em Massa
        </Button>
        {clientsNotGenerated.length > 0 && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {clientsNotGenerated.length} empresa(s) sem relatório neste mês
          </Badge>
        )}
      </div>

      {/* Main layout */}
      <div className="flex gap-4 h-[calc(100vh-230px)]">
        {/* Company list */}
        <div className="w-80 shrink-0 border rounded-lg flex flex-col">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingClients && (
              <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
            )}
            {filteredClients.map((client: any) => {
              const hasLog = clientsWithLogs.has(client.id);
              const isExcluded = client.exclude_from_doc_report;
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-left px-3 py-2.5 border-b transition-colors hover:bg-accent/50 ${
                    selectedClientId === client.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">{client.legal_name}</span>
                    {hasLog && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    {!hasLog && !isExcluded && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="Relatório não gerado" />
                    )}
                    {isExcluded && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">Excluída</Badge>
                    )}
                  </div>
                  {client.trade_name && (
                    <span className="text-xs text-muted-foreground">{client.trade_name}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 border rounded-lg overflow-y-auto">
          {!selectedClientId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Selecione uma empresa para visualizar os documentos</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Client header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedClient?.legal_name}</h2>
                  {selectedClient?.trade_name && (
                    <p className="text-sm text-muted-foreground">{selectedClient.trade_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setShowTypeManager(true)}>
                      <Settings2 className="h-4 w-4 mr-1" /> Gerenciar Documentos
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleGeneratePdf}
                    disabled={generatingPdf}
                  >
                    {generatingPdf ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Gerar PDF
                  </Button>
                </div>
              </div>

              {/* Monthly checklist */}
              <DocumentMonthlyChecklist clientId={selectedClientId} yearMonth={yearMonth} />
            </div>
          )}
        </div>
      </div>

      {/* Document type manager dialog */}
      {showTypeManager && selectedClientId && selectedClient && (
        <DocumentTypeManager
          open={showTypeManager}
          onClose={() => setShowTypeManager(false)}
          clientId={selectedClientId}
          clientName={selectedClient.legal_name}
        />
      )}

      {/* Mass generate dialog */}
      <Dialog open={showMassGenerate} onOpenChange={setShowMassGenerate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar PDFs em Massa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione as empresas para gerar relatórios de documentos pendentes para{" "}
            <strong>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</strong>.
          </p>

          <div className="flex flex-wrap gap-2 my-2">
            <Button variant="outline" size="sm" onClick={selectAll}>Selecionar Todas</Button>
            <Button variant="outline" size="sm" onClick={selectNone}>Desmarcar Todas</Button>
            {clientsNotGenerated.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectNotGenerated}>
                <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-500" />
                Sem relatório ({clientsNotGenerated.length})
              </Button>
            )}
          </div>

          <div className="space-y-1 max-h-[50vh] overflow-y-auto border rounded-md p-2">
            {eligibleClients.map((client: any) => {
              const hasLog = clientsWithLogs.has(client.id);
              return (
                <label
                  key={client.id}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={massSelected.has(client.id)}
                    onCheckedChange={() => toggleMassClient(client.id)}
                  />
                  <span className="text-sm flex-1">{client.legal_name}</span>
                  {hasLog && (
                    <Badge variant="outline" className="text-[10px] text-green-600 bg-green-50 dark:bg-green-900/30">
                      Gerado
                    </Badge>
                  )}
                  {!hasLog && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/30">
                      Pendente
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">{massSelected.size} empresa(s) selecionada(s)</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowMassGenerate(false)}>Cancelar</Button>
              <Button onClick={handleMassGenerate} disabled={massGenerating || massSelected.size === 0}>
                {massGenerating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                Gerar {massSelected.size > 1 ? `${massSelected.size} PDFs` : "PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden div for PDF rendering */}
      <div ref={pdfRef} style={{ position: "absolute", left: "-9999px", top: "-9999px" }} />
    </div>
  );
}
