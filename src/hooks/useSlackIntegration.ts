import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const getStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("slack-integration", {
        body: { action: "get-status" },
      });

      if (error) throw error;
      setStatus(data);
      return data;
    } catch (error) {
      console.error("Error getting Slack status:", error);
      return null;
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
          description: "Please sign in to connect Slack",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("slack-integration", {
        body: { action: "get-oauth-url" },
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

      // Redirect to Slack OAuth
      window.location.href = data.url;
    } catch (error) {
      console.error("Error connecting Slack:", error);
      toast({
        title: "Connection failed",
        description: "Could not initiate Slack connection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("slack-integration", {
        body: { action: "disconnect" },
      });

      if (error) throw error;

      setStatus({ connected: false });
      toast({
        title: "Disconnected",
        description: "Slack has been disconnected",
      });
    } catch (error) {
      console.error("Error disconnecting Slack:", error);
      toast({
        title: "Disconnection failed",
        description: "Could not disconnect Slack",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const importMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("slack-integration", {
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
        description: `Imported ${data.imported} contacts from Slack`,
      });
      return data;
    } catch (error) {
      console.error("Error importing Slack members:", error);
      toast({
        title: "Import failed",
        description: "Could not import Slack members",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const getChannels = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("slack-integration", {
        body: { action: "get-channels" },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
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
  }, [toast]);

  const shareContact = useCallback(async (contactId: string, channelId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("slack-integration", {
        body: { action: "share-contact", contactId, channelId },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Sharing failed",
          description: data.error,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Shared",
        description: "Contact shared to Slack channel",
      });
      return true;
    } catch (error) {
      console.error("Error sharing contact:", error);
      toast({
        title: "Sharing failed",
        description: "Could not share contact to Slack",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const sendNotification = useCallback(async (
    webhookUrl: string,
    message: string,
    contactData?: { name: string; email?: string }
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("slack-integration", {
        body: { action: "send-notification", webhookUrl, message, contactData },
      });

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
