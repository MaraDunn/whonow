import { useState, useMemo } from "react";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReminderSettings, getSuggestedFollowUps } from "@/hooks/useReminderSettings";
import type { Contact } from "@/types/contact";

interface RelationshipRemindersCardProps {
  contacts: Contact[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function RelationshipRemindersCard({ contacts }: RelationshipRemindersCardProps) {
  const { reminderInterval, updateInterval } = useReminderSettings();
  const [localInterval, setLocalInterval] = useState<string>("");

  const suggestedFollowUps = useMemo(
    () => getSuggestedFollowUps(contacts, reminderInterval).slice(0, 10),
    [contacts, reminderInterval]
  );

  const handleIntervalBlur = () => {
    const parsed = parseInt(localInterval, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== reminderInterval) {
      updateInterval(parsed);
    }
    setLocalInterval(""); // Reset local state — controlled by hook value
  };

  const displayInterval = localInterval !== "" ? localInterval : String(reminderInterval);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold">Relationship Reminders</h3>
          <p className="text-xs text-muted-foreground">
            Contacts you haven't reached out to recently
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Label htmlFor="reminder-interval" className="text-xs text-muted-foreground whitespace-nowrap">
            Remind every
          </Label>
          <Input
            id="reminder-interval"
            type="number"
            min={1}
            max={365}
            value={displayInterval}
            onChange={(e) => setLocalInterval(e.target.value)}
            onBlur={handleIntervalBlur}
            className="h-7 w-20 text-xs text-center"
          />
          <span className="text-xs text-muted-foreground">days</span>
        </div>
      </div>

      {suggestedFollowUps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            No contacts are overdue for outreach
          </p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-1 pr-2">
            {suggestedFollowUps.map((contact) => {
              const daysText =
                contact.daysSince === Infinity
                  ? "Never contacted"
                  : `${contact.daysSince} day${contact.daysSince !== 1 ? "s" : ""} ago`;

              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    {contact.company && (
                      <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {daysText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
