import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSectors, useSections, useProfiles, useSectorStyles, useTags } from "@/hooks/useSupabaseQuery";
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
import { Plus, Layers, Users, Palette, Tag, UserPlus, Eye, EyeOff, Settings2, Upload } from "lucide-react";
import ParametersAdmin from "@/components/ParametersAdmin";
import ClientCsvImport from "@/components/ClientCsvImport";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Admin() {
  const { isAdmin, user } = useAuth();

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Administração</h1>
      <Tabs defaultValue="sectors">
        <TabsList>
          <TabsTrigger value="sectors" className="gap-1"><Layers className="h-3 w-3" /> Setores & Seções</TabsTrigger>
          <TabsTrigger value="styles" className="gap-1"><Palette className="h-3 w-3" /> Estilos</TabsTrigger>
          <TabsTrigger value="tags" className="gap-1"><Tag className="h-3 w-3" /> Tags</TabsTrigger>
          <TabsTrigger value="parameters" className="gap-1"><Settings2 className="h-3 w-3" /> Parâmetros</TabsTrigger>
          <TabsTrigger value="import" className="gap-1"><Upload className="h-3 w-3" /> Importar CSV</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-3 w-3" /> Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="sectors" className="mt-4"><SectorsAdmin /></TabsContent>
        <TabsContent value="styles" className="mt-4"><StylesAdmin /></TabsContent>
        <TabsContent value="tags" className="mt-4"><TagsAdmin /></TabsContent>
        <TabsContent value="parameters" className="mt-4"><ParametersAdmin /></TabsContent>
        <TabsContent value="import" className="mt-4"><ClientCsvImport /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

function SectorsAdmin() {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

function UsersAdmin() {
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

  const toggleRole = async (userId: string, currentRoles: any[]) => {
    const hasAdmin = currentRoles?.some((r: any) => r.role === "admin");
    try {
      if (hasAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Perfil atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const updateSector = async (userId: string, sectorId: string | null) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ sector_id: sectorId })
        .eq("user_id", userId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Setor atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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
      if (newUserId && newRole === "admin") {
        await supabase.from("user_roles").insert({ user_id: newUserId, role: "admin" });
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profiles?.map((p: any) => {
              const hasAdmin = p.user_roles?.some((r: any) => r.role === "admin");
              const sectorName = sectors?.find((s) => s.id === p.sector_id)?.name;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded bg-muted/50 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                    <Badge variant={hasAdmin ? "default" : "secondary"}>
                      {hasAdmin ? "Admin" : "Colaborador"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRole(p.user_id, p.user_roles)}
                    >
                      {hasAdmin ? "Remover admin" : "Tornar admin"}
                    </Button>
                  </div>
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
