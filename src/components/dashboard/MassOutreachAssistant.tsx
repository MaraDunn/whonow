import { useState, useMemo, useEffect, useRef } from "react";
import {
  Copy, Check, MessageSquarePlus, ChevronDown, ChevronUp, Users,
  BookmarkPlus, Pencil, Trash2, Save, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import type { Contact } from "@/types/contact";

const VARIABLE_HINTS = [
  { key: "{{first_name}}", label: "First name" },
  { key: "{{last_name}}", label: "Last name" },
  { key: "{{company}}", label: "Company" },
  { key: "{{role}}", label: "Role" },
];

const DEFAULT_TEMPLATE =
  "Hi {{first_name}},\n\nI wanted to reach out to you personally...";

function fillTemplate(template: string, contact: Contact): string {
  const firstName = contact.name.split(" ")[0] ?? contact.name;
  const lastName = contact.name.split(" ").slice(1).join(" ") ?? "";
  return template
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{last_name\}\}/g, lastName)
    .replace(/\{\{company\}\}/g, contact.company || "your company")
    .replace(/\{\{role\}\}/g, contact.role || "your role");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleCopy}
      title="Copy message"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

interface EmailButtonProps {
  email: string;
  subject?: string;
  body: string;
}

function EmailButton({ email, subject = "", body }: EmailButtonProps) {
  const handleEmail = () => {
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleEmail}
      title="Open in email client"
    >
      <Mail className="h-3.5 w-3.5" />
    </Button>
  );
}

// ─── Template toolbar ────────────────────────────────────────────────────────

interface TemplateToolbarProps {
  currentBody: string;
  onLoad: (body: string) => void;
}

function TemplateToolbar({ currentBody, onLoad }: TemplateToolbarProps) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } =
    useMessageTemplates();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    addTemplate(name, currentBody);
    toast.success(`Template "${name}" saved`);
    setSaveName("");
    setSaveOpen(false);
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const commitRename = (id: string) => {
    const name = renameValue.trim();
    if (name) updateTemplate(id, { name });
    setRenamingId(null);
  };

  const handleOverwrite = (id: string) => {
    updateTemplate(id, { body: currentBody });
    toast.success("Template updated");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Load template dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 font-normal"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Templates
            {templates.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[10px] ml-0.5"
              >
                {templates.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {templates.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              No saved templates yet.
              <br />
              Save your current message below.
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="group flex items-center pr-1">
                {renamingId === t.id ? (
                  <div className="flex items-center gap-1 px-2 py-1 flex-1">
                    <Input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(t.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => commitRename(t.id)}
                      className="h-6 text-xs px-1.5 py-0"
                    />
                  </div>
                ) : (
                  <>
                    <DropdownMenuItem
                      className="flex-1 cursor-pointer text-xs"
                      onClick={() => {
                        onLoad(t.body);
                        toast.success(`Loaded "${t.name}"`);
                      }}
                    >
                      <span className="truncate">{t.name}</span>
                    </DropdownMenuItem>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Overwrite with current message"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOverwrite(t.id);
                        }}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(t.id, t.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTemplate(t.id);
                          toast.success(`Template "${t.name}" deleted`);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
          <DropdownMenuSeparator />
          {/* Inline save new template */}
          <div className="px-2 py-1.5">
            <Popover open={saveOpen} onOpenChange={setSaveOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-start gap-1.5 text-primary hover:text-primary"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save current message as template
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <p className="text-xs font-medium mb-2">Template name</p>
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") setSaveOpen(false);
                    }}
                    placeholder="e.g. Cold outreach"
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                  >
                    Save
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MassOutreachAssistantProps {
  contacts: Contact[];
  preSelectedIds?: Set<string>;
}

export function MassOutreachAssistant({ contacts, preSelectedIds }: MassOutreachAssistantProps) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contactListOpen, setContactListOpen] = useState(true);

  useEffect(() => {
    if (preSelectedIds && preSelectedIds.size > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        preSelectedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [preSelectedIds]);

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id)),
    [contacts, selectedIds]
  );

  const previews = useMemo(
    () =>
      selectedContacts.map((contact) => ({
        contact,
        message: fillTemplate(template, contact),
      })),
    [selectedContacts, template]
  );

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleInsertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? template.length;
      const end = el.selectionEnd ?? template.length;
      const newValue = template.slice(0, start) + variable + template.slice(end);
      setTemplate(newValue);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      });
    } else {
      setTemplate((prev) => prev + variable);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Outreach Assistant</h3>
        <p className="text-xs text-muted-foreground">
          Write a template, select contacts, and get personalized messages ready to send.
          No sending happens here — copy and paste at your own pace.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Template + contact selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-medium shrink-0">Message template</label>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {VARIABLE_HINTS.map((hint) => (
                  <button
                    key={hint.key}
                    onClick={() => handleInsertVariable(hint.key)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-muted hover:bg-accent transition-colors"
                    title={`Insert ${hint.label}`}
                  >
                    {hint.key}
                  </button>
                ))}
              </div>
            </div>
            <TemplateToolbar
              currentBody={template}
              onLoad={(body) => setTemplate(body)}
            />
            <Textarea
              ref={textareaRef}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-[160px] font-mono text-sm resize-y"
              placeholder="Write your message template here..."
            />
          </div>

          {/* Contact selector */}
          <div className="border rounded-lg">
            <button
              className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium hover:bg-accent/50 transition-colors rounded-lg"
              onClick={() => setContactListOpen((o) => !o)}
            >
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Select contacts
                {selectedIds.size > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {selectedIds.size}
                  </Badge>
                )}
              </span>
              {contactListOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            {contactListOpen && (
              <>
                <Separator />
                <div className="px-3 py-2 flex items-center gap-2 border-b">
                  <Checkbox
                    checked={selectedIds.size === contacts.length && contacts.length > 0}
                    onCheckedChange={toggleSelectAll}
                    id="select-all-outreach"
                  />
                  <label
                    htmlFor="select-all-outreach"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    {selectedIds.size === contacts.length && contacts.length > 0
                      ? "Deselect all"
                      : `Select all (${contacts.length})`}
                  </label>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <div className="p-2 space-y-0.5">
                    {contacts.map((contact) => (
                      <label
                        key={contact.id}
                        className="flex items-center gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={() => toggleContact(contact.id)}
                        />
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback className="text-[9px]">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{contact.name}</p>
                          {contact.company && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {contact.company}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                    {contacts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No contacts available
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Personalized previews */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">
              Personalized previews
              {previews.length > 0 && (
                <span className="text-muted-foreground ml-1">({previews.length})</span>
              )}
            </p>
          </div>

          {previews.length === 0 ? (
            <div className="flex flex-col items-center justify-center border rounded-lg py-10 text-center">
              <MessageSquarePlus className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No contacts selected</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select contacts to see personalized previews
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <div className="space-y-3 pr-2">
                {previews.map(({ contact, message }) => (
                  <div key={contact.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback className="text-[9px]">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-medium truncate">{contact.name}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <EmailButton email={contact.email} body={message} />
                        <CopyButton text={message} />
                      </div>
                    </div>
                    <Separator />
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
