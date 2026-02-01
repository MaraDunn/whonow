import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { devLog } from "@/lib/devLog";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

interface SlackStatus {
  connected: boolean;
  settings?: {
    team_id?: string;
    team_name?: string;
    bot_user_id?: string;
  };
}

export function useSlackIntegration() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);

  const getStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      // Use refreshSession to ensure we have a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        // User is not authenticated, return silently
        setStatus({ connected: false });
        return { connected: false };
      }

      // Use direct fetch to pass JWT in body (since Supabase strips Authorization header when verify_jwt=false)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        setStatus({ connected: false });
        return { connected: false };
      }

      const resp = await fetch(`${supabaseUrl}/functions/v1/slack-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "get-status",
          jwt: session.access_token,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      const error = !resp.ok ? new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`) : null;

      if (error) {
        // Handle auth errors silently - user may not be authenticated
        devLog("Slack status check failed:", error.message);
        setStatus({ connected: false });
        return { connected: false };
      }
      setStatus(data);
      return data;
    } catch (error) {
      console.error("Error getting Slack status:", error);
      setStatus({ connected: false });
      return { connected: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Force refresh the session to get a fresh token
      const { data: { session: refreshedSession }, error: sessionError } = await supabase.auth.refreshSession();
      
      if (sessionError || !refreshedSession) {
        console.error("Session refresh failed:", sessionError);
        toast.error("Please sign in to connect Slack");
        return;
      }

      // Use the refreshed session token
      const accessToken = refreshedSession.access_token;
      devLog("Calling slack-integration with fresh token (length:", accessToken.length, ")");
      
      // Use direct fetch to pass JWT in body (since Supabase strips Authorization header when verify_jwt=false)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        toast.error("Missing Supabase configuration");
        return;
      }

      devLog("Sending request to slack-integration with JWT in both header and body");
      const requestBody = JSON.stringify({ 
        action: "get-oauth-url",
        jwt: accessToken,
      });
      devLog("Request body (first 100 chars):", requestBody.substring(0, 100));
      
      const resp = await fetch(`${supabaseUrl}/functions/v1/slack-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`, // Gateway needs this
        },
        body: requestBody, // Function code reads from here
      });
      
      devLog("Response status:", resp.status);
      const responseText = await resp.text();
      devLog("Response body:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { error: responseText || `Edge function error (${resp.status})` };
      }
      const error = !resp.ok ? new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`) : null;

      devLog("Slack connect response:", { data, error });

      if (error) {
        console.error("Slack function error details:", error);
        const errorMsg = error.message || "Unknown error occurred";
        toast.error(errorMsg);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (!data?.url) {
        toast.error("No OAuth URL returned from server");
        return;
      }

      // Redirect to Slack OAuth
      devLog("Redirecting to Slack OAuth:", data.url);
      window.location.href = data.url;
    } catch (error: unknown) {
      console.error("Error connecting Slack:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Could not initiate Slack connection";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const resp = await fetch(`${supabaseUrl}/functions/v1/slack-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "disconnect",
          jwt: session.access_token,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      const error = !resp.ok ? new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`) : null;

      if (error) throw error;

      setStatus({ connected: false });
      toast.success("Slack has been disconnected");
    } catch (error) {
      console.error("Error disconnecting Slack:", error);
      toast.error("Could not disconnect Slack");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to import members",
          variant: "destructive",
        });
        return null;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return null;

      const resp = await fetch(`${supabaseUrl}/functions/v1/slack-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "import-members",
          jwt: session.access_token,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      const error = !resp.ok ? new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`) : null;

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      const skippedMsg = data.skipped > 0 ? ` (${data.skipped} duplicates skipped)` : "";
      toast.success(`Imported ${data.imported} contacts from Slack${skippedMsg}`);
      return data;
    } catch (error) {
      console.error("Error importing Slack members:", error);
      toast.error("Could not import Slack members");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getChannels = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return [];

      const resp = await fetch(`${supabaseUrl}/functions/v1/slack-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "get-channels",
          jwt: session.access_token,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      const error = !resp.ok ? new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`) : null;

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return [];
      }

      setChannels(data.channels);
      return data.channels;
    } catch (error) {
      console.error("Error getting channels:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const shareContact = useCallback(async (contactId: string, channelId: string) => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return false;

      const resp = await fetch(`${supabaseUrl}/functions/v1/slack-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "share-contact", 
          contactId, 
          channelId,
          jwt: session.access_token,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      const error = !resp.ok ? new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`) : null;

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return false;
      }

      toast.success("Contact shared to Slack channel");
      return true;
    } catch (error) {
      console.error("Error sharing contact:", error);
      const message = error instanceof Error ? error.message : "Could not share contact to Slack";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendNotification = useCallback(async (
    webhookUrl: string,
    message: string,
    contactData?: { name: string; email?: string }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return false;

      const resp = await fetch(`${supabaseUrl}/functions/v1/slack-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "send-notification", 
          webhookUrl, 
          message, 
          contactData,
          jwt: session.access_token,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      const error = !resp.ok ? new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`) : null;

      if (error) throw error;
      return data.success;
    } catch (error) {
      console.error("Error sending notification:", error);
      return false;
    }
  }, []);

  return {
    isLoading,
    status,
    channels,
    getStatus,
    connect,
    disconnect,
    importMembers,
    getChannels,
    shareContact,
    sendNotification,
  };
}
