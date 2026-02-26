import { useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useClients, usePermissionSettings } from "@/hooks/useSupabaseQuery";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
} from "lucide-react";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type StatusLevel = "green" | "yellow" | "red";

interface ClientAccountingInfo {
  clientId: string;
  legalName: string;
  tradeName: string | null;
  status: StatusLevel;
  essentialTotal: number;
  essentialReceived: number;
  necessaryTotal: number;
  necessaryReceived: number;
  missingDocs: { name: string; classification: string }[];
}

const statusConfig: Record<StatusLevel, { label: string; color: string; icon: typeof CheckCircle2; badgeBg: string }> = {
  green: {
    label: "Pronto para fazer",
    color: "text-green-600 dark:text-green-400",
    icon: CheckCircle2,
    badgeBg: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  yellow: {
    label: "Dá pra começar",
    color: "text-yellow-600 dark:text-yellow-400",
    icon: AlertTriangle,
    badgeBg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  },
  red: {
    label: "Documentos essenciais pendentes",
    color: "text-red-600 dark:text-red-400",
    icon: XCircle,
    badgeBg: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800",
  },
};

const statusBorderColors: Record<StatusLevel, string> = {
  green: "border-l-green-500",
  yellow: "border-l-yellow-500",
  red: "border-l-red-500",
};

export default function AccountingReady() {
  const { isAdmin, userRole, userSectorId } = useAuth();
  const { data: permissions } = usePermissionSettings();

  // Permission check (sector-based, only restricts colaboradores)
  const hasAccess = useMemo(() => {
    if (isAdmin) return true;
    if (userRole === "supervisao" || userRole === "supervisão") return true;
    const perm: any = permissions?.find((p: any) => p.key === "view_accounting_ready");
    if (!perm) return true;
    if (perm.allowed_sectors && perm.allowed_sectors.length > 0) {
      return userSectorId ? perm.allowed_sectors.includes(userSectorId) : false;
    }
    return true;
  }, [isAdmin, userRole, permissions, userSectorId]);

  const { data: clients, isLoading: loadingClients } = useClients();

  if (permissions && !hasAccess) return <Navigate to="/" replace />;

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const yearMonth = formatYearMonth(currentDate);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusLevel | "all">("all");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Fetch all document types (active only)
  const { data: allDocTypes, isLoading: loadingDocTypes } = useQuery({
    queryKey: ["all_document_types_active"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_types")
        .select("id, client_id, name, classification, is_active")
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all monthly statuses for this month
  const { data: allMonthlyStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ["all_document_monthly_status", yearMonth],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_monthly_status")
        .select("document_type_id, client_id, has_document")
        .eq("year_month", yearMonth);
      if (error) throw error;
      return data;
    },
    enabled: !!yearMonth,
  });

  // Compute accounting info per client
  const clientInfos: ClientAccountingInfo[] = useMemo(() => {
    if (!clients || !allDocTypes || !allMonthlyStatus) return [];

    // Index doc types by client
    const docTypesByClient: Record<string, typeof allDocTypes> = {};
    for (const dt of allDocTypes) {
      if (!docTypesByClient[dt.client_id]) docTypesByClient[dt.client_id] = [];
      docTypesByClient[dt.client_id].push(dt);
    }

    // Index statuses by document_type_id
    const statusByDocType: Record<string, boolean> = {};
    for (const s of allMonthlyStatus) {
      statusByDocType[s.document_type_id] = s.has_document;
    }

    const activeClients = clients.filter((c: any) => c.status === "Ativo");

    return activeClients.map((client: any) => {
      const docTypes = docTypesByClient[client.id] || [];
      const essentialDocs = docTypes.filter((d) => d.classification === "essencial");
      const necessaryDocs = docTypes.filter((d) => d.classification === "necessario");

      const essentialReceived = essentialDocs.filter((d) => statusByDocType[d.id] === true).length;
      const necessaryReceived = necessaryDocs.filter((d) => statusByDocType[d.id] === true).length;

      const allEssentialReceived = essentialDocs.length === 0 || essentialReceived === essentialDocs.length;
      const allNecessaryReceived = necessaryDocs.length === 0 || necessaryReceived === necessaryDocs.length;

      let status: StatusLevel;
      if (allEssentialReceived && allNecessaryReceived) {
        status = "green";
      } else if (allEssentialReceived) {
        status = "yellow";
      } else {
        status = "red";
      }

      // Missing docs
      const missingDocs: { name: string; classification: string }[] = [];
      for (const d of essentialDocs) {
        if (statusByDocType[d.id] !== true) {
          missingDocs.push({ name: d.name, classification: "essencial" });
        }
      }
      for (const d of necessaryDocs) {
        if (statusByDocType[d.id] !== true) {
          missingDocs.push({ name: d.name, classification: "necessario" });
        }
      }

      return {
        clientId: client.id,
        legalName: client.legal_name,
        tradeName: client.trade_name,
        status,
        essentialTotal: essentialDocs.length,
        essentialReceived,
        necessaryTotal: necessaryDocs.length,
        necessaryReceived,
        missingDocs,
      };
    });
  }, [clients, allDocTypes, allMonthlyStatus]);

  // Filter and search
  const filteredInfos = useMemo(() => {
    let result = clientInfos;

    if (filterStatus !== "all") {
      result = result.filter((c) => c.status === filterStatus);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.legalName.toLowerCase().includes(term) ||
          (c.tradeName || "").toLowerCase().includes(term)
      );
    }

    return result;
  }, [clientInfos, filterStatus, search]);

  const toggleExpand = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  // Counts
  const counts = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0 };
    for (const info of clientInfos) c[info.status]++;
    return c;
  }, [clientInfos]);

  const isLoading = loadingClients || loadingDocTypes || loadingStatus;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contabilidades Prontas</h1>
          <p className="text-sm text-muted-foreground">
            Status de documentos recebidos para contabilidade mensal
          </p>
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

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          className={`cursor-pointer ${statusConfig.green.badgeBg} ${filterStatus === "green" ? "ring-2 ring-green-400" : ""}`}
          variant="outline"
          onClick={() => setFilterStatus(filterStatus === "green" ? "all" : "green")}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {counts.green} pronta(s)
        </Badge>
        <Badge
          className={`cursor-pointer ${statusConfig.yellow.badgeBg} ${filterStatus === "yellow" ? "ring-2 ring-yellow-400" : ""}`}
          variant="outline"
          onClick={() => setFilterStatus(filterStatus === "yellow" ? "all" : "yellow")}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          {counts.yellow} parcial(is)
        </Badge>
        <Badge
          className={`cursor-pointer ${statusConfig.red.badgeBg} ${filterStatus === "red" ? "ring-2 ring-red-400" : ""}`}
          variant="outline"
          onClick={() => setFilterStatus(filterStatus === "red" ? "all" : "red")}
        >
          <XCircle className="h-3 w-3 mr-1" />
          {counts.red} pendente(s)
        </Badge>
        {filterStatus !== "all" && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setFilterStatus("all")}>
            <Filter className="h-3 w-3 mr-1" /> Limpar filtro
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredInfos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Nenhuma empresa encontrada{filterStatus !== "all" ? " com este filtro" : ""}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredInfos.map((info) => {
            const config = statusConfig[info.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedClients.has(info.clientId);

            return (
              <div
                key={info.clientId}
                className={`border rounded-lg border-l-4 ${statusBorderColors[info.status]} bg-card transition-shadow hover:shadow-md`}
              >
                {/* Card header - clickable */}
                <button
                  onClick={() => toggleExpand(info.clientId)}
                  className="w-full text-left p-3 flex items-start gap-3"
                >
                  <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{info.legalName}</p>
                    {info.tradeName && (
                      <p className="text-xs text-muted-foreground truncate">{info.tradeName}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      <span className="text-xs">
                        <span className="font-medium text-red-600 dark:text-red-400">Essenciais:</span>{" "}
                        {info.essentialReceived}/{info.essentialTotal}
                      </span>
                      <span className="text-xs">
                        <span className="font-medium text-yellow-600 dark:text-yellow-400">Necessários:</span>{" "}
                        {info.necessaryReceived}/{info.necessaryTotal}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t">
                    {info.missingDocs.length === 0 ? (
                      <p className="text-xs text-green-600 dark:text-green-400 pt-2">
                        Todos os documentos essenciais e necessários foram recebidos.
                      </p>
                    ) : (
                      <div className="pt-2 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Documentos faltantes ({info.missingDocs.length}):
                        </p>
                        {info.missingDocs.map((doc, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs py-0.5"
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                                doc.classification === "essencial"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                              }`}
                            />
                            <span className="truncate">{doc.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 shrink-0 ${
                                doc.classification === "essencial"
                                  ? "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300"
                                  : "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-300"
                              }`}
                            >
                              {doc.classification === "essencial" ? "Essencial" : "Necessário"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
