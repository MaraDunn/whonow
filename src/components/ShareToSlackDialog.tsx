import { useState, useEffect } from "react";
import { Contact } from "@/types/contact";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
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
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareToSlackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

export function ShareToSlackDialog({
  open,
  onOpenChange,
  contact,
}: ShareToSlackDialogProps) {
  const { status, channels, getStatus, getChannels, shareContact, isLoading } = useSlackIntegration();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [isSharing, setIsSharing] = useState(false);

  // Refresh status when dialog opens (picks up org-level or user-level connection)
  useEffect(() => {
    if (open) {
      getStatus();
    }
  }, [open, getStatus]);

  // Load channels when dialog opens and connected
  useEffect(() => {
    if (open && status?.connected) {
      getChannels();
    }
  }, [open, status?.connected, getChannels]);

  const handleShare = async () => {
    if (!contact || !selectedChannelId) {
      toast.error("Please select a channel to share to");
      return;
    }

    setIsSharing(true);
    try {
      const success = await shareContact(contact.id, selectedChannelId);
      if (success) {
        onOpenChange(false);
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
  const hasChannels = channels && channels.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share to Slack
          </DialogTitle>
          <DialogDescription>
            Share {contact.name}'s contact card to a Slack channel
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Slack is not connected. Please connect Slack in Settings to share contacts.
            </p>
          </div>
        ) : !hasChannels ? (
          <div className="py-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading channels...
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No channels available. Make sure you have access to at least one channel in your Slack workspace.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-select">Select Channel</Label>
              <Select
                value={selectedChannelId}
                onValueChange={setSelectedChannelId}
                disabled={isSharing || isLoading}
              >
                <SelectTrigger id="channel-select">
                  <SelectValue placeholder="Choose a channel..." />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.is_private ? "🔒 " : "# "}
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedChannelId("");
            }}
            disabled={isSharing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={!isConnected || !hasChannels || !selectedChannelId || isSharing}
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

