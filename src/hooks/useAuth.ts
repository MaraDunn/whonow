import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { IS_WAITLIST_MODE_EFFECTIVE } from "@/utils/launchMode";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

    // Must be allowlisted in Supabase Dashboard: Authentication → URL Configuration → Redirect URLs
    const redirectUrl = `${window.location.origin}/auth`;

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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    // Clear local state first - user is logged out locally regardless of server response
    setSession(null);
    setUser(null);
    
    const { error } = await supabase.auth.signOut();
    
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
