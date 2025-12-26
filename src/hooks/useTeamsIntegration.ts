import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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

      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "get-status" },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        // Handle auth errors silently - user may not be authenticated
        console.log("Teams status check failed:", error.message);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to connect Microsoft Teams",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "get-oauth-url", origin: window.location.origin },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Configuration required",
          description: data.error,
          variant: "destructive",
        });
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
      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "disconnect" },
      });

      if (error) throw error;

      setStatus({ connected: false });
      setTeams([]);
      setChannels([]);
      toast({
        title: "Disconnected",
        description: "Microsoft Teams has been disconnected",
      });
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
      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "get-teams" },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Failed to load teams",
          description: data.error,
          variant: "destructive",
        });
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
      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "get-channels", teamId },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Failed to load channels",
          description: data.error,
          variant: "destructive",
        });
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
      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "import-members" },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Import failed",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Import successful",
        description: `Imported ${data.imported} members from Teams`,
      });
      return data;
    } catch (error) {
      console.error("Error importing Teams members:", error);
      toast({
        title: "Import failed",
        description: "Could not import Teams members",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const sendToChannel = useCallback(async (teamId: string, channelId: string, message: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "send-to-channel", teamId, channelId, message },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Send failed",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Message sent",
        description: "Message posted to Teams channel",
      });
      return data;
    } catch (error) {
      console.error("Error sending to channel:", error);
      toast({
        title: "Send failed",
        description: "Could not send message to channel",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createMeeting = useCallback(async (params: CreateMeetingParams) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("teams-integration", {
        body: { action: "create-meeting", ...params },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Meeting creation failed",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Meeting created",
        description: "Teams meeting has been scheduled",
      });
      return data;
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast({
        title: "Meeting creation failed",
        description: "Could not create Teams meeting",
        variant: "destructive",
      });
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
    createMeeting,
  };
}
