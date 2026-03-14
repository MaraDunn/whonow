import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { setAuthPersistenceMode, supabase } from "@/integrations/supabase/client";
import { getAuthRedirectOrigin, isDesktopOrNativeApp } from "@/utils/launchMode";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    try {
      // Set up auth state listener FIRST
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
      unsub = () => subscription.unsubscribe();

      // THEN check for existing session
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        })
        .catch((e) => {
          console.error("[Auth] getSession failed:", e);
          setLoading(false);
        });
    } catch (e) {
      // If Supabase isn't configured, don't leave the app stuck on a spinner.
      console.error("[Auth] Supabase init/auth setup failed:", e);
      setLoading(false);
    }

    return () => {
      try {
        unsub?.();
      } catch {
        // ignore
      }
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    // Must be allowlisted in Supabase Dashboard: Authentication → URL Configuration → Redirect URLs.
    // In desktop app, use web URL (VITE_APP_URL) so the email link opens in browser to a real page.
    const redirectUrl = `${getAuthRedirectOrigin()}/auth`;

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });
      return { error };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Sign up failed due to an unexpected error.";
      console.error("[Auth] signUp threw:", e);
      return { error: { message } as any };
    }
  };

  const signIn = async (email: string, password: string, options?: { stayLoggedIn?: boolean }) => {
    try {
      setAuthPersistenceMode(options?.stayLoggedIn !== false);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error };
      // Enforce email verification: if Supabase has "Confirm email" off, it still issues a session
      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut({ scope: "local" });
        return { error: { message: "Email not confirmed" } as any };
      }
      return { error: null };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Sign in failed due to an unexpected error.";
      console.error("[Auth] signIn threw:", e);
      return { error: { message } as any };
    }
  };

  const signOut = async () => {
    // Clear local state first - user is logged out locally regardless of server response
    setSession(null);
    setUser(null);

    // In Tauri/desktop, use scope: 'local' to avoid network request - the default
    // scope makes a server call that can fail due to CORS/WebView constraints.
    const signOutOptions = isDesktopOrNativeApp() ? { scope: "local" as const } : undefined;

    let error: any = null;
    try {
      const res = await supabase.auth.signOut(signOutOptions);
      error = res.error;
    } catch (e) {
      console.error("[Auth] signOut threw:", e);
      error = { message: e instanceof Error ? e.message : String(e) };
    }

    // Treat "session not found" or 403 as success - user is already logged out server-side
    // (403 can occur when session was invalidated/deleted but client still had a JWT)
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const isAlreadyLoggedOut =
        msg.includes("session not found") ||
        msg.includes("forbidden") ||
        (error as any).status === 403;
      if (isAlreadyLoggedOut) return { error: null };
    }

    return { error };
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };
};
