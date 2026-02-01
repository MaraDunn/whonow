import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { devLog } from "@/lib/devLog";

interface IntegrationStatus {
  connected: boolean;
  scope?: 'user' | 'organization';
  settings?: {
    team_id?: string;
    team_name?: string;
    bot_user_id?: string;
    email?: string;
    display_name?: string;
  };
}

type Provider = 'slack' | 'teams';

/**
 * Hook for managing organization-level integrations
 * Only accessible by organization admins
 */
export function useOrganizationIntegrations() {
  const [isLoading, setIsLoading] = useState(false);
  const [slackStatus, setSlackStatus] = useState<IntegrationStatus | null>(null);
  const [teamsStatus, setTeamsStatus] = useState<IntegrationStatus | null>(null);
  const { user } = useAuth();
  const { isAdmin, company } = useProfile(user?.id);

  /**
   * Get organization integration status for a specific provider
   */
  const getStatus = useCallback(async (provider: Provider) => {
    if (!user || !company?.id) {
      devLog("No user or company found");
      return { connected: false };
    }

    try {
      setIsLoading(true);
      
      // Our generated Supabase types may lag behind migrations (e.g. org-level `scope`),
      // so we intentionally loosen types for integration queries here.
      const integrations = supabase.from("integrations") as any;

      // Check for organization-level integration first
      const { data: orgIntegration } = await integrations
        .select("settings")
        .eq("company_id", company.id)
        .eq("provider", provider)
        .eq("scope", "organization")
        .eq("is_active", true)
        .maybeSingle();

      if (orgIntegration) {
        const status: IntegrationStatus = {
          connected: true,
          scope: 'organization',
          settings: orgIntegration.settings as any,
        };
        
        if (provider === 'slack') {
          setSlackStatus(status);
        } else {
          setTeamsStatus(status);
        }
        
        return status;
      }

      // No org integration found
      const status: IntegrationStatus = { connected: false };
      if (provider === 'slack') {
        setSlackStatus(status);
      } else {
        setTeamsStatus(status);
      }
      
      return status;
    } catch (error) {
      console.error(`Error getting ${provider} status:`, error);
      return { connected: false };
    } finally {
      setIsLoading(false);
    }
  }, [user, company]);

  /**
   * Get status for all integrations
   */
  const getAllStatus = useCallback(async () => {
    await Promise.all([
      getStatus('slack'),
      getStatus('teams'),
    ]);
  }, [getStatus]);

  /**
   * Connect organization-level integration (admin only)
   */
  const connect = useCallback(async (provider: Provider) => {
    if (!isAdmin) {
      toast.error("Only organization admins can manage integrations");
      return;
    }

    if (!company?.id) {
      toast.error("You must be part of an organization to use this feature");
      return;
    }

    try {
      setIsLoading(true);
      
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      
      if (sessionError || !session) {
        toast.error(`Please sign in to connect ${provider}`);
        return;
      }

      const functionName = provider === 'slack' ? 'slack-integration' : 'teams-integration';

      // Call the edge function directly so we fully control headers (apikey + Authorization).
      // This avoids any ambiguity around `functions.invoke()` header propagation.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) {
        toast.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
        return;
      }

      const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({
          action: "get-oauth-url",
          scope: "organization",
          origin: window.location.origin,
          jwt: session.access_token, // Function code reads from here
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          `Edge function error (${resp.status})`;
        toast.error(msg);
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

      // Redirect to OAuth
      window.location.href = data.url;
    } catch (error: unknown) {
      console.error(`Error connecting ${provider}:`, error);
      const errorMsg = error instanceof Error ? error.message : `Could not initiate ${provider} connection`;
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, company]);

  /**
   * Disconnect organization-level integration (admin only)
   */
  const disconnect = useCallback(async (provider: Provider) => {
    if (!isAdmin) {
      toast.error("Only organization admins can manage integrations");
      return;
    }

    if (!company?.id) {
      return;
    }

    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const functionName = provider === 'slack' ? 'slack-integration' : 'teams-integration';
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "disconnect", 
          scope: "organization",
          jwt: session.access_token, // Function code reads from here
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`);
      }

      if (provider === 'slack') {
        setSlackStatus({ connected: false });
      } else {
        setTeamsStatus({ connected: false });
      }

      toast.success(`${provider === 'slack' ? 'Slack' : 'Microsoft Teams'} has been disconnected from your organization`);
    } catch (error) {
      console.error(`Error disconnecting ${provider}:`, error);
      toast.error(`Could not disconnect ${provider}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, company]);

  /**
   * Import members from integration (uses org-level token)
   */
  const importMembers = useCallback(async (provider: Provider) => {
    if (!company?.id) {
      toast.error("You must be part of an organization to import members");
      return null;
    }

    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to import members");
        return null;
      }

      const functionName = provider === 'slack' ? 'slack-integration' : 'teams-integration';
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !supabaseAnonKey) return null;

      const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`, // Gateway needs this
        },
        body: JSON.stringify({ 
          action: "import-members", 
          scope: "organization",
          jwt: session.access_token, // Function code reads from here
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error((data && (data.error || data.message)) || `Edge function error (${resp.status})`);
      }

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      const skippedMsg = data.skipped > 0 ? ` (${data.skipped} duplicates skipped)` : "";
      toast.success(`Imported ${data.imported} contacts from ${provider === 'slack' ? 'Slack' : 'Teams'}${skippedMsg}`);
      
      return data;
    } catch (error) {
      console.error(`Error importing ${provider} members:`, error);
      toast.error(`Could not import ${provider} members`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [company]);

  return {
    isLoading,
    slackStatus,
    teamsStatus,
    isAdmin,
    getStatus,
    getAllStatus,
    connectSlack: () => connect('slack'),
    connectTeams: () => connect('teams'),
    disconnectSlack: () => disconnect('slack'),
    disconnectTeams: () => disconnect('teams'),
    importSlackMembers: () => importMembers('slack'),
    importTeamsMembers: () => importMembers('teams'),
  };
}

