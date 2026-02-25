import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  userRole: string;
  userSectorId: string | null;
  mustChangePassword: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setMustChangePassword: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("colaborador");
  const [userSectorId, setUserSectorId] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let initialized = false;

    const checkUserRole = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        if (isMounted) {
          const role = data?.role || "colaborador";
          setUserRole(role);
          setIsAdmin(role === "admin");
        }
      } catch {
        if (isMounted) {
          setUserRole("colaborador");
          setIsAdmin(false);
        }
      }
    };

    const fetchUserProfile = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("sector_id, must_change_password")
          .eq("user_id", userId)
          .maybeSingle();
        if (isMounted) {
          setUserSectorId(data?.sector_id ?? null);
          setMustChangePassword(data?.must_change_password ?? false);
        }
      } catch {
        if (isMounted) {
          setUserSectorId(null);
          setMustChangePassword(false);
        }
      }
    };

    // Listener for ONGOING auth changes (ignores events before init completes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted || !initialized) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            if (isMounted) {
              checkUserRole(session.user.id);
              fetchUserProfile(session.user.id);
            }
          }, 0);
        } else {
          setIsAdmin(false);
          setUserRole("colaborador");
          setUserSectorId(null);
          setMustChangePassword(false);
        }
      }
    );

    // INITIAL load (controls loading)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await checkUserRole(session.user.id);
          await fetchUserProfile(session.user.id);
        }
      } catch (e) {
        console.error("Auth init failed:", e);
        if (isMounted) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setUserRole("colaborador");
          setUserSectorId(null);
          setMustChangePassword(false);
        }
      } finally {
        if (isMounted) {
          initialized = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!email.toLowerCase().endsWith("@giacomoni.com.br")) {
      return { error: new Error("Apenas e-mails @giacomoni.com.br podem acessar o sistema.") };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // Client-side check (UX only — real validation is on the backend)
    if (!email.endsWith("@giacomoni.com.br")) {
      return { error: new Error("Apenas e-mails @giacomoni.com.br podem se registrar.") };
    }
    try {
      const { data, error: fnError } = await supabase.functions.invoke("register-user", {
        body: { email, password, full_name: fullName },
      });
      if (fnError) {
        return { error: new Error(fnError.message || "Erro ao criar conta") };
      }
      if (data?.error) {
        return { error: new Error(data.error) };
      }
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message || "Erro ao criar conta") };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error:", e);
    }
    // Force clear state regardless
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setUserRole("colaborador");
    setUserSectorId(null);
    setMustChangePassword(false);
  };

  const contextValue = useMemo(
    () => ({ user, session, isAdmin, userRole, userSectorId, mustChangePassword, loading, signIn, signUp, signOut, setMustChangePassword }),
    [user, session, isAdmin, userRole, userSectorId, mustChangePassword, loading]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
