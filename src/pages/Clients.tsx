import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useClients, useTags } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Building, ChevronRight } from "lucide-react";
import ClientFormDialog from "@/components/ClientFormDialog";
import { getClientStatusBadgeClass } from "@/lib/constants";

function useAllClientTags() {
  return useQuery({
    queryKey: ["all_client_tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_tags").select("client_id, tag_id");
      if (error) throw error;
      return data;
    },
  });
}

export default function Clients() {
  const { data: clients, isLoading } = useClients();
  const { data: tags } = useTags();
  const { data: allClientTags } = useAllClientTags();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    const id = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(id);
  }, []);

  // Clear pending timeout on unmount
  useState(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return () => clearTimeout(timeout);
  });

  const tagMap = useMemo(() => new Map(tags?.map((t: any) => [t.id, t]) || []), [tags]);

  const getClientTags = useCallback((clientId: string) => {
    return allClientTags
      ?.filter((ct) => ct.client_id === clientId)
      .map((ct) => tagMap.get(ct.tag_id))
      .filter(Boolean) || [];
  }, [allClientTags, tagMap]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return clients?.filter(
      (c) =>
        c.legal_name.toLowerCase().includes(q) ||
        c.trade_name?.toLowerCase().includes(q) ||
        c.cnpj?.includes(debouncedSearch)
    );
  }, [clients, debouncedSearch]);


  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox checked={showTags} onCheckedChange={(v) => setShowTags(!!v)} />
            <span className="text-sm text-muted-foreground">Mostrar tags</span>
          </label>
          {isAdmin && (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo cliente
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, razão social ou CNPJ..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered?.map((client) => {
            const clientTags = showTags ? getClientTags(client.id) : [];
            return (
              <Link key={client.id} to={`/clients/${client.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">
                          {client.trade_name || client.legal_name}
                        </p>
                        {showTags && clientTags.map((tag: any) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            style={{ borderColor: tag.color, color: tag.color }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                      {client.trade_name && (
                        <p className="text-xs text-muted-foreground truncate">{client.legal_name}</p>
                      )}
                      {client.cnpj && (
                        <p className="text-xs text-muted-foreground font-mono">{client.cnpj}</p>
                      )}
                    </div>
                    <Badge className={getClientStatusBadgeClass(client.status)} variant="outline">
                      {client.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {showForm && <ClientFormDialog open={showForm} onClose={() => setShowForm(false)} />}
    </div>
  );
}