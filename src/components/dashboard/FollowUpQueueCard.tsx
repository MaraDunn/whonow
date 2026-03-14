import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Clock, AlarmClock, CheckSquare, Square, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useSetFollowUpDate,
  useSnoozeFollowUp,
  useBulkSetFollowUpDate,
  getNeedsFollowUp,
  isOverdue,
} from "@/hooks/useFollowUps";
import { useGoogleCalendarIntegration } from "@/hooks/useGoogleCalendarIntegration";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { toast } from "sonner";
import type { Contact } from "@/types/contact";

interface FollowUpQueueCardProps {
  contacts: Contact[];
  onMoveToOutreach?: (contactIds: string[]) => void;
  onViewContact?: (contact: Contact) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface DatePickerPopoverProps {
  currentDate?: string;
  onSelect: (date: string | null) => void;
}

function DatePickerPopover({ currentDate, onSelect }: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
          <CalendarIcon className="h-3 w-3" />
          {currentDate ? format(parseISO(currentDate), "MMM d") : "Set date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={currentDate ? parseISO(currentDate) : undefined}
          onSelect={(date) => {
            onSelect(date ? format(date, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          initialFocus
        />
        {currentDate && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              Clear follow-up
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface BulkDatePickerPopoverProps {
  onSelect: (date: string) => void;
  disabled: boolean;
}

function BulkDatePickerPopover({ onSelect, disabled }: BulkDatePickerPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" disabled={disabled}>
          <CalendarIcon className="h-3 w-3" />
          Set date for selected
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          onSelect={(date) => {
            if (date) {
              onSelect(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function useCalendarFollowUpCallback() {
  const { status, createEvent } = useGoogleCalendarIntegration();
  const { addFollowUpsToCalendar } = useReminderSettings();
  return useMemo(() => {
    if (!status?.connected || !addFollowUpsToCalendar) return undefined;
    return (contactId: string, date: string, contactName: string) => {
      createEvent(contactId, date, contactName).then((ok) => {
        if (!ok) toast.error("Follow-up set; could not add to Google Calendar");
      });
    };
  }, [status?.connected, addFollowUpsToCalendar, createEvent]);
}

export function FollowUpQueueCard({ contacts, onMoveToOutreach, onViewContact }: FollowUpQueueCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const onAfterSet = useCalendarFollowUpCallback();

  const setFollowUpDate = useSetFollowUpDate({ onAfterSet });
  const snoozeFollowUp = useSnoozeFollowUp({ onAfterSnooze: onAfterSet });
  const bulkSetFollowUpDate = useBulkSetFollowUpDate({ onAfterSet });

  const needsFollowUp = useMemo(() => getNeedsFollowUp(contacts), [contacts]);
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === needsFollowUp.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(needsFollowUp.map((c) => c.id)));
    }
  };

  const handleBulkSet = (date: string) => {
    const ids = Array.from(selectedIds);
    const contactNames: Record<string, string> = {};
    ids.forEach((id) => {
      const c = contactMap.get(id);
      if (c?.name) contactNames[id] = c.name;
    });
    bulkSetFollowUpDate.mutate(
      { ids, date, contactNames: Object.keys(contactNames).length > 0 ? contactNames : undefined },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Follow-Up Queue
            {needsFollowUp.length > 0 && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {needsFollowUp.length}
              </Badge>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            Contacts due for follow-up today or earlier
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.size > 0 && (
            <>
              {onMoveToOutreach && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    onMoveToOutreach(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                >
                  <Send className="h-3 w-3" />
                  To Outreach
                </Button>
              )}
              <BulkDatePickerPopover onSelect={handleBulkSet} disabled={selectedIds.size === 0} />
            </>
          )}
        </div>
      </div>

      {needsFollowUp.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No follow-ups due</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set follow-up dates on contacts to track them here
          </p>
        </div>
      ) : (
        <>
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-1 pb-2 border-b mb-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedIds.size === needsFollowUp.length ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {selectedIds.size === 0
                ? "Select all"
                : selectedIds.size === needsFollowUp.length
                  ? "Deselect all"
                  : `${selectedIds.size} selected`}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <div className="space-y-1 pr-2">
              {needsFollowUp.map((contact) => {
                const overdue = isOverdue(contact.followUpDate);
                return (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 transition-colors group"
                  >
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                      className="shrink-0"
                    />
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => onViewContact?.(contact)}
                    >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{contact.name}</p>
                        {overdue && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>Overdue</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {contact.company && (
                        <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
                      )}
                    </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                snoozeFollowUp.mutate({ id: contact.id, days: 7, contactName: contact.name })
                              }
                            >
                              <AlarmClock className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Snooze 7 days</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DatePickerPopover
                        currentDate={contact.followUpDate}
                        onSelect={(date) =>
                          setFollowUpDate.mutate({ id: contact.id, date, contactName: contact.name })
                        }
                      />
                    </div>
                    {/* Always-visible date (non-hover) */}
                    <span className="text-xs text-muted-foreground group-hover:hidden shrink-0">
                      {contact.followUpDate
                        ? format(parseISO(contact.followUpDate), "MMM d")
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
