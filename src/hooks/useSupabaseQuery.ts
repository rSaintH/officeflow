import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_5MIN = 5 * 60 * 1000;

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSections(sectorId?: string) {
  return useQuery({
    queryKey: ["sections", sectorId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("sections")
        .select("*, sectors(name)")
        .eq("is_active", true)
        .order("order_index");
      if (sectorId) query = query.eq("sector_id", sectorId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("is_archived", false)
        .order("legal_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useClientParticularities(clientId: string) {
  return useQuery({
    queryKey: ["particularities", clientId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_particularities")
        .select("*, sectors(name), sections(name)")
        .eq("client_id", clientId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useClientPops(clientId: string) {
  return useQuery({
    queryKey: ["pops", "client", clientId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pops")
        .select("*, sectors(name), sections(name)")
        .eq("is_archived", false)
        .or(`scope.eq.Geral,client_id.eq.${clientId}`)
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function usePops() {
  return useQuery({
    queryKey: ["pops"],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pops")
        .select("*, sectors(name), sections(name), clients(legal_name)")
        .eq("is_archived", false)
        .order("title");
      if (error) throw error;
      return data;
    },
  });
}

export function useTasks(filters?: { clientId?: string; sectorId?: string; status?: string }) {
  return useQuery({
    queryKey: ["tasks", filters],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, sectors(name), sections(name), clients(legal_name, trade_name)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (filters?.clientId) query = query.eq("client_id", filters.clientId);
      if (filters?.sectorId) query = query.eq("sector_id", filters.sectorId);
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useTaskComments(taskId?: string) {
  return useQuery({
    queryKey: ["task_comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at");
      if (error) throw error;
      // Fetch profiles separately
      const creatorIds = [...new Set((data || []).map((c: any) => c.created_by).filter(Boolean))];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", creatorIds);
        const profileMap: Record<string, any> = {};
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });
        return data?.map((c: any) => ({ ...c, profiles: profileMap[c.created_by] || null })) || [];
      }
      return data?.map((c: any) => ({ ...c, profiles: null })) || [];
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
}

export function useOccurrenceComments(occurrenceId?: string) {
  return useQuery({
    queryKey: ["occurrence_comments", occurrenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrence_comments" as any)
        .select("*")
        .eq("occurrence_id", occurrenceId!)
        .order("created_at");
      if (error) throw error;
      const creatorIds = [...new Set(((data as any[]) || []).map((c: any) => c.created_by).filter(Boolean))];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", creatorIds);
        const profileMap: Record<string, any> = {};
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });
        return (data as any[])?.map((c: any) => ({ ...c, profiles: profileMap[c.created_by] || null })) || [];
      }
      return (data as any[])?.map((c: any) => ({ ...c, profiles: null })) || [];
    },
    enabled: !!occurrenceId,
  });
}

export function useTasksWithComments(filters?: { clientId?: string; sectorId?: string; status?: string }) {
  return useQuery({
    queryKey: ["tasks_with_comments", filters],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, sectors(name), sections(name), clients(legal_name, trade_name)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (filters?.clientId) query = query.eq("client_id", filters.clientId);
      if (filters?.sectorId) query = query.eq("sector_id", filters.sectorId);
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch comments
        const taskIds = data.map((t: any) => t.id);
        const { data: comments } = await supabase
          .from("task_comments")
          .select("*")
          .in("task_id", taskIds)
          .order("created_at");

        // Collect ALL unique user IDs (task creators + comment creators) in one pass
        const allUserIds = new Set<string>();
        data.forEach((t: any) => { if (t.created_by) allUserIds.add(t.created_by); });
        (comments || []).forEach((c: any) => { if (c.created_by) allUserIds.add(c.created_by); });

        // Single profiles query for everyone
        let profileMap: Record<string, any> = {};
        if (allUserIds.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", [...allUserIds]);
          profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });
        }

        const commentsByTask: Record<string, any[]> = {};
        comments?.forEach((c: any) => {
          if (!commentsByTask[c.task_id]) commentsByTask[c.task_id] = [];
          commentsByTask[c.task_id].push({ ...c, profiles: profileMap[c.created_by] || null });
        });

        return data.map((t: any) => ({
          ...t,
          profiles: profileMap[t.created_by] || null,
          comments: commentsByTask[t.id] || [],
        }));
      }
      return data?.map((t: any) => ({ ...t, profiles: null, comments: [] })) || [];
    },
  });
}

export function useOccurrencesWithComments(clientId?: string) {
  return useQuery({
    queryKey: ["occurrences_with_comments", clientId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("occurrences")
        .select("*, sectors(name), sections(name), clients(legal_name)")
        .eq("is_archived", false)
        .order("occurred_at", { ascending: false });
      if (clientId) query = query.eq("client_id", clientId);
      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch comments
        const occIds = data.map((o: any) => o.id);
        const { data: comments } = await supabase
          .from("occurrence_comments" as any)
          .select("*")
          .in("occurrence_id", occIds)
          .order("created_at");

        // Collect ALL unique user IDs in one pass
        const allUserIds = new Set<string>();
        data.forEach((o: any) => { if (o.created_by) allUserIds.add(o.created_by); });
        ((comments as any[]) || []).forEach((c: any) => { if (c.created_by) allUserIds.add(c.created_by); });

        // Single profiles query
        let profileMap: Record<string, any> = {};
        if (allUserIds.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", [...allUserIds]);
          profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });
        }

        const commentsByOcc: Record<string, any[]> = {};
        (comments as any[])?.forEach((c: any) => {
          if (!commentsByOcc[c.occurrence_id]) commentsByOcc[c.occurrence_id] = [];
          commentsByOcc[c.occurrence_id].push({ ...c, profiles: profileMap[c.created_by] || null });
        });

        return data.map((o: any) => ({
          ...o,
          profiles: profileMap[o.created_by] || null,
          comments: commentsByOcc[o.id] || [],
        }));
      }
      return data?.map((o: any) => ({ ...o, profiles: null, comments: [] })) || [];
    },
  });
}

export function useOccurrences(clientId?: string) {
  return useQuery({
    queryKey: ["occurrences", clientId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("occurrences")
        .select("*, sectors(name), sections(name), clients(legal_name)")
        .eq("is_archived", false)
        .order("occurred_at", { ascending: false });
      if (clientId) query = query.eq("client_id", clientId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;

      const userIds = profiles?.map((p) => p.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return profiles;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const rolesMap: Record<string, any[]> = {};
      roles?.forEach((r) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r);
      });

      return profiles?.map((p) => ({
        ...p,
        user_roles: rolesMap[p.user_id] || [],
      }));
    },
  });
}

export function useClientPopNote(clientId: string, popId: string) {
  return useQuery({
    queryKey: ["client_pop_notes", clientId, popId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_pop_notes")
        .select("*")
        .eq("client_id", clientId)
        .eq("pop_id", popId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !!popId,
  });
}

export function useSectorStyles(sectorId?: string) {
  return useQuery({
    queryKey: ["sector_styles", sectorId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("sector_styles")
        .select("*")
        .eq("is_active", true)
        .order("order_index");
      if (sectorId) query = query.eq("sector_id", sectorId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useClientSectorStyles(clientId: string) {
  return useQuery({
    queryKey: ["client_sector_styles", clientId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_sector_styles")
        .select("*, sector_styles(name), sectors(name)")
        .eq("client_id", clientId);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useTaskStats() {
  return useQuery({
    queryKey: ["task_stats"],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("sector_id, status, due_date, sectors(name)")
        .eq("is_archived", false)
        .not("status", "in", '("Concluída","Cancelada")');
      if (error) throw error;
      return data;
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useParameterOptions(type?: string) {
  return useQuery({
    queryKey: ["parameter_options", type],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("parameter_options" as any)
        .select("*")
        .eq("is_active", true)
        .order("order_index");
      if (type) query = query.eq("type", type);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function usePopVersions(popId: string) {
  return useQuery({
    queryKey: ["pop_versions", popId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pop_versions" as any)
        .select("*")
        .eq("pop_id", popId)
        .order("saved_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      // Fetch saved_by profiles
      const userIds = [...new Set((data as any[] || []).map((v: any) => v.saved_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const profileMap: Record<string, string> = {};
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
        return (data as any[]).map((v: any) => ({ ...v, saved_by_name: profileMap[v.saved_by] || "—" }));
      }
      return (data as any[]).map((v: any) => ({ ...v, saved_by_name: "—" }));
    },
    enabled: !!popId,
  });
}

// ── Document Request hooks ──

export function useDocumentTypes(clientId?: string) {
  return useQuery({
    queryKey: ["document_types", clientId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      let query = supabase
        .from("document_types")
        .select("*")
        .order("order_index");
      if (clientId) query = query.eq("client_id", clientId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !clientId || !!clientId,
  });
}

export function useDocumentMonthlyStatus(clientId: string, yearMonth: string) {
  return useQuery({
    queryKey: ["document_monthly_status", clientId, yearMonth],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_monthly_status")
        .select("*")
        .eq("client_id", clientId)
        .eq("year_month", yearMonth);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !!yearMonth,
  });
}

export function useDocumentReportLogs(yearMonth: string) {
  return useQuery({
    queryKey: ["document_report_logs", yearMonth],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_report_logs")
        .select("*")
        .eq("year_month", yearMonth)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!yearMonth,
  });
}

export function useDocTags() {
  return useQuery({
    queryKey: ["doc_tags"],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doc_tags")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useDocumentTypeDocTags(documentTypeIds: string[]) {
  return useQuery({
    queryKey: ["document_type_doc_tags", documentTypeIds],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      if (documentTypeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("document_type_doc_tags")
        .select("*, doc_tags(id, name, color, text_color)")
        .in("document_type_id", documentTypeIds);
      if (error) throw error;
      return data;
    },
    enabled: documentTypeIds.length > 0,
  });
}

export function useClientTags(clientId: string) {
  return useQuery({
    queryKey: ["client_tags", clientId],
    staleTime: STALE_5MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_tags")
        .select("*, tags(id, name, color)")
        .eq("client_id", clientId);
      if (error) throw error;
      return data as (typeof data extends (infer U)[] ? U & { sector_id: string | null } : never)[];
    },
    enabled: !!clientId,
  });
}
