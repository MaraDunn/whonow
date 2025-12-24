import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OutlookStatus {
  connected: boolean;
  settings?: {
    email?: string;
    display_name?: string;
  };
}

interface ScheduleMeetingParams {
  contactId: string;
  subject: string;
  startTime: string;
  endTime: string;
  message?: string;
}

export function useOutlookIntegration() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<OutlookStatus | null>(null);
  const { toast } = useToast();

  const getStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("outlook-integration", {
        body: { action: "get-status" },
      });

      if (error) throw error;
      setStatus(data);
      return data;
    } catch (error) {
      console.error("Error getting Outlook status:", error);
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
          description: "Please sign in to connect Outlook",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("outlook-integration", {
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

      // Redirect to Microsoft OAuth
      window.location.href = data.url;
    } catch (error) {
      console.error("Error connecting Outlook:", error);
      toast({
        title: "Connection failed",
        description: "Could not initiate Outlook connection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("outlook-integration", {
        body: { action: "disconnect" },
      });

      if (error) throw error;

      setStatus({ connected: false });
      toast({
        title: "Disconnected",
        description: "Outlook has been disconnected",
      });
    } catch (error) {
      console.error("Error disconnecting Outlook:", error);
      toast({
        title: "Disconnection failed",
        description: "Could not disconnect Outlook",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const importContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("outlook-integration", {
        body: { action: "import-contacts" },
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
        description: `Imported ${data.imported} contacts from Outlook`,
      });
      return data;
    } catch (error) {
      console.error("Error importing Outlook contacts:", error);
      toast({
        title: "Import failed",
        description: "Could not import Outlook contacts",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const syncContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("outlook-integration", {
        body: { action: "sync-contacts" },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Sync failed",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Sync successful",
        description: `Synced ${data.synced} contacts to Outlook`,
      });
      return data;
    } catch (error) {
      console.error("Error syncing contacts:", error);
      toast({
        title: "Sync failed",
        description: "Could not sync contacts to Outlook",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const scheduleMeeting = useCallback(async (params: ScheduleMeetingParams) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("outlook-integration", {
        body: { action: "schedule-meeting", ...params },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Scheduling failed",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Meeting scheduled",
        description: "Calendar invite has been sent",
      });
      return data;
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      toast({
        title: "Scheduling failed",
        description: "Could not schedule meeting",
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
    getStatus,
    connect,
    disconnect,
    importContacts,
    syncContacts,
    scheduleMeeting,
  };
}
