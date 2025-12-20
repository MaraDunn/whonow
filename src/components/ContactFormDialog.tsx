import { useState, useEffect, useRef } from "react";
import { X, Check, Camera, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (contact: Omit<Contact, "id">) => void;
  contact?: Contact | null;
  isProfileMode?: boolean;
  presetKeywords?: string[];
  folders?: Folder[];
  defaultFolderId?: string | null;
}

export function ContactFormDialog({ open, onOpenChange, onSave, contact, isProfileMode, presetKeywords = [], folders = [], defaultFolderId }: ContactFormDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
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
      setName(contact.name);
      setEmail(contact.email);
      setPhone(contact.phone);
      setCompany(contact.company);
      setRole(contact.role);
      setTags(contact.tags);
      setDescription(contact.description || "");
      setAvatar(contact.avatar);
      setFolderId(contact.folderId);
    } else {
      resetForm();
      setFolderId(defaultFolderId || undefined);
    }
  }, [contact, open, defaultFolderId]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setRole("");
    setTagInput("");
    setTags([]);
    setDescription("");
    setAvatar(undefined);
    setFolderId(undefined);
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

  const togglePresetTag = (preset: string) => {
    if (tags.includes(preset)) {
      setTags(tags.filter((tag) => tag !== preset));
    } else {
      setTags([...tags, preset]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !phone || !company || !role) {
      return;
    }

    onSave({
      name,
      email,
      phone,
      company,
      role,
      tags,
      description: description || undefined,
      avatar,
      folderId,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
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
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Developer"
                  required
                />
              </div>
            </div>

            {/* Folder Selector - only show if folders exist and not profile mode */}
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

            <div className="space-y-2">
              <Label htmlFor="tags">Keywords</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
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
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Or type custom keywords..."
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What do they handle? (e.g., 'Handles all marketing campaigns and brand strategy')"
                rows={3}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" className="gradient-hero text-primary-foreground">
            {isEditing ? "Save Changes" : "Add Contact"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}