import { useState, useMemo, memo } from "react";
import {
  useClients,
  useClientPops,
  useClientParticularities,
  useTasks,
  useOccurrences,
  useSectors,
} from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Search,
  FileText,
  AlertTriangle,
  ClipboardList,
  MessageSquare,
  Building2,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";

export default function Index() {
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const { data: clients } = useClients();
  const { data: sectors } = useSectors();

  const selectedClient = useMemo(
    () => clients?.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    if (!search.trim() || !clients) return [];
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.legal_name.toLowerCase().includes(q) ||
        c.trade_name?.toLowerCase().includes(q) ||
        c.cnpj?.includes(q)
    ).slice(0, 8);
  }, [clients, search]);

  // Data for selected client
  const { data: pops } = useClientPops(selectedClientId ?? "");
  const { data: particularities } = useClientParticularities(selectedClientId ?? "");
  const { data: tasks } = useTasks({ clientId: selectedClientId ?? undefined });
  const { data: occurrences } = useOccurrences(selectedClientId ?? undefined);

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    const client = clients?.find((c) => c.id === id);
    setSearch(client?.legal_name ?? "");
    setShowResults(false);
  };

  const handleClear = () => {
    setSelectedClientId(null);
    setSearch("");
  };

  // Group data by sector
  const sectorData = useMemo(() => {
    if (!sectors) return [];
    return sectors.map((sector) => ({
      sector,
      pops: pops?.filter((p: any) => p.sector_id === sector.id) ?? [],
      particularities: particularities?.filter((p: any) => p.sector_id === sector.id) ?? [],
      tasks: tasks?.filter((t: any) => t.sector_id === sector.id) ?? [],
      occurrences: occurrences?.filter((o: any) => o.sector_id === sector.id) ?? [],
    }));
  }, [sectors, pops, particularities, tasks, occurrences]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Área de Trabalho</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione um cliente para visualizar informações por setor
        </p>
      </div>

      {/* Client search */}
      <div className="relative max-w-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente por nome ou CNPJ..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
              if (!e.target.value.trim()) setSelectedClientId(null);
            }}
            onFocus={() => setShowResults(true)}
            className="pl-9 pr-4"
          />
        </div>

        {showResults && filteredClients.length > 0 && !selectedClientId && (
          <Card className="absolute z-50 w-full mt-1 shadow-lg">
            <CardContent className="p-1">
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectClient(c.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.legal_name}</p>
                    {c.trade_name && (
                      <p className="text-xs text-muted-foreground truncate">{c.trade_name}</p>
                    )}
                  </div>
                  {c.cnpj && (
                    <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                      {c.cnpj}
                    </span>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected client info */}
      {selectedClient && (
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm py-1 px-3 gap-2">
            <Building2 className="h-3.5 w-3.5" />
            {selectedClient.legal_name}
            {selectedClient.trade_name && ` (${selectedClient.trade_name})`}
          </Badge>
          <button
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Trocar cliente
          </button>
        </div>
      )}

      {/* No client selected */}
      {!selectedClientId && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum cliente selecionado</p>
            <p className="text-sm mt-1">Use a busca acima para começar</p>
          </CardContent>
        </Card>
      )}

      {/* Sector tabs */}
      {selectedClientId && sectors && sectors.length > 0 && (
        <Tabs defaultValue={sectors[0]?.id} className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {sectors.map((s) => {
              const sd = sectorData.find((d) => d.sector.id === s.id);
              const totalItems =
                (sd?.tasks.length ?? 0) +
                (sd?.particularities.length ?? 0) +
                (sd?.pops.length ?? 0) +
                (sd?.occurrences.length ?? 0);
              const overdueCount = sd?.tasks.filter(
                (t: any) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
              ).length ?? 0;

              return (
                <TabsTrigger key={s.id} value={s.id} className="gap-1.5 text-sm">
                  {s.name}
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      {overdueCount}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {sectorData.map(({ sector, pops: sPops, particularities: sPartics, tasks: sTasks, occurrences: sOccurrences }) => (
            <TabsContent key={sector.id} value={sector.id} className="mt-4 space-y-4">
              {/* Pendências */}
              <SectionBlock
                title="Pendências"
                icon={<ClipboardList className="h-4 w-4" />}
                count={sTasks.length}
                emptyText="Nenhuma pendência neste setor"
              >
                {sTasks.map((t: any) => {
                  const overdue = t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
                  return (
                    <div key={t.id} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={overdue ? "destructive" : "secondary"} className="text-[10px]">
                          {t.status}
                        </Badge>
                        {t.due_date && (
                          <span className={`text-[11px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {format(new Date(t.due_date), "dd/MM")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </SectionBlock>

              {/* Particularidades */}
              <SectionBlock
                title="Particularidades"
                icon={<AlertTriangle className="h-4 w-4" />}
                count={sPartics.length}
                emptyText="Nenhuma particularidade registrada"
              >
                {sPartics.map((p: any) => (
                  <div key={p.id} className="py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{p.title}</p>
                      <Badge variant="outline" className="text-[10px]">{p.priority}</Badge>
                    </div>
                    {p.details && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.details}</p>
                    )}
                  </div>
                ))}
              </SectionBlock>

              {/* POPs */}
              <SectionBlock
                title="POPs"
                icon={<FileText className="h-4 w-4" />}
                count={sPops.length}
                emptyText="Nenhum POP disponível"
              >
                {sPops.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between py-2 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.title}</p>
                      {p.objective && (
                        <p className="text-xs text-muted-foreground truncate">{p.objective}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px]">{p.scope}</Badge>
                      <Badge variant="secondary" className="text-[10px]">v{p.version}</Badge>
                    </div>
                  </div>
                ))}
              </SectionBlock>

              {/* Ocorrências */}
              <SectionBlock
                title="Ocorrências"
                icon={<MessageSquare className="h-4 w-4" />}
                count={sOccurrences.length}
                emptyText="Nenhuma ocorrência registrada"
              >
                {sOccurrences.map((o: any) => (
                  <div key={o.id} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{o.title}</p>
                      {o.description && (
                        <p className="text-xs text-muted-foreground truncate">{o.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px]">{o.category}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(o.occurred_at), "dd/MM")}
                      </span>
                    </div>
                  </div>
                ))}
              </SectionBlock>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

const SectionBlock = memo(function SectionBlock({
  title,
  icon,
  count,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
});
