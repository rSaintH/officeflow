import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSectors, useSections, useProfiles, useSectorStyles, useTags, useDocTags, usePermissionSettings, useManagementConfig } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Layers, Users, Palette, Tag, UserPlus, Eye, EyeOff, Settings2, Upload, FileText, Pencil, Key, Check, X, Shield, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import ParametersAdmin from "@/components/ParametersAdmin";
import ClientCsvImport from "@/components/ClientCsvImport";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Admin() {
  const { isAdmin, userRole } = useAuth();
  const isSupervisor = userRole === "supervisao" || userRole === "supervisão";
  const canAccessAdmin = isAdmin || isSupervisor;

  if (!canAccessAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Administração</h1>
      <Tabs defaultValue="sectors">
        <TabsList>
          <TabsTrigger value="sectors" className="gap-1"><Layers className="h-3 w-3" /> Setores & Seções</TabsTrigger>
          <TabsTrigger value="styles" className="gap-1"><Palette className="h-3 w-3" /> Estilos</TabsTrigger>
          <TabsTrigger value="tags" className="gap-1"><Tag className="h-3 w-3" /> Tags</TabsTrigger>
          <TabsTrigger value="doc-tags" className="gap-1"><FileText className="h-3 w-3" /> Tags de Documentos</TabsTrigger>
          <TabsTrigger value="parameters" className="gap-1"><Settings2 className="h-3 w-3" /> Parâmetros</TabsTrigger>
          <TabsTrigger value="import" className="gap-1"><Upload className="h-3 w-3" /> Importar CSV</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-3 w-3" /> Usuários</TabsTrigger>
          {!isSupervisor && (
            <TabsTrigger value="management" className="gap-1"><ShieldCheck className="h-3 w-3" /> Gerência</TabsTrigger>
          )}
          {!isSupervisor && (
            <TabsTrigger value="permissions" className="gap-1"><Shield className="h-3 w-3" /> Permissões</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="sectors" className="mt-4"><SectorsAdmin canManageSectors={isAdmin} /></TabsContent>
        <TabsContent value="styles" className="mt-4"><StylesAdmin /></TabsContent>
        <TabsContent value="tags" className="mt-4"><TagsAdmin /></TabsContent>
        <TabsContent value="doc-tags" className="mt-4"><DocTagsAdmin /></TabsContent>
        <TabsContent value="parameters" className="mt-4"><ParametersAdmin /></TabsContent>
        <TabsContent value="import" className="mt-4"><ClientCsvImport /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersAdmin readOnly={isSupervisor} /></TabsContent>
        {!isSupervisor && (
          <TabsContent value="management" className="mt-4"><ManagementAdmin /></TabsContent>
        )}
        {!isSupervisor && (
          <TabsContent value="permissions" className="mt-4"><PermissionsAdmin /></TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SectorsAdmin({ canManageSectors }: { canManageSectors: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sectors } = useSectors();
  const { data: sections } = useSections();
  const [newSector, setNewSector] = useState("");
  const [newSection, setNewSection] = useState("");
  const [sectionSectorId, setSectionSectorId] = useState("");

  const addSector = async () => {
    if (!newSector.trim()) return;
    const { error } = await supabase.from("sectors").insert({
      name: newSector.trim(),
      created_by: user?.id,
      updated_by: user?.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["sectors"] });
    setNewSector("");
    toast({ title: "Setor criado!" });
  };

  const addSection = async () => {
    if (!newSection.trim() || !sectionSectorId) return;
    const { error } = await supabase.from("sections").insert({
      name: newSection.trim(),
      sector_id: sectionSectorId,
      created_by: user?.id,
      updated_by: user?.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["sections"] });
    setNewSection("");
    toast({ title: "Seção criada!" });
  };

  return (
    <div className={canManageSectors ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "grid grid-cols-1 gap-6"}>
      {canManageSectors && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Setores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nome do setor"
                value={newSector}
                onChange={(e) => setNewSector(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSector()}
              />
              <Button onClick={addSector} size="sm"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {sectors?.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge variant={s.is_active ? "default" : "secondary"} className="text-xs">
                    {s.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              ))}
              {!sectors?.length && <p className="text-sm text-muted-foreground text-center py-4">Nenhum setor.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={sectionSectorId} onValueChange={setSectionSectorId}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                {sectors?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Nome da seção"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSection()}
              className="flex-1"
            />
            <Button onClick={addSection} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {sections?.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <div>
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({s.sectors?.name})</span>
                </div>
              </div>
            ))}
            {!sections?.length && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma seção.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StylesAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sectors } = useSectors();
  const { data: styles } = useSectorStyles();
  const [sectorId, setSectorId] = useState("");
  const [newStyle, setNewStyle] = useState("");

  const addStyle = async () => {
    if (!newStyle.trim() || !sectorId) return;
    const { error } = await supabase.from("sector_styles").insert({
      sector_id: sectorId,
      name: newStyle.trim(),
      created_by: user?.id,
      updated_by: user?.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["sector_styles"] });
    setNewStyle("");
    toast({ title: "Estilo criado!" });
  };

  const grouped = sectors?.map((s) => ({
    ...s,
    styles: styles?.filter((st: any) => st.sector_id === s.id) || [],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estilos por Setor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={sectorId} onValueChange={setSectorId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              {sectors?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Nome do estilo (ex: A, B, C)"
            value={newStyle}
            onChange={(e) => setNewStyle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStyle()}
            className="flex-1"
          />
          <Button onClick={addStyle} size="sm"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-3">
          {grouped?.map((sector) => (
            <div key={sector.id}>
              <p className="text-sm font-medium mb-1">{sector.name}</p>
              {sector.styles.length === 0 ? (
                <p className="text-xs text-muted-foreground ml-2">Nenhum estilo cadastrado</p>
              ) : (
                <div className="flex flex-wrap gap-1 ml-2">
                  {sector.styles.map((st: any) => (
                    <Badge key={st.id} variant="outline">{st.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersAdmin({ readOnly = false }: { readOnly?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profiles } = useProfiles();
  const { data: sectors } = useSectors();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<string>("colaborador");
  const [newSectorId, setNewSectorId] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit states
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const changeRole = async (userId: string, newRoleValue: string) => {
    try {
      // Remove all existing roles for this user
      const { error: delError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delError) throw delError;
      // Insert the new role
      const { error: insError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRoleValue });
      if (insError) throw insError;
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Cargo atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const updateSector = async (userId: string, sectorId: string | null) => {
    try {
      const res = await supabase.functions.invoke("update-user", {
        body: { user_id: userId, sector_id: sectorId },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Setor atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const saveEditName = async (userId: string) => {
    if (!editNameValue.trim()) return;
    setSavingEdit(true);
    try {
      const res = await supabase.functions.invoke("update-user", {
        body: { user_id: userId, full_name: editNameValue.trim() },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setEditingNameId(null);
      toast({ title: "Nome atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const saveEditPassword = async (userId: string) => {
    if (!editPasswordValue.trim() || editPasswordValue.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await supabase.functions.invoke("update-user", {
        body: { user_id: userId, password: editPasswordValue },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      setEditingPasswordId(null);
      setEditPasswordValue("");
      toast({ title: "Senha atualizada! O usuário precisará trocar no próximo login." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const createUser = async () => {
    if (!newEmail.trim() || !newPassword.trim() || !newFullName.trim()) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: newEmail.trim(),
          password: newPassword,
          full_name: newFullName.trim(),
          sector_id: newSectorId || null,
        },
      });
      if (res.error) throw new Error(res.error.message || "Erro ao criar usuário");
      if (res.data?.error) throw new Error(res.data.error);
      const newUserId = res.data?.user?.id;
      if (newUserId) {
        await supabase.from("user_roles").insert({ user_id: newUserId, role: newRole });
      }
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("colaborador");
      setNewSectorId("");
      toast({ title: "Usuário criado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Criar Novo Usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome completo</Label>
                <Input
                  placeholder="Nome completo"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="supervisao">Supervisão</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Setor</Label>
                <Select value={newSectorId} onValueChange={setNewSectorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {sectors?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Senha</Label>
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button onClick={createUser} size="sm" disabled={creating}>
                    {creating ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profiles?.map((p: any) => {
              const currentRole = p.user_roles?.[0]?.role || "colaborador";
              const roleLabel = ROLE_LABELS[currentRole] || currentRole;
              const sectorLabel = sectors?.find((s) => s.id === p.sector_id)?.name || "Sem setor";

              if (readOnly) {
                return (
                  <div key={p.id} className="p-3 rounded bg-muted/50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{p.full_name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{sectorLabel}</Badge>
                        <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={p.id} className="p-3 rounded bg-muted/50 space-y-2">
                  <div className="flex items-center gap-3">
                    {/* Name (editable) */}
                    <div className="min-w-0 flex-1">
                      {editingNameId === p.user_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="h-7 text-sm"
                            onKeyDown={(e) => e.key === "Enter" && saveEditName(p.user_id)}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEditName(p.user_id)} disabled={savingEdit}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingNameId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium">{p.full_name || "Sem nome"}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => { setEditingNameId(p.user_id); setEditNameValue(p.full_name || ""); }}
                            title="Editar nome"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </div>

                    {/* Sector */}
                    <Select
                      value={p.sector_id || "none"}
                      onValueChange={(val) => updateSector(p.user_id, val === "none" ? null : val)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue placeholder="Setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem setor</SelectItem>
                        {sectors?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Role select */}
                    <Select
                      value={currentRole}
                      onValueChange={(val) => changeRole(p.user_id, val)}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="colaborador">Colaborador</SelectItem>
                        <SelectItem value="supervisao">Supervisão</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Change password button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        setEditingPasswordId(editingPasswordId === p.user_id ? null : p.user_id);
                        setEditPasswordValue("");
                      }}
                      title="Alterar senha"
                    >
                      <Key className="h-3.5 w-3.5" />
                      Senha
                    </Button>
                  </div>

                  {/* Password edit row */}
                  {editingPasswordId === p.user_id && (
                    <div className="flex items-center gap-2 pl-1">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Nova senha:</Label>
                      <Input
                        type="password"
                        value={editPasswordValue}
                        onChange={(e) => setEditPasswordValue(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="h-7 text-sm max-w-xs"
                        onKeyDown={(e) => e.key === "Enter" && saveEditPassword(p.user_id)}
                        autoFocus
                      />
                      <Button size="sm" className="h-7" onClick={() => saveEditPassword(p.user_id)} disabled={savingEdit}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingPasswordId(null); setEditPasswordValue(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {!profiles?.length && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TagsAdmin() {
   const { user } = useAuth();
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const { data: tags } = useTags();
   const [newTag, setNewTag] = useState("");
   const [newTagColor, setNewTagColor] = useState("#3b82f6");

   const addTag = async () => {
     if (!newTag.trim()) return;
     const { error } = await supabase.from("tags").insert({
       name: newTag.trim(),
       color: newTagColor,
       created_by: user?.id,
     });
     if (error) {
       toast({ title: "Erro", description: error.message, variant: "destructive" });
       return;
     }
     queryClient.invalidateQueries({ queryKey: ["tags"] });
     setNewTag("");
     toast({ title: "Tag criada!" });
   };

   const deleteTag = async (tagId: string) => {
     try {
       const { error } = await supabase.from("tags").delete().eq("id", tagId);
       if (error) throw error;
       queryClient.invalidateQueries({ queryKey: ["tags"] });
       toast({ title: "Tag excluída!" });
     } catch (err: any) {
       toast({ title: "Erro", description: err.message, variant: "destructive" });
     }
   };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tags de Empresas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nome da tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="h-10 w-12 rounded border"
            />
            <Button onClick={addTag} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
         <div className="space-y-2">
           {tags?.map((t: any) => (
             <div key={t.id} className="flex items-center justify-between p-3 rounded bg-muted/50">
               <div className="flex items-center gap-2">
                 <div
                   className="h-4 w-4 rounded"
                   style={{ backgroundColor: t.color || "#3b82f6" }}
                 />
                 <span className="text-sm font-medium">{t.name}</span>
               </div>
               <div className="flex items-center gap-2">
                 <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs">
                   {t.is_active ? "Ativa" : "Inativa"}
                 </Badge>
                 <Button 
                   variant="destructive" 
                   size="sm"
                   onClick={() => deleteTag(t.id)}
                 >
                   Excluir
                 </Button>
               </div>
             </div>
           ))}
           {!tags?.length && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag.</p>}
         </div>
      </CardContent>
    </Card>
  );
}

function DocTagsAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: docTags } = useDocTags();
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [newTagTextColor, setNewTagTextColor] = useState("#ffffff");

  const addTag = async () => {
    if (!newTag.trim()) return;
    const { error } = await supabase.from("doc_tags").insert({
      name: newTag.trim(),
      color: newTagColor,
      text_color: newTagTextColor,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["doc_tags"] });
    setNewTag("");
    toast({ title: "Tag de documento criada!" });
  };

  const deleteTag = async (tagId: string) => {
    try {
      const { error } = await supabase.from("doc_tags").delete().eq("id", tagId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["doc_tags"] });
      toast({ title: "Tag excluída!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tags de Documentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <Input
            placeholder="Nome da tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
          />
          <div className="flex items-center gap-1.5">
            <div className="text-center">
              <Label className="text-[10px] text-muted-foreground">Fundo</Label>
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-9 w-10 rounded border cursor-pointer"
              />
            </div>
            <div className="text-center">
              <Label className="text-[10px] text-muted-foreground">Texto</Label>
              <input
                type="color"
                value={newTagTextColor}
                onChange={(e) => setNewTagTextColor(e.target.value)}
                className="h-9 w-10 rounded border cursor-pointer"
              />
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: newTagColor, color: newTagTextColor }}
            >
              {newTag || "Preview"}
            </span>
            <Button onClick={addTag} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          {docTags?.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: t.color || "#3b82f6", color: t.text_color || "#ffffff" }}
                >
                  {t.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs">
                  {t.is_active ? "Ativa" : "Inativa"}
                </Badge>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteTag(t.id)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
          {!docTags?.length && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag de documento.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Management Config (Gerência) ──

function ManagementAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profiles } = useProfiles();
  const { data: config, isLoading } = useManagementConfig();
  const [saving, setSaving] = useState(false);

  const reviewer1 = config?.find((c: any) => c.key === "reviewer_1")?.user_id || "";
  const reviewer2 = config?.find((c: any) => c.key === "reviewer_2")?.user_id || "";

  const handleSave = async (key: string, userId: string) => {
    if (!userId) return;
    setSaving(true);
    try {
      const existing = config?.find((c: any) => c.key === key);
      if (existing) {
        const { error } = await supabase
          .from("management_config" as any)
          .update({ user_id: userId, updated_by: user?.id, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("management_config" as any)
          .insert({ key, user_id: userId, updated_by: user?.id });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["management_config"] });
      toast({ title: "Conferente atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-4">Carregando...</div>;

  const userOptions = profiles?.filter((p: any) => p.user_id) || [];

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Conferentes da Gerência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Defina os dois conferentes que poderão marcar as checkboxes na aba Gerência.
            Cada conferente só poderá marcar a checkbox que lhe foi atribuída.
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Conferente 1</Label>
              <Select
                value={reviewer1}
                onValueChange={(v) => handleSave("reviewer_1", v)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Conferente 2</Label>
              <Select
                value={reviewer2}
                onValueChange={(v) => handleSave("reviewer_2", v)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PERMISSION_CONFIG: Record<string, { label: string; description: string; type: "roles" | "switch" | "sectors" }> = {
  restrict_collaborator_sectors: {
    label: "Restringir colaboradores ao próprio setor",
    description: "Quando ativado, colaboradores são redirecionados diretamente ao seu setor ao acessar um cliente, sem poder acessar outros setores.",
    type: "switch",
  },
  reinf_fill_profits: {
    label: "Preencher lucros na EFD-REINF",
    description: "Selecione quais cargos podem preencher os lucros na EFD-REINF:",
    type: "roles",
  },
  view_accounting_ready: {
    label: "Acesso à aba Contabilidades Prontas",
    description: "Selecione quais setores podem visualizar a aba Contabilidades Prontas:",
    type: "sectors",
  },
  view_management: {
    label: "Acesso à aba Gerência",
    description: "Selecione quais cargos podem visualizar a aba Gerência:",
    type: "roles",
  },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisao: "Supervisão",
  colaborador: "Colaborador",
};

const ALL_ROLES = ["admin", "supervisao", "colaborador"];

function PermissionsAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: permissions, isLoading } = usePermissionSettings();
  const { data: sectors } = useSectors();
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const toggleRole = async (permKey: string, role: string) => {
    const perm = permissions?.find((p: any) => p.key === permKey);
    if (!perm) return;
    const currentRoles: string[] = perm.allowed_roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r: string) => r !== role)
      : [...currentRoles, role];

    setSaving((prev) => ({ ...prev, [permKey]: true }));
    try {
      const { error } = await supabase
        .from("permission_settings")
        .update({ allowed_roles: newRoles, updated_by: user?.id })
        .eq("key", permKey);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["permission_settings"] });
      toast({ title: "Permissão atualizada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving((prev) => ({ ...prev, [permKey]: false }));
    }
  };

  const toggleSector = async (permKey: string, sectorId: string) => {
    const perm = permissions?.find((p: any) => p.key === permKey);
    if (!perm) return;
    const currentSectors: string[] = perm.allowed_sectors || [];
    const newSectors = currentSectors.includes(sectorId)
      ? currentSectors.filter((s: string) => s !== sectorId)
      : [...currentSectors, sectorId];

    setSaving((prev) => ({ ...prev, [permKey]: true }));
    try {
      const { error } = await supabase
        .from("permission_settings")
        .update({ allowed_sectors: newSectors, updated_by: user?.id })
        .eq("key", permKey);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["permission_settings"] });
      toast({ title: "Permissão atualizada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving((prev) => ({ ...prev, [permKey]: false }));
    }
  };

  const toggleSwitch = async (permKey: string, currentEnabled: boolean) => {
    setSaving((prev) => ({ ...prev, [permKey]: true }));
    try {
      const { error } = await supabase
        .from("permission_settings")
        .update({ enabled: !currentEnabled, updated_by: user?.id })
        .eq("key", permKey);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["permission_settings"] });
      toast({ title: !currentEnabled ? "Ativado!" : "Desativado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving((prev) => ({ ...prev, [permKey]: false }));
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-4">Carregando...</div>;

  // Sort: switches first, then role-based
  const orderedKeys = Object.keys(PERMISSION_CONFIG);

  return (
    <div className="border rounded-lg divide-y">
      {orderedKeys.map((key) => {
        const config = PERMISSION_CONFIG[key];
        const perm: any = permissions?.find((p: any) => p.key === key);
        if (!perm) return null;

        return (
          <div key={perm.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 px-4 py-3">
            <div className="sm:w-[280px] shrink-0">
              <p className="text-sm font-medium">{config.label}</p>
              <p className="text-[11px] text-muted-foreground">{config.description}</p>
            </div>
            <div className="flex-1">
              {config.type === "switch" ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={perm.enabled ?? false}
                    onCheckedChange={() => toggleSwitch(key, perm.enabled ?? false)}
                    disabled={saving[key]}
                  />
                  <span className="text-xs text-muted-foreground">{perm.enabled ? "Ativado" : "Desativado"}</span>
                </div>
              ) : config.type === "sectors" ? (
                <div className="flex flex-wrap items-center gap-3">
                  {(sectors || []).map((sector: any) => (
                    <label key={sector.id} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={(perm.allowed_sectors || []).includes(sector.id)}
                        onCheckedChange={() => toggleSector(key, sector.id)}
                        disabled={saving[key]}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs">{sector.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {ALL_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={(perm.allowed_roles || []).includes(role)}
                        onCheckedChange={() => toggleRole(key, role)}
                        disabled={saving[key]}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs">{ROLE_LABELS[role] || role}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!permissions?.length && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma permissão configurável.</p>
      )}
    </div>
  );
}

