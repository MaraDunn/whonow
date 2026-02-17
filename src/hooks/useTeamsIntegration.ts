import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { devLog } from "@/lib/devLog";

interface TeamsStatus {
  connected: boolean;
  settings?: {
    email?: string;
    display_name?: string;
  };
}

interface Team {
  id: string;
  displayName: string;
  description?: string;
}

interface Channel {
  id: string;
  displayName: string;
  description?: string;
}

interface CreateMeetingParams {
  contactId?: string;
  subject: string;
  startTime: string;
  endTime: string;
  message?: string;
}

export function useTeamsIntegration() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<TeamsStatus | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        setStatus({ connected: false });
        return { connected: false };
      }

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
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
        devLog("Teams status check failed:", error.message);
        setStatus({ connected: false });
        return { connected: false };
      }
      setStatus(data);
      return data;
    } catch (error) {
      console.error("Error getting Teams status:", error);
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
        toast.error("Please sign in to connect Microsoft Teams");
        return;
      }

      // Use the refreshed session token
      const accessToken = refreshedSession.access_token;
      devLog("Calling teams-integration with fresh token (length:", accessToken.length, ")");
      devLog("Token starts with:", accessToken.substring(0, 50));
      devLog("Token ends with:", accessToken.substring(accessToken.length - 50));
      
      // Validate token format (should be JWT: header.payload.signature)
      if (!accessToken || accessToken.split('.').length !== 3) {
        console.error("Invalid token format - not a valid JWT");
        toast.error("Invalid session token. Please log out and log back in.");
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        toast({
          title: "Configuration error",
          description: "Missing Supabase configuration",
          variant: "destructive",
        });
        return;
      }

      devLog("Sending request to teams-integration with JWT in both header and body");
      const requestBody = JSON.stringify({ 
        action: "get-oauth-url", 
        origin: window.location.origin,
        jwt: accessToken, // Function code reads from here
      });
      devLog("Request body (first 100 chars):", requestBody.substring(0, 100));

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`, // Gateway needs this
        },
        body: requestBody,
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

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Redirect to Microsoft OAuth
      window.location.href = data.url;
    } catch (error) {
      console.error("Error connecting Teams:", error);
      toast({
        title: "Connection failed",
        description: "Could not initiate Teams connection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
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
      setTeams([]);
      setChannels([]);
      toast.success("Microsoft Teams has been disconnected");
    } catch (error) {
      console.error("Error disconnecting Teams:", error);
      toast({
        title: "Disconnection failed",
        description: "Could not disconnect Teams",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const getTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return [];

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "get-teams",
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

      setTeams(data.teams || []);
      return data.teams || [];
    } catch (error) {
      console.error("Error getting teams:", error);
      toast({
        title: "Failed to load teams",
        description: "Could not fetch your Teams",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const getChannels = useCallback(async (teamId: string) => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return [];

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "get-channels", 
          teamId,
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

      setChannels(data.channels || []);
      return data.channels || [];
    } catch (error) {
      console.error("Error getting channels:", error);
      toast({
        title: "Failed to load channels",
        description: "Could not fetch channels",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const importMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to import Teams members");
        return null;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return null;

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
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

      toast({
        title: "Import successful",
        description: `Imported ${data.imported} members from Teams`,
      });
      return data;
    } catch (error) {
      console.error("Error importing Teams members:", error);
      toast.error("Could not import Teams members");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const sendToChannel = useCallback(async (teamId: string, channelId: string, message: string) => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return null;

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "send-to-channel", 
          teamId, 
          channelId, 
          message,
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

      toast({
        title: "Message sent",
        description: "Message posted to Teams channel",
      });
      return data;
    } catch (error) {
      console.error("Error sending to channel:", error);
      toast.error("Could not send message to channel");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const shareContact = useCallback(async (contactId: string, teamId: string, channelId: string, silent = false) => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return false;

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "share-contact",
          contactId,
          teamId,
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

      if (!silent) {
        toast({
          title: "Shared",
          description: "Contact shared to Teams channel",
        });
      }
      return true;
    } catch (error) {
      console.error("Error sharing contact to Teams:", error);
      const message = error instanceof Error ? error.message : "Could not share contact to Teams";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createMeeting = useCallback(async (params: CreateMeetingParams) => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return null;

      const resp = await fetch(`${supabaseUrl}/functions/v1/teams-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "create-meeting", 
          ...params,
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

      toast.success("Teams meeting has been scheduled");
      return data;
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error("Could not create Teams meeting");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    isLoading,
    status,
    teams,
    channels,
    getStatus,
    connect,
    disconnect,
    getTeams,
    getChannels,
    importMembers,
    sendToChannel,
    shareContact,
    createMeeting,
  };
}
