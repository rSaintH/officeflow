import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParameterOptions } from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PARAM_TYPES = [
  { key: "task_status", label: "Status de Pendências" },
  { key: "task_type", label: "Tipos de Pendências" },
  { key: "task_priority", label: "Prioridades de Pendências" },
  { key: "occurrence_category", label: "Categorias de Ocorrências" },
];

export default function ParametersAdmin() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {PARAM_TYPES.map((pt) => (
        <ParamSection key={pt.key} type={pt.key} label={pt.label} />
      ))}
    </div>
  );
}

function ParamSection({ type, label }: { type: string; label: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: options } = useParameterOptions(type);
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  const addOption = async () => {
    if (!newValue.trim()) return;
    const maxOrder = options?.reduce((max: number, o: any) => Math.max(max, o.order_index), -1) ?? -1;
    const { error } = await supabase.from("parameter_options" as any).insert({
      type,
      value: newValue.trim(),
      color: newColor,
      order_index: maxOrder + 1,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["parameter_options"] });
    setNewValue("");
    toast({ title: "Opção adicionada!" });
  };

  const deleteOption = async (id: string) => {
    const { error } = await supabase.from("parameter_options" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["parameter_options"] });
    toast({ title: "Opção removida!" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Novo valor"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOption()}
            className="flex-1"
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-10 w-12 rounded border cursor-pointer"
          />
          <Button onClick={addOption} size="sm"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1">
          {options?.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                {o.color && (
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: o.color }} />
                )}
                <span className="text-sm font-medium">{o.value}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => deleteOption(o.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!options?.length && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma opção cadastrada.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
