import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Camera, Loader2, Zap, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { generateAutoKeywords } from "@/utils/autoKeywords";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Folder } from "@/types/folder";

interface ProfileEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProfileCollapsibleSection({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3 sm:py-1.5 text-base sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
        <span>{title}</span>
        {open ? <ChevronUp className="h-5 w-5 sm:h-4 sm:w-4" /> : <ChevronDown className="h-5 w-5 sm:h-4 sm:w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2 sm:pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function ProfileEditorDialog({ open, onOpenChange }: ProfileEditorDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile(user?.id);
  const { uploadAvatar, uploading } = useAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: myProfileContact } = useQuery({
    queryKey: ["my-profile-contact", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("owner_id", user.id)
        .contains("tags", ["my-profile"])
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        name: (row.name as string) || "",
        email: (row.email as string) || "",
        phone: (row.phone as string) || "",
        company: (row.company as string) || "",
        role: (row.role as string) || "",
        description: (row.description as string) || "",
        tags: (row.tags as string[]) || [],
        avatar: (row.avatar as string) || undefined,
        folderId: (row.folder_id as string) || undefined,
        address: (row.address as string) || "",
        city: (row.city as string) || "",
        state: (row.state as string) || "",
        zipCode: (row.zip_code as string) || "",
        country: (row.country as string) || "",
      };
    },
    enabled: !!user && open,
  });

  const { data: allFoldersRaw = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("folders").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; color: string | null; directory_type: string; is_organization_folder: boolean | null }>;
    },
    enabled: !!user && open,
  });
  const folders: Folder[] = useMemo(
    () =>
      allFoldersRaw
        .filter((f) => f.directory_type === "contacts" && !f.is_organization_folder)
        .map((f) => ({ id: f.id, name: f.name, color: f.color || "#6366f1", createdAt: "", directoryType: "contacts" as const, isOrganizationFolder: false })),
    [allFoldersRaw]
  );

  const { autoKeywords: autoTags } = useMemo(() => generateAutoKeywords(role, company, description, tags), [role, company, description, tags]);

  useEffect(() => {
    if (!open) return;
    if (myProfileContact) {
      setFullName(myProfileContact.name || "");
      setPhone(myProfileContact.phone || "");
      setEmail(myProfileContact.email || user?.email || "");
      setCompany(myProfileContact.company || "");
      setRole(myProfileContact.role || "");
      setDescription(myProfileContact.description || "");
      setTags(myProfileContact.tags.filter((t) => t !== "my-profile"));
      setAvatar(myProfileContact.avatar);
      setFolderId(myProfileContact.folderId);
      setAddress(myProfileContact.address || "");
      setCity(myProfileContact.city || "");
      setState(myProfileContact.state || "");
      setZipCode(myProfileContact.zipCode || "");
      setCountry(myProfileContact.country || "");
    } else if (profile || user?.email) {
      setFullName(profile?.fullName || "");
      setPhone(profile?.phone || "");
      setEmail(user?.email || "");
      setCompany("");
      setRole(profile?.role || "");
      setDescription(profile?.description || "");
      setTags([]);
      setAvatar(profile?.avatarUrl);
      setFolderId(undefined);
      setAddress("");
      setCity("");
      setState("");
      setZipCode("");
      setCountry("");
    }
  }, [open, profile, user?.email, myProfileContact]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const value = tagInput.trim().replace(/,$/, "");
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setTagInput("");
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));
  const removeAutoTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadAvatar(file);
    if (url) setAvatar(url);
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("You must be logged in to update your profile");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSaving(true);
    try {
      updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: role.trim() || undefined,
        description: description.trim() || undefined,
        avatarUrl: avatar,
      });

      const allKeywords = [...tags, ...autoTags].filter(Boolean);
      const contactTags = [...new Set([...allKeywords, "my-profile"])];
      const payload = {
        name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        role: role.trim() || null,
        description: description.trim() || null,
        tags: contactTags,
        avatar: avatar || null,
        folder_id: folderId || null,
        owner_id: user.id,
        company_id: profile?.companyId || null,
        is_shared: false,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zipCode.trim() || null,
        country: country.trim() || null,
      };

      if (myProfileContact?.id) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", myProfileContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["my-profile-contact", user.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["team-directory-contacts"] });
      toast.success("Profile updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[calc(100vh-2rem)] flex flex-col p-0 [&>button]:hidden" aria-describedby="profile-editor-description">
        <DialogDescription id="profile-editor-description" className="sr-only">
          Edit your profile name, avatar, and preferences.
        </DialogDescription>
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-xl sm:text-lg">Edit Profile</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-4">
          {/* Same layout as contact edit form – "you" language throughout */}

          {/* Avatar */}
          <div className="flex flex-col items-center sm:items-start gap-4">
            <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-20 w-20 sm:h-16 sm:w-16 border-2 border-border">
                <AvatarImage src={avatar} alt={fullName || "Avatar"} />
                <AvatarFallback className="text-base sm:text-sm bg-muted">
                  {fullName ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
          </div>

          {/* Name */}
          <div className="space-y-2 sm:space-y-1.5">
            <Label htmlFor="profile-name" className="text-sm sm:text-xs font-medium">Name *</Label>
            <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required className="h-11 sm:h-9 text-base sm:text-sm" />
          </div>

          {/* Phone and Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
            <div className="space-y-2 sm:space-y-1.5">
              <Label htmlFor="profile-phone" className="text-sm sm:text-xs font-medium">Phone Number</Label>
              <Input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="h-11 sm:h-9 text-base sm:text-sm" />
            </div>
            <div className="space-y-2 sm:space-y-1.5">
              <Label htmlFor="profile-email" className="text-sm sm:text-xs font-medium">Email</Label>
              <Input id="profile-email" type="email" value={email} readOnly className="h-11 sm:h-9 text-base sm:text-sm bg-muted/50" />
              <p className="text-xs text-muted-foreground mt-1">Change email in Settings → Security</p>
            </div>
          </div>

          {/* Folder, Company, Role */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
            {folders.length > 0 && (
              <div className="space-y-2 sm:space-y-1.5">
                <Label htmlFor="profile-folder" className="text-sm sm:text-xs font-medium">Folder</Label>
                <Select value={folderId || "none"} onValueChange={(val) => setFolderId(val === "none" ? undefined : val)}>
                  <SelectTrigger id="profile-folder" className="h-11 sm:h-9 text-base sm:text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />
                          {f.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:space-y-1.5">
              <Label htmlFor="profile-company" className="text-sm sm:text-xs font-medium">Company</Label>
              <Input id="profile-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Where you work" className="h-11 sm:h-9 text-base sm:text-sm" />
            </div>
            <div className="space-y-2 sm:space-y-1.5">
              <Label htmlFor="profile-role" className="text-sm sm:text-xs font-medium">Role</Label>
              <Input id="profile-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Your role or title" className="h-11 sm:h-9 text-base sm:text-sm" />
            </div>
          </div>

          {/* Description – "you" language */}
          <div className="space-y-2 sm:space-y-1.5">
            <Label htmlFor="profile-description" className="text-sm sm:text-xs font-medium">Description</Label>
            <Textarea
              id="profile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What do you handle? (e.g. I handle all marketing campaigns)"
              rows={3}
              className="resize-none text-base sm:text-sm min-h-[4rem] sm:min-h-[2.5rem]"
            />
          </div>

          {/* Keywords – same styling as contact form */}
          <div className="space-y-3 sm:space-y-2 p-4 sm:p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Label htmlFor="profile-tags" className="text-base sm:text-sm font-semibold flex items-center gap-2 text-foreground">
              <Zap className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
              Keywords
              <span className="text-xs sm:text-[10px] font-normal text-muted-foreground ml-1">(Easiest way to enrich your profile)</span>
            </Label>
            <Textarea
              id="profile-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type keywords separated by commas or press Enter..."
              rows={3}
              className="resize-none text-base sm:text-sm min-h-[4rem] sm:min-h-[2.5rem] bg-background"
            />
            {(tags.length > 0 || autoTags.length > 0) && (
              <div className="flex flex-wrap gap-2 sm:gap-1.5 pt-2">
                {autoTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer border-dashed hover:bg-destructive/10 text-sm sm:text-xs py-1.5 sm:py-0.5 px-2.5 sm:px-2"
                    onClick={() => removeAutoTag(tag)}
                  >
                    {tag}
                    <X className="h-4 w-4 sm:h-3 sm:w-3 ml-1.5 sm:ml-1" />
                  </Badge>
                ))}
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-sm sm:text-xs py-1.5 sm:py-0.5 px-2.5 sm:px-2"
                    onClick={() => removeTag(tag)}
                  >
                    {tag}
                    <X className="h-4 w-4 sm:h-3 sm:w-3 ml-1.5 sm:ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Address – collapsible */}
          <ProfileCollapsibleSection title="Address" open={addressOpen} onOpenChange={setAddressOpen}>
            <div className="space-y-4 sm:space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="profile-address" className="text-sm font-medium">Street Address</Label>
                <Input id="profile-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="h-11 sm:h-9 text-base sm:text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                <div className="space-y-2">
                  <Label htmlFor="profile-city" className="text-sm font-medium">City</Label>
                  <Input id="profile-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Francisco" className="h-11 sm:h-9 text-base sm:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-state" className="text-sm font-medium">State</Label>
                  <Input id="profile-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="CA" className="h-11 sm:h-9 text-base sm:text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                <div className="space-y-2">
                  <Label htmlFor="profile-zipCode" className="text-sm font-medium">ZIP Code</Label>
                  <Input id="profile-zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="94102" className="h-11 sm:h-9 text-base sm:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-country" className="text-sm font-medium">Country</Label>
                  <Input id="profile-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA" className="h-11 sm:h-9 text-base sm:text-sm" />
                </div>
              </div>
            </div>
          </ProfileCollapsibleSection>
        </div>

        {/* Footer – same as contact form */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-2 px-4 sm:px-6 py-4 border-t border-border shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto h-11 sm:h-9 text-base sm:text-sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto h-11 sm:h-9 text-base sm:text-sm">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
