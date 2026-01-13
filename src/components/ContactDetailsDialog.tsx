import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { Mail, Phone, Building2, Briefcase, Clock, Star, User, Users, UserCircle, Folder as FolderIcon, FolderPlus, X, Edit, Trash2, Share2, Save, ChevronDown, ChevronUp, Navigation, MapPin, Loader2, Check, Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ShareToSlackDialog } from "@/components/ShareToSlackDialog";
import { useState, useEffect, useRef } from "react";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { generateAutoKeywords } from "@/utils/autoKeywords";
import { lookupBusinessAtAddress } from "@/utils/businessLookup";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Helper to format last contacted time
function formatLastContacted(lastContactedAt?: string): string | null {
  if (!lastContactedAt) return null;
  try {
    return formatDistanceToNow(new Date(lastContactedAt), { addSuffix: true });
  } catch {
    return null;
  }
}

// Collapsible section component
interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, open: isOpen, onOpenChange: setOpen, children }: CollapsibleSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wide">
        <span>{title}</span>
        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface ContactDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  folder?: Folder;
  folders?: Folder[];
  presetKeywords?: string[];
  showOwnershipBadge?: boolean;
  hasCompany?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSave?: (contact: Contact) => void;
}

export function ContactDetailsDialog({
  open,
  onOpenChange,
  contact,
  folder,
  folders = [],
  presetKeywords = [],
  showOwnershipBadge = false,
  hasCompany = false,
  onEdit,
  onDelete,
  onSave,
}: ContactDetailsDialogProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);
  const slack = useSlackIntegration();
  const { uploadAvatar, uploading } = useAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for edit mode
  const [editedContact, setEditedContact] = useState<Contact | null>(null);
  
  // Edit form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [isShared, setIsShared] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [autoTags, setAutoTags] = useState<string[]>([]);
  
  // Address fields
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [businessName, setBusinessName] = useState<string | undefined>(undefined);
  const [businessType, setBusinessType] = useState<string | undefined>(undefined);
  const [isLookingUpBusiness, setIsLookingUpBusiness] = useState(false);
  const [detectedBusinessName, setDetectedBusinessName] = useState<string | undefined>(undefined);
  const [detectedBusinessType, setDetectedBusinessType] = useState<string | undefined>(undefined);

  // Accordion states
  const [contactOpen, setContactOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  // Check Slack connection status when dialog opens
  useEffect(() => {
    if (open) {
      slack.getStatus();
      setIsEditing(false);
      if (contact) {
        initializeForm(contact);
      }
      // Reset accordion states when dialog opens (closed by default)
      setContactOpen(false);
      setWorkOpen(false);
      setKeywordsOpen(false);
      setAddressOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update form when contact changes
  useEffect(() => {
    if (contact && !isEditing) {
      initializeForm(contact);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, isEditing]);

  const initializeForm = (contactData: Contact) => {
    setName(contactData.name);
    setEmail(contactData.email || "");
    setPhone(contactData.phone || "");
    setCompany(contactData.company || "");
    setRole(contactData.role || "");
    setDescription(contactData.description || "");
    setAvatar(contactData.avatar);
    setFolderId(contactData.folderId);
    setIsShared(contactData.isShared || false);
    setTags(contactData.tags || []);
    setTagInput("");
    setAutoTags([]);
    setAddress(contactData.address || "");
    setCity(contactData.city || "");
    setState(contactData.state || "");
    setZipCode(contactData.zipCode || "");
    setCountry(contactData.country || "");
    setLatitude(contactData.latitude);
    setLongitude(contactData.longitude);
    setBusinessName(contactData.businessName);
    setBusinessType(contactData.businessType);
    setDetectedBusinessName(undefined);
    setDetectedBusinessType(undefined);
    setEditedContact(contactData);
  };

  // Business lookup effect
  useEffect(() => {
    if (businessName) return;
    
    const hasAddress = address.trim() || city.trim() || state.trim() || zipCode.trim();
    const hasCoordinates = latitude !== undefined && longitude !== undefined;
    
    if (!hasAddress && !hasCoordinates) {
      setDetectedBusinessName(undefined);
      setDetectedBusinessType(undefined);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsLookingUpBusiness(true);
      try {
        const addressParts = [
          address.trim(),
          city.trim(),
          state.trim(),
          zipCode.trim(),
          country.trim(),
        ].filter(Boolean);
        const addressString = addressParts.join(", ");
        
        if (addressString || (latitude && longitude)) {
          const businessInfo = await lookupBusinessAtAddress(
            addressString,
            latitude,
            longitude
          );
          
          if (businessInfo) {
            setDetectedBusinessName(businessInfo.name);
            setDetectedBusinessType(businessInfo.type);
          } else {
            setDetectedBusinessName(undefined);
            setDetectedBusinessType(undefined);
          }
        }
      } catch (error) {
        console.error("Business lookup error:", error);
        setDetectedBusinessName(undefined);
        setDetectedBusinessType(undefined);
      } finally {
        setIsLookingUpBusiness(false);
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [address, city, state, zipCode, country, latitude, longitude, businessName]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const url = await uploadAvatar(file);
    if (url) {
      setAvatar(url);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    
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

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(lat);
        setLongitude(lng);

        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          );
          const data = await response.json();
          
          if (data.locality) setCity(data.locality);
          if (data.principalSubdivision) setState(data.principalSubdivision);
          if (data.postcode) setZipCode(data.postcode);
          if (data.countryName) setCountry(data.countryName);
          
          toast.success("Location retrieved successfully");
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          toast.success("Location coordinates saved");
        }
        
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsGettingLocation(false);
        toast.error("Failed to get location");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleEditClick = () => {
    setIsEditing(true);
    // Open relevant accordions in edit mode
    setContactOpen(true);
    setWorkOpen(true);
    onEdit();
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (contact) {
      initializeForm(contact);
    }
    // Reset accordion states when canceling edit
    setContactOpen(false);
    setWorkOpen(false);
    setKeywordsOpen(false);
    setAddressOpen(false);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!contact || !onSave) return;

    // Generate auto-keywords
    const { allKeywords } = generateAutoKeywords(role, company, description, [...tags, ...autoTags]);

    const updatedContact: Contact = {
      ...contact,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      tags: allKeywords,
      description: description.trim() || undefined,
      avatar,
      folderId,
      isShared: hasCompany ? isShared : false,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      country: country.trim() || undefined,
      latitude,
      longitude,
      businessName,
      businessType,
    };

    onSave(updatedContact);
    setIsEditing(false);
    toast.success("Contact updated");
  };

  const handleQuickFolderChange = (newFolderId: string | null) => {
    if (!contact || !onSave) return;

    const updatedContact: Contact = {
      ...contact,
      folderId: newFolderId || undefined,
    };

    onSave(updatedContact);
    const folderName = newFolderId 
      ? folders.find(f => f.id === newFolderId)?.name || "folder"
      : "No folder";
    toast.success(`Moved to ${folderName}`);
    setFolderPopoverOpen(false);
  };

  if (!contact) return null;

  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const lastContactedText = formatLastContacted(contact.lastContactedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] w-[calc(100vw-2rem)] sm:w-full flex flex-col p-0 [&>button]:hidden overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-border gap-2 shrink-0">
          <h2 className="font-display font-semibold text-base sm:text-lg text-foreground truncate min-w-0">
            {isEditing ? "Edit Contact" : "Contact Details"}
          </h2>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {!isEditing && slack.status?.connected && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareDialogOpen(true)}
                className="h-8 w-8"
                title="Share to Slack"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            {!isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEditClick}
                  className="h-8 w-8"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8 px-3"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  className="h-8 px-3"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsEditing(false);
                onOpenChange(false);
              }}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3 space-y-4">
          {isEditing ? (
            /* EDIT MODE */
            <>
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-20 w-20 border-2 border-border">
                    <AvatarImage src={avatar} alt={name || "Avatar"} />
                    <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-display font-semibold">
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

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What do they handle? e.g. 'Handles all marketing campaigns'"
                  rows={2}
                />
              </div>

              {/* Share toggle */}
              {hasCompany && (
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

              {/* Contact Details Accordion */}
              <CollapsibleSection title="Contact Details" open={contactOpen} onOpenChange={setContactOpen}>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </CollapsibleSection>

              {/* Work Info Accordion */}
              <CollapsibleSection title="Work Info" open={workOpen} onOpenChange={setWorkOpen}>
                <div className="space-y-2">
                  <Label htmlFor="edit-company">Company</Label>
                  <Input
                    id="edit-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Inc"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Input
                    id="edit-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Marketing Manager"
                  />
                </div>
                {folders.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-folder">Folder</Label>
                    <Select value={folderId || "none"} onValueChange={(val) => setFolderId(val === "none" ? undefined : val)}>
                      <SelectTrigger id="edit-folder">
                        <SelectValue placeholder="Select a folder..." />
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
              </CollapsibleSection>

              {/* Address Accordion */}
              <CollapsibleSection title="Address" open={addressOpen} onOpenChange={setAddressOpen}>
                {navigator.geolocation && (
                  <div className="mb-3 space-y-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGetCurrentLocation}
                      disabled={isGettingLocation}
                      className="w-full"
                    >
                      {isGettingLocation ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Getting location...
                        </>
                      ) : (
                        <>
                          <Navigation className="h-4 w-4 mr-2" />
                          Use Current Location
                        </>
                      )}
                    </Button>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Street Address</Label>
                  <Input
                    id="edit-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="San Francisco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-state">State</Label>
                    <Input
                      id="edit-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="CA"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-zipCode">ZIP Code</Label>
                    <Input
                      id="edit-zipCode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="94102"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-country">Country</Label>
                    <Input
                      id="edit-country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="USA"
                    />
                  </div>
                </div>
                {(latitude !== undefined || longitude !== undefined) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <MapPin className="h-3 w-3" />
                    <span>
                      Coordinates: {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                    </span>
                  </div>
                )}
                
                {/* Business Lookup */}
                {(isLookingUpBusiness || detectedBusinessName || businessName) && (
                  <div className="mt-3 space-y-2">
                    {isLookingUpBusiness && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Looking up business at this address...</span>
                      </div>
                    )}
                    
                    {detectedBusinessName && !businessName && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-start gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-primary mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Business Detected</p>
                            <p className="text-sm mt-1">{detectedBusinessName}</p>
                            {detectedBusinessType && detectedBusinessType !== 'unknown' && (
                              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                                {detectedBusinessType.replace(':', ' - ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setBusinessName(detectedBusinessName);
                              setBusinessType(detectedBusinessType);
                            }}
                            className="h-7 text-xs"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Use This
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetectedBusinessName(undefined);
                              setDetectedBusinessType(undefined);
                            }}
                            className="h-7 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {businessName && (
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2 flex-1">
                            <Building2 className="h-4 w-4 text-primary mt-0.5" />
                            <div className="flex-1">
                              <Label htmlFor="edit-businessName" className="text-xs text-muted-foreground mb-1 block">
                                Business Name
                              </Label>
                              <Input
                                id="edit-businessName"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Business name"
                                className="h-8 text-sm"
                              />
                              {businessType && businessType !== 'unknown' && (
                                <>
                                  <Label htmlFor="edit-businessType" className="text-xs text-muted-foreground mb-1 block mt-2">
                                    Business Type
                                  </Label>
                                  <Input
                                    id="edit-businessType"
                                    value={businessType}
                                    onChange={(e) => setBusinessType(e.target.value)}
                                    placeholder="Business type"
                                    className="h-8 text-sm"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setBusinessName(undefined);
                              setBusinessType(undefined);
                              setDetectedBusinessName(undefined);
                              setDetectedBusinessType(undefined);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleSection>

              {/* Keywords Accordion */}
              <CollapsibleSection title="Keywords" open={keywordsOpen} onOpenChange={setKeywordsOpen}>
                {autoTags.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Suggested keywords:</span>
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
                  id="edit-tags"
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
            </>
          ) : (
            /* VIEW MODE */
            <>
              {/* Avatar and Name Section - More Compact */}
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14 border-2 border-border flex-shrink-0">
                  <AvatarImage src={contact.avatar} alt={contact.name} />
                  <AvatarFallback className="text-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-display font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className="font-display font-semibold text-xl text-foreground">
                      {contact.name}
                    </h3>
                    {contact.isClient && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                        <Star className="h-3 w-3 fill-current" />
                        Client
                      </span>
                    )}
                    {showOwnershipBadge && contact.isShared && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                        <Users className="h-3 w-3" />
                        Shared
                      </span>
                    )}
                    {showOwnershipBadge && !contact.isShared && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                        <UserCircle className="h-3 w-3" />
                        Personal
                      </span>
                    )}
                  </div>
                  
                  {/* Last contacted */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={cn(
                      "text-xs",
                      lastContactedText ? 'text-muted-foreground' : 'text-orange-500 font-medium'
                    )}>
                      {lastContactedText || "Never contacted"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Information - Email and Phone - More Compact */}
              {(contact.email || contact.phone) && (
                <div className="space-y-2">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2.5 text-sm text-secondary-foreground hover:text-primary transition-colors group/email py-1.5 min-w-0"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/email:bg-primary/10 transition-colors flex-shrink-0">
                        <Mail className="h-4 w-4 text-muted-foreground group-hover/email:text-primary" />
                      </div>
                      <span className="hover:underline truncate min-w-0">{contact.email}</span>
                    </a>
                  )}

                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-2.5 text-sm text-secondary-foreground hover:text-primary transition-colors group/phone py-1.5 min-w-0"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary group-hover/phone:bg-primary/10 transition-colors flex-shrink-0">
                        <Phone className="h-4 w-4 text-muted-foreground group-hover/phone:text-primary" />
                      </div>
                      <span className="hover:underline truncate min-w-0">{contact.phone}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Description - More Compact */}
              {contact.description && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Description
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {contact.description}
                  </p>
                </div>
              )}

              {/* Work Info Accordion - Always visible in view mode */}
              <CollapsibleSection title="Work Info" open={workOpen} onOpenChange={setWorkOpen}>
                {(contact.company || contact.role || folder) ? (
                  <div className="space-y-2">
                    {contact.company && (
                      <div className="flex items-center gap-2.5 text-sm text-secondary-foreground">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary flex-shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="truncate">{contact.company}</span>
                      </div>
                    )}
                    {contact.role && (
                      <div className="flex items-center gap-2.5 text-sm text-secondary-foreground">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary flex-shrink-0">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="truncate">{contact.role}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      {folder ? (
                        <div className="flex items-center gap-2.5 text-sm text-secondary-foreground flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary flex-shrink-0">
                            <FolderIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div 
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/80 border border-border/50 w-fit transition-all duration-200"
                            style={{ 
                              borderLeft: `3px solid ${folder.color}`,
                            }}
                          >
                            <span style={{ color: folder.color }} className="truncate font-medium">{folder.name}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 text-sm text-muted-foreground flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary flex-shrink-0">
                            <FolderIcon className="h-4 w-4" />
                          </div>
                          <span>No folder</span>
                        </div>
                      )}
                      {folders.length > 0 && (
                        <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs shrink-0 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderPopoverOpen(true);
                              }}
                            >
                              <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                              Move
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-56 p-1.5" 
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-0.5">
                              <button
                                onClick={() => handleQuickFolderChange(null)}
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                                  !folder 
                                    ? "bg-primary/10 text-primary font-medium" 
                                    : "hover:bg-accent hover:text-accent-foreground text-foreground"
                                )}
                              >
                                <span className="flex items-center gap-2.5">
                                  <FolderIcon className="h-4 w-4" />
                                  <span>No folder</span>
                                </span>
                                {!folder && <Check className="h-4 w-4 text-primary" />}
                              </button>
                              {folders.map((f) => (
                                <button
                                  key={f.id}
                                  onClick={() => handleQuickFolderChange(f.id)}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150",
                                    folder?.id === f.id
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-accent hover:text-accent-foreground text-foreground"
                                  )}
                                >
                                  <span className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span 
                                      className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-border/50" 
                                      style={{ backgroundColor: f.color }}
                                    />
                                    <span className="truncate">{f.name}</span>
                                  </span>
                                  {folder?.id === f.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No work information available</p>
                )}
              </CollapsibleSection>

              {/* Address Accordion - Always visible in view mode */}
              <CollapsibleSection title="Address" open={addressOpen} onOpenChange={setAddressOpen}>
                {(contact.address || contact.city || contact.state || contact.zipCode || contact.country || contact.latitude !== undefined || contact.longitude !== undefined || contact.businessName) ? (
                  <div className="space-y-2">
                    {contact.address && (
                      <div className="flex items-start gap-2.5 text-sm text-secondary-foreground">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>{contact.address}</span>
                      </div>
                    )}
                    {(contact.city || contact.state || contact.zipCode || contact.country) && (
                      <div className="text-sm text-secondary-foreground pl-6">
                        {[contact.city, contact.state, contact.zipCode, contact.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                    {(contact.latitude !== undefined || contact.longitude !== undefined) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 pl-6">
                        <span>
                          {contact.latitude?.toFixed(6)}, {contact.longitude?.toFixed(6)}
                        </span>
                      </div>
                    )}
                    {contact.businessName && (
                      <div className="flex items-start gap-2.5 text-sm text-secondary-foreground pt-2 border-t border-border">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{contact.businessName}</p>
                          {contact.businessType && contact.businessType !== 'unknown' && (
                            <p className="text-xs text-muted-foreground capitalize mt-0.5">
                              {contact.businessType.replace(':', ' - ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No address information available</p>
                )}
              </CollapsibleSection>

              {/* Keywords Accordion - Always visible in view mode */}
              <CollapsibleSection title="Keywords" open={keywordsOpen} onOpenChange={setKeywordsOpen}>
                {contact.tags && contact.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="px-2 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No keywords added</p>
                )}
              </CollapsibleSection>
            </>
          )}
        </div>
      </DialogContent>
      <ShareToSlackDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        contact={contact}
      />
    </Dialog>
  );
}
