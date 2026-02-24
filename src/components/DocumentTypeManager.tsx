import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDocumentTypes } from "@/hooks/useSupabaseQuery";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Pencil } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
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

export default function DocumentTypeManager({ open, onClose, clientId, clientName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: docTypes, isLoading } = useDocumentTypes(clientId);

  const [newName, setNewName] = useState("");
  const [newClassification, setNewClassification] = useState("necessario");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editClassification, setEditClassification] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const maxOrder = docTypes?.length ? Math.max(...docTypes.map((d: any) => d.order_index)) + 1 : 0;
      const { error } = await supabase.from("document_types").insert({
        client_id: clientId,
        name: newName.trim(),
        classification: newClassification,
        order_index: maxOrder,
        created_by: user?.id,
        updated_by: user?.id,
      });
      if (error) throw error;
      setNewName("");
      setNewClassification("necessario");
      queryClient.invalidateQueries({ queryKey: ["document_types", clientId] });
      toast({ title: "Documento adicionado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (doc: any) => {
    try {
      const { error } = await supabase.from("document_types")
        .update({ is_active: !doc.is_active, updated_by: user?.id })
        .eq("id", doc.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["document_types", clientId] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleReport = async (doc: any) => {
    try {
      const { error } = await supabase.from("document_types")
        .update({ include_in_report: !doc.include_in_report, updated_by: user?.id })
        .eq("id", doc.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["document_types", clientId] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("document_types").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["document_types", clientId] });
      toast({ title: "Documento removido!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      const { error } = await supabase.from("document_types")
        .update({ name: editName.trim(), classification: editClassification, updated_by: user?.id })
        .eq("id", editingId);
      if (error) throw error;
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["document_types", clientId] });
      toast({ title: "Documento atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const startEdit = (doc: any) => {
    setEditingId(doc.id);
    setEditName(doc.name);
    setEditClassification(doc.classification);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Documentos - {clientName}</DialogTitle>
        </DialogHeader>

        {/* Add new document */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nome do documento</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Balancete mensal"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="w-40 space-y-1">
            <Label className="text-xs">Classificação</Label>
            <Select value={newClassification} onValueChange={setNewClassification}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="essencial">Essencial</SelectItem>
                <SelectItem value="necessario">Necessário</SelectItem>
                <SelectItem value="irrelevante">Irrelevante</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={saving || !newName.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        {/* Document list */}
        <div className="space-y-1 mt-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {docTypes?.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>
          )}
          {docTypes?.map((doc: any) => (
            <div
              key={doc.id}
              className={`flex items-center gap-2 p-2 rounded-md border ${!doc.is_active ? "opacity-50" : ""}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

              {editingId === doc.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-8"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                  />
                  <Select value={editClassification} onValueChange={setEditClassification}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="essencial">Essencial</SelectItem>
                      <SelectItem value="necessario">Necessário</SelectItem>
                      <SelectItem value="irrelevante">Irrelevante</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8" onClick={handleSaveEdit}>Salvar</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancelar</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{doc.name}</span>
                  <Badge variant="outline" className={classificationColors[doc.classification]}>
                    {classificationLabels[doc.classification]}
                  </Badge>
                  <div className="flex items-center gap-1" title="Incluir no relatório">
                    <Label className="text-[10px] text-muted-foreground">Relatório</Label>
                    <Switch
                      checked={doc.include_in_report}
                      onCheckedChange={() => handleToggleReport(doc)}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center gap-1" title={doc.is_active ? "Ativo" : "Inativo"}>
                    <Label className="text-[10px] text-muted-foreground">Ativo</Label>
                    <Switch
                      checked={doc.is_active}
                      onCheckedChange={() => handleToggleActive(doc)}
                      className="scale-75"
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(doc)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
