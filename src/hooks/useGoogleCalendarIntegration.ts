import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getValidSession, isTokenValid } from "@/utils/authToken";

interface GoogleCalendarStatus {
  connected: boolean;
}

export function useGoogleCalendarIntegration() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);

  const getStatus = useCallback(async (retryAfter401 = false) => {
    try {
      setIsLoading(true);
      const session = await getValidSession();
      if (!session?.access_token) {
        setStatus({ connected: false });
        return { connected: false };
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        setStatus({ connected: false });
        return { connected: false };
      }
      const token = session.access_token;
      const resp = await fetch(`${supabaseUrl}/functions/v1/google-calendar-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "get-status" }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 401 && !retryAfter401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.access_token) {
          const retryResp = await fetch(`${supabaseUrl}/functions/v1/google-calendar-integration`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${refreshed.session.access_token}`,
            },
            body: JSON.stringify({ action: "get-status" }),
          });
          const retryData = await retryResp.json().catch(() => ({}));
          if (retryResp.ok) {
            setStatus(retryData);
            return retryData;
          }
        }
      }
      if (!resp.ok) {
        setStatus({ connected: false });
        return { connected: false };
      }
      setStatus(data);
      return data;
    } catch {
      setStatus({ connected: false });
      return { connected: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch calendar connection status once auth state is ready.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session?.access_token && isTokenValid(session)) {
        await getStatus();
      } else if (!cancelled) {
        setStatus({ connected: false });
      }
    };
    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && isTokenValid(session)) {
        void getStatus();
      } else {
        setStatus({ connected: false });
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [getStatus]);

  const connect = useCallback(async (retryAfter401 = false) => {
    try {
      setIsLoading(true);
      const session = await getValidSession();
      if (!session?.access_token) {
        toast.error("Please sign in to connect Google Calendar");
        return;
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        toast.error("Missing Supabase configuration");
        return;
      }
      const token = session.access_token;
      const resp = await fetch(`${supabaseUrl}/functions/v1/google-calendar-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 401 && !retryAfter401) {
        const retrySession = await getValidSession();
        if (retrySession?.access_token) {
          return connect(true);
        }
      }
      if (!resp.ok || data?.error) {
        const msg = data?.error ?? "Failed to start Google Calendar connection";
        if (resp.status === 401 || data?.detail?.includes("expired") || msg.includes("token")) {
          toast.error("Session expired. Please sign in again.");
        } else {
          toast.error(msg);
        }
        return;
      }
      if (!data?.url) {
        toast.error("No OAuth URL returned");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect Google Calendar");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const session = await getValidSession();
      if (!session) {
        toast.error("Please sign in to disconnect");
        return;
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        toast.error("Missing Supabase configuration");
        return;
      }
      const resp = await fetch(`${supabaseUrl}/functions/v1/google-calendar-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) {
        toast.error(data?.error || "Failed to disconnect");
        return;
      }
      setStatus({ connected: false });
      toast.success("Google Calendar disconnected");
    } catch (err) {
      console.error(err);
      toast.error("Failed to disconnect Google Calendar");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createEvent = useCallback(
    async (contactId: string, followUpDate: string, contactName: string): Promise<boolean> => {
      try {
        const session = await getValidSession();
        if (!session) return false;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
        if (!supabaseUrl || !supabaseAnonKey) return false;
        const createEventBody = JSON.stringify({
          action: "create-event",
          contactId,
          followUpDate,
          contactName,
        });
        const resp = await fetch(`${supabaseUrl}/functions/v1/google-calendar-integration`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: createEventBody,
        });
        if (resp.status === 401) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session?.access_token) {
            const retryResp = await fetch(`${supabaseUrl}/functions/v1/google-calendar-integration`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${refreshed.session.access_token}`,
              },
              body: createEventBody,
            });
            const retryData = await retryResp.json().catch(() => ({}));
            return retryResp.ok && !!retryData?.success;
          }
        }
        const data = await resp.json().catch(() => ({}));
        return resp.ok && !!data?.success;
      } catch {
        return false;
      }
    },
    []
  );

  return {
    isLoading,
    status,
    getStatus,
    connect,
    disconnect,
    createEvent,
  };
}
