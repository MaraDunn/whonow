import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { IS_WAITLIST_MODE_EFFECTIVE, getAuthRedirectOrigin } from "@/utils/launchMode";

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
    // Block sign-ups in waitlist mode (unless in dev mode)
    if (IS_WAITLIST_MODE_EFFECTIVE) {
      return {
        error: {
          message: "Sign-ups are currently disabled. Join our waitlist instead.",
        } as any,
      };
    }

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

  const signIn = async (email: string, password: string) => {
    // Block sign-ins in waitlist mode (unless in dev mode)
    if (IS_WAITLIST_MODE_EFFECTIVE) {
      return {
        error: {
          message: "Sign-ins are currently disabled. Join our waitlist instead.",
        } as any,
      };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
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
    
    let error: any = null;
    try {
      const res = await supabase.auth.signOut();
      error = res.error;
    } catch (e) {
      console.error("[Auth] signOut threw:", e);
      error = { message: e instanceof Error ? e.message : String(e) };
    }
    
    // Treat "session not found" as success - user is already logged out server-side
    if (error && error.message?.toLowerCase().includes('session not found')) {
      return { error: null };
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
