import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDocumentTypes, useDocumentMonthlyStatus } from "@/hooks/useSupabaseQuery";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff } from "lucide-react";

interface Props {
  clientId: string;
  yearMonth: string;
}

const classificationColors: Record<string, string> = {
  essencial: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  necessario: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  irrelevante: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const classificationLabels: Record<string, string> = {
  essencial: "Essencial",
  necessario: "Necessário",
  irrelevante: "Irrelevante",
};

export default function DocumentMonthlyChecklist({ clientId, yearMonth }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: docTypes, isLoading: loadingTypes } = useDocumentTypes(clientId);
  const { data: monthlyStatus, isLoading: loadingStatus } = useDocumentMonthlyStatus(clientId, yearMonth);
  const [showInactive, setShowInactive] = useState(false);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [savingObs, setSavingObs] = useState<Record<string, boolean>>({});

  // Build a map of document_type_id -> monthly status
  const statusMap: Record<string, any> = {};
  monthlyStatus?.forEach((s: any) => {
    statusMap[s.document_type_id] = s;
  });

  // Sync observations from DB
  useEffect(() => {
    if (monthlyStatus) {
      const obs: Record<string, string> = {};
      monthlyStatus.forEach((s: any) => {
        if (s.observation) obs[s.document_type_id] = s.observation;
      });
      setObservations(obs);
    }
  }, [monthlyStatus]);

  const activeDocTypes = docTypes?.filter((d: any) => showInactive || d.is_active) || [];

  const toggleDocument = useCallback(async (docTypeId: string, currentHas: boolean) => {
    try {
      const existing = statusMap[docTypeId];
      if (existing) {
        const { error } = await supabase.from("document_monthly_status")
          .update({ has_document: !currentHas, updated_by: user?.id })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("document_monthly_status").insert({
          document_type_id: docTypeId,
          client_id: clientId,
          year_month: yearMonth,
          has_document: !currentHas,
          updated_by: user?.id,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["document_monthly_status", clientId, yearMonth] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  }, [statusMap, clientId, yearMonth, user?.id, queryClient, toast]);

  const saveObservation = useCallback(async (docTypeId: string) => {
    setSavingObs((prev) => ({ ...prev, [docTypeId]: true }));
    try {
      const existing = statusMap[docTypeId];
      const obsText = observations[docTypeId] || "";
      if (existing) {
        const { error } = await supabase.from("document_monthly_status")
          .update({ observation: obsText || null, updated_by: user?.id })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("document_monthly_status").insert({
          document_type_id: docTypeId,
          client_id: clientId,
          year_month: yearMonth,
          has_document: false,
          observation: obsText || null,
          updated_by: user?.id,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["document_monthly_status", clientId, yearMonth] });
      toast({ title: "Observação salva!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingObs((prev) => ({ ...prev, [docTypeId]: false }));
    }
  }, [statusMap, observations, clientId, yearMonth, user?.id, queryClient, toast]);

  if (loadingTypes || loadingStatus) {
    return <div className="text-sm text-muted-foreground py-4">Carregando documentos...</div>;
  }

  if (!docTypes || docTypes.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">Nenhum documento cadastrado para esta empresa.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {activeDocTypes.filter((d: any) => statusMap[d.id]?.has_document).length}/{activeDocTypes.filter((d: any) => d.is_active).length} documentos recebidos
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowInactive(!showInactive)}
        >
          {showInactive ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
          {showInactive ? "Ocultar inativos" : "Mostrar inativos"}
        </Button>
      </div>

      <div className="space-y-1">
        {activeDocTypes.map((doc: any) => {
          const status = statusMap[doc.id];
          const hasDoc = status?.has_document ?? false;
          const isMissing = !hasDoc;
          const obsValue = observations[doc.id] ?? "";

          return (
            <div key={doc.id} className={`rounded-md border ${!doc.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-3 p-2.5">
                <Checkbox
                  checked={hasDoc}
                  onCheckedChange={() => toggleDocument(doc.id, hasDoc)}
                  disabled={!doc.is_active}
                />
                <span className={`flex-1 text-sm ${hasDoc ? "line-through text-muted-foreground" : "font-medium"}`}>
                  {doc.name}
                </span>
                <Badge variant="outline" className={`text-[10px] ${classificationColors[doc.classification]}`}>
                  {classificationLabels[doc.classification]}
                </Badge>
                {!doc.is_active && (
                  <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                )}
              </div>

              {/* Observation area for missing documents */}
              {isMissing && doc.is_active && (
                <div className="px-2.5 pb-2.5 pt-0">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Observação (opcional)"
                      value={obsValue}
                      onChange={(e) => setObservations({ ...observations, [doc.id]: e.target.value })}
                      rows={1}
                      className="text-xs min-h-[32px] resize-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0"
                      onClick={() => saveObservation(doc.id)}
                      disabled={savingObs[doc.id]}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
