import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useClients, useSectors } from "@/hooks/useSupabaseQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from
"@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from
"@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
"@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger } from
"@/components/ui/collapsible";
import { toast } from "sonner";
import {
  FileSpreadsheet, Pencil, Check, Send, Loader2, Plus, Undo2, ChevronDown, History } from
"lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──
interface ReinfEntry {
  id: string;
  client_id: string;
  ano: number;
  trimestre: number;
  lucro_mes1: number | null;
  lucro_mes2: number | null;
  lucro_mes3: number | null;
  status: string;
  status_mes1: string;
  status_mes2: string;
  status_mes3: string;
  created_by: string | null;
  contabil_usuario_id: string | null;
  contabil_preenchido_em: string | null;
  dp_usuario_id: string | null;
  dp_aprovado_em: string | null;
  fiscal_usuario_id: string | null;
  fiscal_enviado_em: string | null;
  contabil_usuario_id_mes1: string | null;
  contabil_preenchido_em_mes1: string | null;
  dp_usuario_id_mes1: string | null;
  dp_aprovado_em_mes1: string | null;
  fiscal_usuario_id_mes1: string | null;
  fiscal_enviado_em_mes1: string | null;
  contabil_usuario_id_mes2: string | null;
  contabil_preenchido_em_mes2: string | null;
  dp_usuario_id_mes2: string | null;
  dp_aprovado_em_mes2: string | null;
  fiscal_usuario_id_mes2: string | null;
  fiscal_enviado_em_mes2: string | null;
  contabil_usuario_id_mes3: string | null;
  contabil_preenchido_em_mes3: string | null;
  dp_usuario_id_mes3: string | null;
  dp_aprovado_em_mes3: string | null;
  fiscal_usuario_id_mes3: string | null;
  fiscal_enviado_em_mes3: string | null;
  created_at: string;
  clients: {legal_name: string;trade_name: string | null;} | null;
}

interface ReinfLog {
  id: string;
  reinf_entry_id: string;
  user_id: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface Profile {user_id: string;full_name: string;}
interface Partner {id: string;client_id: string;name: string;}
interface PartnerProfit {id: string;reinf_entry_id: string;partner_id: string;mes: number;valor: number;}

// ── Constants ──
const TRIMESTRE_LABELS: Record<number, string> = {
  1: "1º Tri (Jan–Mar)", 2: "2º Tri (Abr–Jun)", 3: "3º Tri (Jul–Set)", 4: "4º Tri (Out–Dez)"
};
const TRIMESTRE_MESES: Record<number, [string, string, string]> = {
  1: ["Janeiro", "Fevereiro", "Março"], 2: ["Abril", "Maio", "Junho"],
  3: ["Julho", "Agosto", "Setembro"], 4: ["Outubro", "Novembro", "Dezembro"]
};

const STATUS_CONFIG: Record<string, {label: string;color: string;nextAction?: string;nextLabel?: string;prevAction?: string;prevLabel?: string;}> = {
  pendente_contabil: { label: "Pendente Contábil", color: "bg-status-open/10 text-status-open border-status-open/30", nextAction: "contabil_ok", nextLabel: "Enviar para DP" },
  contabil_ok: { label: "Aguardando DP", color: "bg-status-waiting/10 text-status-waiting border-status-waiting/30", nextAction: "dp_aprovado", nextLabel: "Aprovar", prevAction: "pendente_contabil", prevLabel: "Voltar p/ Contábil" },
  dp_aprovado: { label: "Aguardando Fiscal", color: "bg-status-progress/10 text-status-progress border-status-progress/30", nextAction: "enviado", nextLabel: "Marcar Enviado", prevAction: "contabil_ok", prevLabel: "Voltar p/ DP" },
  enviado: { label: "Enviado", color: "bg-status-done/10 text-status-done border-status-done/30", prevAction: "dp_aprovado", prevLabel: "Voltar p/ Fiscal" }
};
const STATUS_ORDER = ["pendente_contabil", "contabil_ok", "dp_aprovado", "enviado"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function formatDate(dateStr: string) {
  return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

// Helper to get per-month field values
function getMesStatus(entry: ReinfEntry, mes: number): string {
  return mes === 1 ? entry.status_mes1 : mes === 2 ? entry.status_mes2 : entry.status_mes3;
}
function getMesLucro(entry: ReinfEntry, mes: number): number | null {
  return mes === 1 ? entry.lucro_mes1 : mes === 2 ? entry.lucro_mes2 : entry.lucro_mes3;
}
function getMesContabilUser(entry: ReinfEntry, mes: number): string | null {
  return mes === 1 ? entry.contabil_usuario_id_mes1 : mes === 2 ? entry.contabil_usuario_id_mes2 : entry.contabil_usuario_id_mes3;
}
function getMesDpUser(entry: ReinfEntry, mes: number): string | null {
  return mes === 1 ? entry.dp_usuario_id_mes1 : mes === 2 ? entry.dp_usuario_id_mes2 : entry.dp_usuario_id_mes3;
}
function getMesFiscalUser(entry: ReinfEntry, mes: number): string | null {
  return mes === 1 ? entry.fiscal_usuario_id_mes1 : mes === 2 ? entry.fiscal_usuario_id_mes2 : entry.fiscal_usuario_id_mes3;
}

export default function Reinf() {
  const { user, isAdmin, userSectorId } = useAuth();
  const { data: clients } = useClients();
  const { data: sectors } = useSectors();
  const [entries, setEntries] = useState<ReinfEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<ReinfLog[]>([]);
  const [loading, setLoading] = useState(true);

  const userSectorName = sectors?.find((s) => s.id === userSectorId)?.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
  const canContabil = isAdmin || userSectorName.includes("contab");
  const canDP = isAdmin || userSectorName.includes("dp") || userSectorName.includes("folha") || userSectorName.includes("pessoal");
  const canFiscal = isAdmin || userSectorName.includes("fiscal");

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const [filterAno, setFilterAno] = useState(currentYear.toString());
  const [filterTrimestre, setFilterTrimestre] = useState(currentQuarter.toString());

  const [createOpen, setCreateOpen] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newAno, setNewAno] = useState(currentYear.toString());
  const [newTrimestre, setNewTrimestre] = useState(currentQuarter.toString());
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ReinfEntry | null>(null);
  const [editMes, setEditMes] = useState<number>(1);
  const [savingLucros, setSavingLucros] = useState(false);

  const [editPartners, setEditPartners] = useState<Partner[]>([]);
  const [partnerSelections, setPartnerSelections] = useState<Record<number, Record<string, {selected: boolean;valor: string;}>>>({});

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{entry: ReinfEntry;mes: number;type: "advance" | "revert";} | null>(null);

  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [entryPartnerProfits, setEntryPartnerProfits] = useState<PartnerProfit[]>([]);

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => {map[p.user_id] = p.full_name;});
    return map;
  }, [profiles]);

  const getProfileName = (userId: string | null) => {
    if (!userId) return null;
    return profileMap[userId] || "—";
  };

  const logsByEntry = useMemo(() => {
    const map: Record<string, ReinfLog[]> = {};
    logs.forEach((l) => {
      if (!map[l.reinf_entry_id]) map[l.reinf_entry_id] = [];
      map[l.reinf_entry_id].push(l);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    return map;
  }, [logs]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    if (data) setProfiles(data);
  }, []);

  const fetchLogs = useCallback(async (entryIds: string[]) => {
    if (entryIds.length === 0) {setLogs([]);return;}
    const { data } = await supabase.from("reinf_logs").select("*").in("reinf_entry_id", entryIds).order("created_at", { ascending: false });
    if (data) setLogs(data as ReinfLog[]);
  }, []);

  const fetchAllPartners = useCallback(async () => {
    const { data } = await supabase.from("client_partners").select("id, client_id, name").order("order_index");
    if (data) setAllPartners(data as Partner[]);
  }, []);

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase.
    from("reinf_entries").
    select("*, clients(legal_name, trade_name)").
    eq("ano", parseInt(filterAno)).
    eq("trimestre", parseInt(filterTrimestre)).
    order("created_at", { ascending: true });

    if (error) {toast.error("Erro ao carregar dados da REINF.");return;}
    const entries = data as unknown as ReinfEntry[] ?? [];
    setEntries(entries);
    setLoading(false);
    fetchLogs(entries.map((e) => e.id));
    if (entries.length > 0) {
      const { data: pp } = await supabase.from("reinf_partner_profits").select("*").in("reinf_entry_id", entries.map((e) => e.id));
      setEntryPartnerProfits((pp || []) as PartnerProfit[]);
    } else {
      setEntryPartnerProfits([]);
    }
  }, [filterAno, filterTrimestre, fetchLogs]);

  useEffect(() => {
    setLoading(true);
    fetchEntries();
    fetchProfiles();
    fetchAllPartners();
  }, [fetchEntries, fetchProfiles, fetchAllPartners]);

  const addLog = async (entryId: string, action: string, details?: string) => {
    if (!user?.id) return;
    await supabase.from("reinf_logs").insert({ reinf_entry_id: entryId, user_id: user.id, action, details: details || null });
  };

  const handleCreate = async () => {
    if (!newClientId) {toast.error("Selecione um cliente.");return;}
    setCreating(true);
    const { data, error } = await supabase.from("reinf_entries").insert({
      client_id: newClientId, ano: parseInt(newAno), trimestre: parseInt(newTrimestre), created_by: user?.id
    }).select("id").single();
    setCreating(false);
    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) toast.error("Já existe uma entrada para este cliente neste trimestre.");else
      toast.error("Erro ao criar entrada: " + error.message);
      return;
    }
    if (data) await addLog(data.id, "Entrada criada");
    toast.success("Entrada criada com sucesso!");
    setCreateOpen(false);
    setNewClientId("");
    fetchEntries();
  };

  const openEditDialog = async (entry: ReinfEntry, mesNum: number) => {
    setEditEntry(entry);
    setEditMes(mesNum);
    const clientPartners = allPartners.filter((p) => p.client_id === entry.client_id);
    setEditPartners(clientPartners);

    const selections: Record<number, Record<string, {selected: boolean;valor: string;}>> = { [mesNum]: {} };
    if (clientPartners.length > 0) {
      const { data: profits } = await supabase.from("reinf_partner_profits").select("*").eq("reinf_entry_id", entry.id).eq("mes", mesNum);
      for (const pp of (profits || []) as PartnerProfit[]) {
        selections[mesNum][pp.partner_id] = { selected: true, valor: pp.valor.toString() };
      }
    } else {
      const existingVal = getMesLucro(entry, mesNum);
      selections[mesNum] = { __no_partner__: { selected: true, valor: existingVal ? existingVal.toString() : "" } };
    }
    setPartnerSelections(selections);
    setEditOpen(true);
  };

  const getMonthTotal = (mes: number) => {
    const mesData = partnerSelections[mes] || {};
    return Object.entries(mesData).filter(([, s]) => s.selected).reduce((sum, [, s]) => sum + (parseFloat(s.valor) || 0), 0);
  };

  const handleSaveLucros = async () => {
    if (!editEntry) return;
    const mes = editMes;
    const meses = TRIMESTRE_MESES[editEntry.trimestre];
    const mesData = partnerSelections[mes] || {};

    if (editPartners.length > 0) {
      const realSelected = Object.entries(mesData).filter(([k, s]) => s.selected && k !== "__no_partner__");
      if (realSelected.length === 0) {toast.error(`Selecione ao menos um sócio para ${meses[mes - 1]}.`);return;}
    }

    const monthTotal = editPartners.length > 0 ?
    Object.entries(mesData).filter(([k, s]) => s.selected && k !== "__no_partner__").reduce((sum, [, s]) => sum + (parseFloat(s.valor) || 0), 0) :
    parseFloat(mesData.__no_partner__?.valor || "0") || 0;

    const oldVal = getMesLucro(editEntry, mes);
    const isUpdate = (oldVal || 0) !== 0;
    setSavingLucros(true);

    const updateField = mes === 1 ? "lucro_mes1" : mes === 2 ? "lucro_mes2" : "lucro_mes3";
    const { error } = await supabase.from("reinf_entries").update({ [updateField]: monthTotal }).eq("id", editEntry.id);
    if (error) {setSavingLucros(false);toast.error("Erro ao salvar lucros.");return;}

    if (editPartners.length > 0) {
      await supabase.from("reinf_partner_profits").delete().eq("reinf_entry_id", editEntry.id).eq("mes", mes);
      const inserts = Object.entries(mesData).
      filter(([k, s]) => s.selected && k !== "__no_partner__").
      map(([partnerId, sel]) => ({ reinf_entry_id: editEntry.id, partner_id: partnerId, mes, valor: parseFloat(sel.valor) || 0 }));
      if (inserts.length > 0) await supabase.from("reinf_partner_profits").insert(inserts);
    }
    setSavingLucros(false);

    const partnerDetails = editPartners.length > 0 ?
    Object.entries(mesData).filter(([k, s]) => s.selected && k !== "__no_partner__").map(([pid, s]) => {
      const pName = editPartners.find((p) => p.id === pid)?.name || "?";
      return `${pName}: ${formatCurrency(parseFloat(s.valor) || 0)}`;
    }).join(", ") :
    "";

    if (isUpdate) {
      await addLog(editEntry.id, "Lucros alterados", `${meses[mes - 1]}: ${formatCurrency(oldVal || 0)} → ${formatCurrency(monthTotal)}${partnerDetails ? ` (${partnerDetails})` : ""}`);
    } else {
      await addLog(editEntry.id, "Lucros preenchidos", `${meses[mes - 1]}: ${formatCurrency(monthTotal)}${partnerDetails ? ` (${partnerDetails})` : ""}`);
    }
    toast.success("Lucros salvos com sucesso!");
    setEditOpen(false);
    fetchEntries();
  };

  // ── Per-month status actions ──
  const requestConfirmation = (entry: ReinfEntry, mes: number, type: "advance" | "revert") => {
    setConfirmAction({ entry, mes, type });
    setConfirmOpen(true);
  };

  // Quarterly fiscal confirmation
  const [confirmFiscalOpen, setConfirmFiscalOpen] = useState(false);
  const [confirmFiscalEntry, setConfirmFiscalEntry] = useState<ReinfEntry | null>(null);
  const [confirmFiscalType, setConfirmFiscalType] = useState<"advance" | "revert">("advance");

  const requestFiscalConfirmation = (entry: ReinfEntry, type: "advance" | "revert") => {
    setConfirmFiscalEntry(entry);
    setConfirmFiscalType(type);
    setConfirmFiscalOpen(true);
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { entry, mes, type } = confirmAction;
    setConfirmOpen(false);
    setConfirmAction(null);
    if (type === "advance") await doAdvanceMesStatus(entry, mes);else
    await doRevertMesStatus(entry, mes);
  };

  const doAdvanceMesStatus = async (entry: ReinfEntry, mes: number) => {
    const currentStatus = getMesStatus(entry, mes);
    const statusConfig = STATUS_CONFIG[currentStatus];
    if (!statusConfig?.nextAction) return;

    // Per-month flow stops at dp_aprovado — fiscal is quarterly
    if (statusConfig.nextAction === "enviado") return;

    const suffix = `_mes${mes}`;
    const updateData: Record<string, unknown> = { [`status${suffix}`]: statusConfig.nextAction };

    if (statusConfig.nextAction === "contabil_ok") {
      updateData[`contabil_usuario_id${suffix}`] = user?.id;
      updateData[`contabil_preenchido_em${suffix}`] = new Date().toISOString();
    } else if (statusConfig.nextAction === "dp_aprovado") {
      updateData[`dp_usuario_id${suffix}`] = user?.id;
      updateData[`dp_aprovado_em${suffix}`] = new Date().toISOString();
    }

    // Also update legacy global status to the "minimum" of all 3 months
    const allStatuses = [1, 2, 3].map((m) => m === mes ? statusConfig.nextAction! : getMesStatus(entry, m));
    const minIdx = Math.min(...allStatuses.map((s) => STATUS_ORDER.indexOf(s)));
    updateData.status = STATUS_ORDER[minIdx];

    const { error } = await supabase.from("reinf_entries").update(updateData).eq("id", entry.id);
    if (error) {toast.error("Erro ao atualizar status.");return;}

    const mesName = TRIMESTRE_MESES[entry.trimestre][mes - 1];
    const newLabel = STATUS_CONFIG[statusConfig.nextAction]?.label ?? statusConfig.nextAction;
    await addLog(entry.id, `Status avançado`, `${mesName}: → "${newLabel}"`);
    toast.success(`${mesName} atualizado para "${newLabel}".`);
    fetchEntries();
  };

  const doRevertMesStatus = async (entry: ReinfEntry, mes: number) => {
    const currentStatus = getMesStatus(entry, mes);
    const statusConfig = STATUS_CONFIG[currentStatus];
    if (!statusConfig?.prevAction) return;

    // Cannot revert from "enviado" per-month — use quarterly revert
    if (currentStatus === "enviado") return;

    const targetStatus = statusConfig.prevAction;
    const targetIdx = STATUS_ORDER.indexOf(targetStatus);
    const suffix = `_mes${mes}`;
    const updateData: Record<string, unknown> = { [`status${suffix}`]: targetStatus };

    if (targetIdx <= 0) {
      updateData[`contabil_usuario_id${suffix}`] = null;updateData[`contabil_preenchido_em${suffix}`] = null;
      updateData[`dp_usuario_id${suffix}`] = null;updateData[`dp_aprovado_em${suffix}`] = null;
      updateData[`fiscal_usuario_id${suffix}`] = null;updateData[`fiscal_enviado_em${suffix}`] = null;
    } else if (targetIdx <= 1) {
      updateData[`dp_usuario_id${suffix}`] = null;updateData[`dp_aprovado_em${suffix}`] = null;
      updateData[`fiscal_usuario_id${suffix}`] = null;updateData[`fiscal_enviado_em${suffix}`] = null;
    } else if (targetIdx <= 2) {
      updateData[`fiscal_usuario_id${suffix}`] = null;updateData[`fiscal_enviado_em${suffix}`] = null;
    }

    // Update legacy global status
    const allStatuses = [1, 2, 3].map((m) => m === mes ? targetStatus : getMesStatus(entry, m));
    const minIdx = Math.min(...allStatuses.map((s) => STATUS_ORDER.indexOf(s)));
    updateData.status = STATUS_ORDER[minIdx];

    const { error } = await supabase.from("reinf_entries").update(updateData).eq("id", entry.id);
    if (error) {toast.error("Erro ao reverter status.");return;}

    const mesName = TRIMESTRE_MESES[entry.trimestre][mes - 1];
    const fromLabel = STATUS_CONFIG[currentStatus]?.label ?? currentStatus;
    const toLabel = STATUS_CONFIG[targetStatus]?.label ?? targetStatus;
    await addLog(entry.id, `Status revertido`, `${mesName}: "${fromLabel}" → "${toLabel}"`);
    toast.success(`${mesName} revertido para "${toLabel}".`);
    fetchEntries();
  };

  // ── Quarterly Fiscal actions ──
  const allMonthsDpAprovado = (entry: ReinfEntry) => {
    return [1, 2, 3].every((m) => getMesStatus(entry, m) === "dp_aprovado");
  };

  const allMonthsEnviado = (entry: ReinfEntry) => {
    return [1, 2, 3].every((m) => getMesStatus(entry, m) === "enviado");
  };

  const someMonthsEnviado = (entry: ReinfEntry) => {
    return [1, 2, 3].some((m) => getMesStatus(entry, m) === "enviado");
  };

  const doAdvanceFiscalTrimestral = async (entry: ReinfEntry) => {
    const updateData: Record<string, unknown> = {};
    for (const mes of [1, 2, 3]) {
      const suffix = `_mes${mes}`;
      updateData[`status${suffix}`] = "enviado";
      updateData[`fiscal_usuario_id${suffix}`] = user?.id;
      updateData[`fiscal_enviado_em${suffix}`] = new Date().toISOString();
    }
    updateData.status = "enviado";
    updateData.fiscal_usuario_id = user?.id;
    updateData.fiscal_enviado_em = new Date().toISOString();

    const { error } = await supabase.from("reinf_entries").update(updateData).eq("id", entry.id);
    if (error) {toast.error("Erro ao enviar fiscal.");return;}
    await addLog(entry.id, "Fiscal enviado (trimestral)", `Todos os 3 meses marcados como enviados`);
    toast.success("Trimestre marcado como enviado pelo Fiscal!");
    fetchEntries();
  };

  const doRevertFiscalTrimestral = async (entry: ReinfEntry) => {
    const updateData: Record<string, unknown> = {};
    for (const mes of [1, 2, 3]) {
      const suffix = `_mes${mes}`;
      updateData[`status${suffix}`] = "dp_aprovado";
      updateData[`fiscal_usuario_id${suffix}`] = null;
      updateData[`fiscal_enviado_em${suffix}`] = null;
    }
    updateData.status = "dp_aprovado";
    updateData.fiscal_usuario_id = null;
    updateData.fiscal_enviado_em = null;

    const { error } = await supabase.from("reinf_entries").update(updateData).eq("id", entry.id);
    if (error) {toast.error("Erro ao reverter fiscal.");return;}
    await addLog(entry.id, "Fiscal revertido (trimestral)", `Todos os 3 meses revertidos para "Aguardando Fiscal"`);
    toast.success("Trimestre revertido para Aguardando Fiscal.");
    fetchEntries();
  };

  const executeFiscalConfirmed = async () => {
    if (!confirmFiscalEntry) return;
    setConfirmFiscalOpen(false);
    if (confirmFiscalType === "advance") await doAdvanceFiscalTrimestral(confirmFiscalEntry);else
    await doRevertFiscalTrimestral(confirmFiscalEntry);
    setConfirmFiscalEntry(null);
  };

  const togglePartner = (mes: number, partnerId: string) => {
    setPartnerSelections((prev) => {
      const mesData = { ...(prev[mes] || {}) };
      mesData[partnerId] = mesData[partnerId]?.selected ?
      { selected: false, valor: "" } :
      { selected: true, valor: mesData[partnerId]?.valor || "" };
      return { ...prev, [mes]: mesData };
    });
  };

  const setPartnerValor = (mes: number, partnerId: string, valor: string) => {
    setPartnerSelections((prev) => {
      const mesData = { ...(prev[mes] || {}) };
      mesData[partnerId] = { ...mesData[partnerId], selected: true, valor };
      return { ...prev, [mes]: mesData };
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Confirm dialog text
  const confirmMesName = confirmAction ? TRIMESTRE_MESES[confirmAction.entry.trimestre]?.[confirmAction.mes - 1] : "";
  const confirmCurrentStatus = confirmAction ? getMesStatus(confirmAction.entry, confirmAction.mes) : "";
  const confirmTitle = confirmAction?.type === "advance" ?
  STATUS_CONFIG[confirmCurrentStatus]?.nextLabel ?? "Avançar" :
  STATUS_CONFIG[confirmCurrentStatus]?.prevLabel ?? "Reverter";
  const confirmTargetLabel = confirmAction?.type === "advance" ?
  STATUS_CONFIG[STATUS_CONFIG[confirmCurrentStatus]?.nextAction ?? ""]?.label :
  STATUS_CONFIG[STATUS_CONFIG[confirmCurrentStatus]?.prevAction ?? ""]?.label;
  const confirmDesc = `Deseja ${confirmAction?.type === "advance" ? "avançar" : "reverter"} o status de ${confirmMesName} (${confirmAction?.entry.clients?.trade_name || confirmAction?.entry.clients?.legal_name}) para "${confirmTargetLabel}"?`;

  if (loading && entries.length === 0) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EFD-REINF</h1>
          <p className="text-muted-foreground">Controle de envio da EFD-REINF por cliente e trimestre.</p>
        </div>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Ano:</Label>
          <Select value={filterAno} onValueChange={setFilterAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Trimestre:</Label>
          <Select value={filterTrimestre} onValueChange={setFilterTrimestre}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4].map((t) => <SelectItem key={t} value={t.toString()}>{TRIMESTRE_LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {canContabil &&
        <div className="ml-auto">
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Nova Entrada</Button>
          </div>
        }
      </div>

      {/* Create Entry Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Entrada REINF</DialogTitle>
            <DialogDescription>Selecione o cliente e o período para criar uma nova entrada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.legal_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={newAno} onValueChange={setNewAno}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trimestre</Label>
                <Select value={newTrimestre} onValueChange={setNewTrimestre}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4].map((t) => <SelectItem key={t} value={t.toString()}>{TRIMESTRE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lucros Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preencher Lucros — {editEntry && TRIMESTRE_MESES[editEntry.trimestre]?.[editMes - 1]}</DialogTitle>
            <DialogDescription>{editEntry?.clients?.trade_name || editEntry?.clients?.legal_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editPartners.length > 0 ?
            <>
                <Label className="text-sm text-muted-foreground">Selecione os sócios e preencha o valor de cada um:</Label>
                <div className="space-y-3">
                  {editPartners.map((partner) => {
                  const sel = partnerSelections[editMes]?.[partner.id];
                  const isSelected = sel?.selected || false;
                  return (
                    <div key={partner.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Checkbox id={`partner-${editMes}-${partner.id}`} checked={isSelected} onCheckedChange={() => togglePartner(editMes, partner.id)} />
                          <Label htmlFor={`partner-${editMes}-${partner.id}`} className="text-sm cursor-pointer">{partner.name}</Label>
                        </div>
                        {isSelected &&
                      <div className="pl-6">
                            <Input type="number" step="0.01" placeholder="Valor do sócio" className="h-8 text-sm" value={sel?.valor || ""} onChange={(e) => setPartnerValor(editMes, partner.id, e.target.value)} />
                          </div>
                      }
                      </div>);

                })}
                </div>
                <div className="pt-2 border-t text-sm">
                  <span className="text-muted-foreground">Total do mês: </span>
                  <span className="font-semibold">{formatCurrency(getMonthTotal(editMes))}</span>
                </div>
              </> :

            <div className="space-y-2">
                <Label>Valor do mês</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={partnerSelections[editMes]?.__no_partner__?.valor || ""}
              onChange={(e) => setPartnerSelections((prev) => ({ ...prev, [editMes]: { __no_partner__: { selected: true, valor: e.target.value } } }))} />
              </div>
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLucros} disabled={savingLucros}>{savingLucros ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation AlertDialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmedAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fiscal Quarterly Confirmation */}
      <AlertDialog open={confirmFiscalOpen} onOpenChange={setConfirmFiscalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmFiscalType === "advance" ? "Enviar Fiscal (Trimestre)" : "Reverter Fiscal (Trimestre)"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmFiscalType === "advance" ?
              `Deseja marcar todos os 3 meses de ${confirmFiscalEntry?.clients?.trade_name || confirmFiscalEntry?.clients?.legal_name} como enviados ao Fiscal?` :
              `Deseja reverter o envio fiscal de todos os 3 meses de ${confirmFiscalEntry?.clients?.trade_name || confirmFiscalEntry?.clients?.legal_name} para "Aguardando Fiscal"?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeFiscalConfirmed}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {entries.length === 0 ?
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          Nenhuma entrada para {TRIMESTRE_LABELS[parseInt(filterTrimestre)]} de {filterAno}. Clique em "Nova Entrada" para começar.
        </div> :

      <div className="space-y-4">
          {entries.map((entry) => {
          const meses = TRIMESTRE_MESES[entry.trimestre];
          const total = (entry.lucro_mes1 || 0) + (entry.lucro_mes2 || 0) + (entry.lucro_mes3 || 0);
          const entryLogs = logsByEntry[entry.id] || [];

          return (
            <div key={entry.id} className="rounded-lg border bg-card p-4 space-y-3">
                {/* Company header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{entry.clients?.trade_name || entry.clients?.legal_name || "—"}</h3>
                    <span className="text-sm text-muted-foreground font-medium">Total: {formatCurrency(total)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.created_by && <span>Criado por: <span className="font-medium text-foreground">{getProfileName(entry.created_by)}</span></span>}
                  </div>
                </div>

                {/* Month cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[1, 2, 3].map((mesNum) => {
                  const mesStatus = getMesStatus(entry, mesNum);
                  const statusCfg = STATUS_CONFIG[mesStatus];
                  const lucro = getMesLucro(entry, mesNum);
                  const mesPartnerProfits = entryPartnerProfits.filter((pp) => pp.reinf_entry_id === entry.id && pp.mes === mesNum);
                  const contabilUser = getMesContabilUser(entry, mesNum);
                  const dpUser = getMesDpUser(entry, mesNum);
                  const fiscalUser = getMesFiscalUser(entry, mesNum);

                  return (
                    <Card key={mesNum} className="border flex flex-col h-full">
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm">{meses[mesNum - 1]}</span>
                            <Badge variant="outline" className={`text-xs ${statusCfg?.color}`}>
                              {statusCfg?.label ?? mesStatus}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2 flex flex-col flex-grow">
                          {/* Lucro value */}
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold">{formatCurrency(lucro || 0)}</span>
                            {mesStatus === "pendente_contabil" && canContabil &&
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={`Editar ${meses[mesNum - 1]}`} onClick={() => openEditDialog(entry, mesNum)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                          }
                          </div>

                          {/* Partner breakdown */}
                          {mesPartnerProfits.length > 0 &&
                        <div className="space-y-0.5 pl-2 border-l-2 border-muted">
                              {mesPartnerProfits.map((pp) => {
                            const partnerName = allPartners.find((p) => p.id === pp.partner_id)?.name || "?";
                            return (
                              <div key={pp.id} className="text-xs text-muted-foreground">
                                    {partnerName}: <span className="font-medium text-foreground">{formatCurrency(pp.valor)}</span>
                                  </div>);

                          })}
                            </div>
                        }

                          {/* Responsible users */}
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            {contabilUser && <div>Contábil: <span className="font-medium text-foreground">{getProfileName(contabilUser)}</span></div>}
                            {dpUser && <div>DP: <span className="font-medium text-foreground">{getProfileName(dpUser)}</span></div>}
                            {fiscalUser && <div>Fiscal: <span className="font-medium text-foreground">{getProfileName(fiscalUser)}</span></div>}
                          </div>

                          {/* Action buttons — pushed to bottom (no fiscal here, it's quarterly) */}
                          <div className="flex flex-wrap gap-1 pt-2 mt-auto border-t">
                            {mesStatus === "pendente_contabil" && canContabil &&
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => requestConfirmation(entry, mesNum, "advance")} disabled={!lucro}>
                                <Send className="h-3 w-3 mr-1" /> Enviar p/ DP
                              </Button>
                          }
                            {mesStatus === "contabil_ok" && canDP &&
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => requestConfirmation(entry, mesNum, "advance")}>
                                <Check className="h-3 w-3 mr-1" /> Aprovar
                              </Button>
                          }
                            {mesStatus === "dp_aprovado" &&
                          <span className="text-[10px] text-muted-foreground italic">Aguardando fechamento fiscal do trimestre</span>
                          }
                            {mesStatus === "enviado" &&
                          <span className="text-[10px] text-status-done font-medium">✓ Enviado</span>
                          }
                            {isAdmin && STATUS_CONFIG[mesStatus]?.prevAction && mesStatus !== "enviado" &&
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => requestConfirmation(entry, mesNum, "revert")}>
                                <Undo2 className="h-3 w-3 mr-1" /> Reverter
                              </Button>
                          }
                          </div>
                        </CardContent>
                      </Card>);

                })}
                </div>

                {/* Quarterly Fiscal action */}
                {allMonthsDpAprovado(entry) && canFiscal &&
              <div className="flex items-center gap-2 p-3 rounded-md border border-status-progress/30 bg-status-progress/5">
                    <Send className="h-4 w-4 text-status-progress" />
                    <span className="text-sm font-medium flex-1">Todos os meses aprovados pelo DP. Pronto para envio fiscal.</span>
                    <Button size="sm" onClick={() => requestFiscalConfirmation(entry, "advance")}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Enviar Fiscal (Trimestre)
                    </Button>
                  </div>
              }
                {allMonthsEnviado(entry) &&
              <div className="flex items-center gap-2 p-3 rounded-md border border-status-done/30 bg-status-done/5">
                    <Check className="h-4 w-4 text-status-done" />
                    <span className="text-sm font-medium text-status-done flex-1">EFD enviada pelo Fiscal ✓</span>
                    {isAdmin &&
                <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => requestFiscalConfirmation(entry, "revert")}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" /> Reverter Fiscal
                      </Button>
                }
                  </div>
              }

                {entryLogs.length > 0 &&
              <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground p-0 h-auto hover:bg-transparent">
                        <History className="h-3.5 w-3.5 mr-1" /> Histórico ({entryLogs.length}) <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 border-t pt-2 space-y-1.5">
                        {entryLogs.map((log) =>
                    <div key={log.id} className="text-xs flex gap-2">
                            <span className="text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</span>
                            <span className="font-medium">{getProfileName(log.user_id)}</span>
                            <span className="text-muted-foreground">—</span>
                            <span>{log.action}{log.details ? `: ${log.details}` : ""}</span>
                          </div>
                    )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
              }
              </div>);

        })}
        </div>
      }
    </div>);

}