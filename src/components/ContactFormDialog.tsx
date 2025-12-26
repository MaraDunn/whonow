import { useState, useEffect, useRef } from "react";
import { X, Check, Camera, Loader2, Sparkles, ChevronDown, ChevronUp, Building2, UserCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { generateAutoKeywords } from "@/utils/autoKeywords";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (contact: Omit<Contact, "id"> & { isShared?: boolean }) => void;
  contact?: Contact | null;
  isProfileMode?: boolean;
  presetKeywords?: string[];
  folders?: Folder[];
  defaultFolderId?: string | null;
  initialMode?: "quick" | "full";
  hasCompany?: boolean;
}

export function ContactFormDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  contact, 
  isProfileMode, 
  presetKeywords = [], 
  folders = [], 
  defaultFolderId,
  initialMode = "full",
  hasCompany = false,
}: ContactFormDialogProps) {
  const [mode, setMode] = useState<"quick" | "full">(initialMode);
  const [quickInput, setQuickInput] = useState("");
  const [parsing, setParsing] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [autoTags, setAutoTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [isShared, setIsShared] = useState(false);
  
  const [contactOpen, setContactOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAvatar, uploading } = useAvatarUpload();

  const isEditing = !!contact;
  
  const getDialogTitle = () => {
    if (isProfileMode) {
      return isEditing ? "Edit My Contact Card" : "Create My Contact Card";
    }
    return isEditing ? "Edit Contact" : "Add New Contact";
  };

  useEffect(() => {
    if (contact) {
      setMode("full");
      setName(contact.name);
      setEmail(contact.email);
      setPhone(contact.phone);
      setCompany(contact.company);
      setRole(contact.role);
      setTags(contact.tags);
      setAutoTags([]);
      setDescription(contact.description || "");
      setAvatar(contact.avatar);
      setFolderId(contact.folderId);
      setIsShared(contact.isShared || false);
    } else {
      resetForm();
      setMode(initialMode);
      setFolderId(defaultFolderId || undefined);
    }
  }, [contact, open, defaultFolderId, initialMode]);

  const resetForm = () => {
    setQuickInput("");
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setRole("");
    setTagInput("");
    setTags([]);
    setAutoTags([]);
    setDescription("");
    setAvatar(undefined);
    setFolderId(undefined);
    setIsShared(false);
    setContactOpen(false);
    setWorkOpen(false);
    setKeywordsOpen(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    const url = await uploadAvatar(file);
    if (url) {
      setAvatar(url);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const removeAutoTag = (tagToRemove: string) => {
    setAutoTags(autoTags.filter((tag) => tag !== tagToRemove));
  };

  const togglePresetTag = (preset: string) => {
    if (tags.includes(preset)) {
      setTags(tags.filter((tag) => tag !== preset));
    } else {
      setTags([...tags, preset]);
    }
  };

  const handleQuickParse = async () => {
    if (!quickInput.trim()) {
      toast.error("Please enter some contact information");
      return;
    }

    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-contact-input", {
        body: { input: quickInput }
      });

      if (error) throw error;

      if (data?.parsed) {
        const parsed = data.parsed;
        setName(parsed.name || "");
        setEmail(parsed.email || "");
        setPhone(parsed.phone || "");
        setCompany(parsed.company || "");
        setRole(parsed.role || "");
        setDescription(parsed.description || "");
        
        if (parsed.suggestedKeywords?.length > 0) {
          setAutoTags(parsed.suggestedKeywords);
        }
        
        setMode("full");
        toast.success("Contact info parsed! Review and save.");
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse contact info. Try entering details manually.");
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Generate auto-keywords from data
    const { allKeywords } = generateAutoKeywords(role, company, description, [...tags, ...autoTags]);

    onSave({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      role: role.trim(),
      tags: allKeywords,
      description: description.trim() || undefined,
      avatar,
      folderId,
      isShared: hasCompany ? isShared : false,
    });

    resetForm();
    onOpenChange(false);
  };

  const CollapsibleSection = ({ 
    title, 
    open: isOpen, 
    onOpenChange: setOpen, 
    children 
  }: { 
    title: string; 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    children: React.ReactNode;
  }) => (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span>{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {/* Mode Toggle - only show for new contacts */}
          {!isEditing && !isProfileMode && (
            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant={mode === "quick" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("quick")}
                className={mode === "quick" ? "gradient-hero text-primary-foreground" : ""}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Quick Add
              </Button>
              <Button
                type="button"
                variant={mode === "full" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("full")}
                className={mode === "full" ? "gradient-hero text-primary-foreground" : ""}
              >
                Full Form
              </Button>
            </div>
          )}

          {/* Quick Add Mode */}
          {mode === "quick" && !isEditing && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="quickInput">Paste or type contact info</Label>
                <Textarea
                  id="quickInput"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="e.g. John Smith john@acme.com Marketing Manager at Acme Inc - handles our ad campaigns"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  AI will extract name, email, phone, company, role, and keywords automatically.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleQuickParse}
                disabled={parsing || !quickInput.trim()}
                className="w-full gradient-hero text-primary-foreground"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Parse with AI
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Full Form Mode */}
          {(mode === "full" || isEditing) && (
            <div className="space-y-4 mt-4">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-20 w-20 border-2 border-border">
                    <AvatarImage src={avatar} alt={name || "Avatar"} />
                    <AvatarFallback className="text-lg bg-muted">
                      {name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <span className="text-xs text-muted-foreground">Click to upload photo</span>
              </div>

              {/* Essential Fields */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What do they handle? e.g. 'Handles all marketing campaigns'"
                  rows={2}
                />
              </div>

              {/* Share with company toggle - only for org users */}
              {hasCompany && !isProfileMode && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-3">
                    {isShared ? (
                      <Building2 className="h-5 w-5 text-primary" />
                    ) : (
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {isShared ? "Shared with company" : "Personal contact"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isShared 
                          ? "Everyone in your company can view this contact" 
                          : "Only you can see this contact"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isShared}
                    onCheckedChange={setIsShared}
                    aria-label="Share with company"
                  />
                </div>
              )}

              {/* Contact Details - Collapsible */}
              <CollapsibleSection title="Contact Details" open={contactOpen} onOpenChange={setContactOpen}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </CollapsibleSection>

              {/* Work Info - Collapsible */}
              <CollapsibleSection title="Work Info" open={workOpen} onOpenChange={setWorkOpen}>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Inc"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Marketing Manager"
                  />
                </div>
                {/* Folder Selector */}
                {folders.length > 0 && !isProfileMode && (
                  <div className="space-y-2">
                    <Label htmlFor="folder">Folder</Label>
                    <Select value={folderId || "none"} onValueChange={(val) => setFolderId(val === "none" ? undefined : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a folder..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No folder</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: folder.color }} />
                              {folder.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CollapsibleSection>

              {/* Keywords - Collapsible */}
              <CollapsibleSection title="Keywords" open={keywordsOpen} onOpenChange={setKeywordsOpen}>
                {/* Auto-generated keywords */}
                {autoTags.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">AI suggested:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {autoTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="cursor-pointer border-dashed hover:bg-destructive/10"
                          onClick={() => removeAutoTag(tag)}
                        >
                          {tag}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Preset keywords */}
                {presetKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {presetKeywords.map((preset) => {
                      const isSelected = tags.includes(preset);
                      return (
                        <Badge
                          key={preset}
                          variant={isSelected ? "default" : "outline"}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent hover:text-accent-foreground"
                          }`}
                          onClick={() => togglePresetTag(preset)}
                        >
                          {isSelected && <Check className="h-3 w-3 mr-1" />}
                          {preset}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Type custom keywords and press Enter..."
                />
                
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeTag(tag)}
                      >
                        {tag}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {(mode === "full" || isEditing) && (
            <Button type="submit" className="gradient-hero text-primary-foreground">
              {isEditing ? "Save Changes" : "Add Contact"}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
