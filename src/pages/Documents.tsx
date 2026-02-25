import { useState, useCallback } from "react";
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
  irrelevante: "Não necessário",
};

const classificationColors: Record<string, string> = {
  essencial: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  necessario: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  irrelevante: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients, isLoading: loadingClients } = useClients();


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
    // Fetch document types
    const { data: docTypes, error: docError } = await supabase
      .from("document_types")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .neq("include_in_report", false)
      .order("order_index");

    if (docError) throw new Error(`Erro ao buscar documentos: ${docError.message}`);
    if (!docTypes || docTypes.length === 0) return null;

    // Fetch monthly status
    const { data: statuses, error: statusError } = await supabase
      .from("document_monthly_status")
      .select("*")
      .eq("client_id", clientId)
      .eq("year_month", yearMonth);

    if (statusError) throw new Error(`Erro ao buscar status: ${statusError.message}`);

    const statusMap: Record<string, any> = {};
    statuses?.forEach((s: any) => { statusMap[s.document_type_id] = s; });

    // Filter: only missing documents (not marked or has_document=false), exclude irrelevantes
    const missingDocs = docTypes.filter((d: any) => {
      if (d.classification === "irrelevante") return false;
      const status = statusMap[d.id];
      return !status || !status.has_document;
    });

    if (missingDocs.length === 0) return null;

    const monthLabel = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    const now = new Date().toLocaleString("pt-BR");

    // Generate PDF using jsPDF directly (no html2canvas)
    const jsPDFModule = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const jsPDF = jsPDFModule.default;
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 95);
    doc.text("Solicitação de Documentos", 14, 22);

    doc.setFontSize(13);
    doc.setTextColor(75, 85, 99);
    doc.text(clientName, 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Referência: ${monthLabel}  |  Gerado em: ${now}`, 14, 37);

    // Blue line under header
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(14, 40, 196, 40);

    // Subtitle
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    doc.text("Os documentos abaixo estão pendentes de envio para o mês de referência.", 14, 48);

    // Table data
    const tableBody = missingDocs.map((d: any, i: number) => {
      const status = statusMap[d.id];
      const obs = status?.observation || "\u2014";
      return [String(i + 1), d.name, obs];
    });

    // Use autoTable (call as standalone function, not prototype method)
    autoTable(doc, {
      startY: 53,
      head: [["#", "Documento", "Observação"]],
      body: tableBody,
      styles: { fontSize: 10, cellPadding: 3, lineColor: [209, 213, 219], lineWidth: 0.2 },
      headStyles: { fillColor: [240, 244, 255], textColor: [30, 58, 95], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 65, fontStyle: "bold" },
        2: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
    });

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(14, finalY + 6, 196, finalY + 6);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Total de documentos pendentes: ${missingDocs.length}  |  ContaOffice - Solicitação de Documentos`, 14, finalY + 12);

    return doc.output("blob");
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
                  <Button variant="outline" size="sm" onClick={() => setShowTypeManager(true)}>
                    <Settings2 className="h-4 w-4 mr-1" /> Gerenciar Documentos
                  </Button>
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

    </div>
  );
}
