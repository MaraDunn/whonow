import { useState, useEffect } from "react";
import { Contact } from "@/types/contact";
import { useTeamsIntegration } from "@/hooks/useTeamsIntegration";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Share2, Video } from "lucide-react";
import { toast } from "sonner";

interface ShareToTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

export function ShareToTeamsDialog({
  open,
  onOpenChange,
  contact,
}: ShareToTeamsDialogProps) {
  const { status, teams, channels, getStatus, getTeams, getChannels, shareContact, isLoading } =
    useTeamsIntegration();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (open) {
      getStatus();
    }
  }, [open, getStatus]);

  useEffect(() => {
    if (open && status?.connected) {
      getTeams();
    }
  }, [open, status?.connected, getTeams]);

  useEffect(() => {
    if (open && selectedTeamId) {
      getChannels(selectedTeamId);
    } else {
      setSelectedChannelId("");
    }
  }, [open, selectedTeamId, getChannels]);

  const handleShare = async () => {
    if (!contact || !selectedTeamId || !selectedChannelId) {
      toast.error("Please select a team and channel to share to");
      return;
    }

    setIsSharing(true);
    try {
      const success = await shareContact(contact.id, selectedTeamId, selectedChannelId);
      if (success) {
        onOpenChange(false);
        setSelectedTeamId("");
        setSelectedChannelId("");
      }
    } catch (error) {
      console.error("Error sharing contact:", error);
    } finally {
      setIsSharing(false);
    }
  };

  if (!contact) return null;

  const isConnected = status?.connected;
  const hasTeams = teams && teams.length > 0;
  const hasChannels = channels && channels.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Share to Teams
          </DialogTitle>
          <DialogDescription>
            Share {contact.name}'s contact card to a Teams channel
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Teams is not connected. Please connect Microsoft Teams in Settings to share contacts.
            </p>
          </div>
        ) : !hasTeams ? (
          <div className="py-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading teams...
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No teams available. Make sure you have access to at least one team in Microsoft Teams.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-select">Select Team</Label>
              <Select
                value={selectedTeamId}
                onValueChange={(v) => {
                  setSelectedTeamId(v);
                  setSelectedChannelId("");
                }}
                disabled={isSharing || isLoading}
              >
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Choose a team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-select">Select Channel</Label>
              <Select
                value={selectedChannelId}
                onValueChange={setSelectedChannelId}
                disabled={!selectedTeamId || isSharing || isLoading}
              >
                <SelectTrigger id="channel-select">
                  <SelectValue placeholder={selectedTeamId ? "Choose a channel..." : "Select a team first"} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeamId && !hasChannels && !isLoading && (
                <p className="text-xs text-muted-foreground">No channels in this team.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedTeamId("");
              setSelectedChannelId("");
            }}
            disabled={isSharing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={!isConnected || !hasTeams || !selectedTeamId || !selectedChannelId || isSharing}
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
