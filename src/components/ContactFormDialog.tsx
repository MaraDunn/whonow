import { useState, useEffect, useRef } from "react";
import { X, Check, Camera, Loader2, Zap, ChevronDown, ChevronUp, Building2, UserCircle, MapPin, Navigation } from "lucide-react";
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
import { toast } from "sonner";
import { formatName, formatPhoneNumber } from "@/utils/formatContact";
import { parseContactText } from "@/utils/contactTextParser";
import { lookupBusinessAtAddress } from "@/utils/businessLookup";
import { DuplicateContactDialog } from "@/components/DuplicateContactDialog";
import { useContacts } from "@/hooks/useContacts";

// Moved outside to prevent re-creation on every render (which causes input focus loss)
interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, open: isOpen, onOpenChange: setOpen, children }: CollapsibleSectionProps) {
  return (
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
}

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (contact: Omit<Contact, "id"> & { isShared?: boolean }) => void;
  contact?: Contact | null;
  presetKeywords?: string[];
  folders?: Folder[];
  defaultFolderId?: string | null;
  initialMode?: "quick" | "full";
  hasCompany?: boolean;
  checkDuplicates?: boolean; // Whether to check for duplicates before saving
}

export function ContactFormDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  contact, 
  presetKeywords = [], 
  folders = [], 
  defaultFolderId,
  initialMode = "full",
  hasCompany = false,
  checkDuplicates = true,
}: ContactFormDialogProps) {
  const [mode, setMode] = useState<"quick" | "full">(initialMode);
  const [quickInput, setQuickInput] = useState("");
  
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
  
  // Duplicate detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [foundDuplicates, setFoundDuplicates] = useState<Contact[]>([]);
  const [pendingContact, setPendingContact] = useState<Omit<Contact, "id"> & { isShared?: boolean } | null>(null);
  const { findDuplicatesForContact, mergeContact, isMerging } = useContacts();
  
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
  
  const [contactOpen, setContactOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAvatar, uploading } = useAvatarUpload();

  const isEditing = !!contact;
  
  const getDialogTitle = () => {
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
      setAddress(contact.address || "");
      setCity(contact.city || "");
      setState(contact.state || "");
      setZipCode(contact.zipCode || "");
      setCountry(contact.country || "");
      setLatitude(contact.latitude);
      setLongitude(contact.longitude);
      setBusinessName(contact.businessName);
      setBusinessType(contact.businessType);
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
    setAddress("");
    setCity("");
    setState("");
    setZipCode("");
    setCountry("");
    setLatitude(undefined);
    setLongitude(undefined);
    setBusinessName(undefined);
    setBusinessType(undefined);
    setDetectedBusinessName(undefined);
    setDetectedBusinessType(undefined);
    setIsLookingUpBusiness(false);
    setContactOpen(false);
    setWorkOpen(false);
    setKeywordsOpen(false);
    setAddressOpen(false);
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
    // Stop propagation to prevent dialog/collapsible keyboard handling from interfering
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

  const handleQuickParse = () => {
    if (!quickInput.trim()) {
      toast.error("Please enter some contact information");
      return;
    }

    try {
      const parsed = parseContactText(quickInput);
      
      // Apply parsed data to form fields
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
      toast.success("Contact info extracted! Review and save.");
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to extract contact info. Try entering details manually.");
    }
  };

  // Lookup business when address is entered
  useEffect(() => {
    // Only lookup if we have enough address info and no existing business name
    if (businessName) {
      // User has manually set a business, don't auto-lookup
      return;
    }
    
    const hasAddress = address.trim() || city.trim() || state.trim() || zipCode.trim();
    const hasCoordinates = latitude !== undefined && longitude !== undefined;
    
    if (!hasAddress && !hasCoordinates) {
      setDetectedBusinessName(undefined);
      setDetectedBusinessType(undefined);
      return;
    }
    
    // Debounce the lookup - wait 1 second after user stops typing
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
            // Don't auto-populate - let user verify first
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
    }, 1000); // Wait 1 second after user stops typing
    
    return () => clearTimeout(timeoutId);
  }, [address, city, state, zipCode, country, latitude, longitude, businessName]);

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    // Check permissions if available (some browsers support this)
    if (navigator.permissions && 'query' in navigator.permissions) {
      try {
        // Type assertion needed as TypeScript doesn't recognize geolocation in PermissionDescriptor
        const permissionStatus = await navigator.permissions.query({ 
          name: 'geolocation' 
        } as PermissionDescriptor);
        
        if (permissionStatus.state === 'denied') {
          toast.error(
            "Location permission is currently denied. Please enable location access in your browser settings (usually in Privacy/Security settings) and refresh the page.",
            { duration: 6000 }
          );
          return;
        }
      } catch (e) {
        // Permissions API might not be fully supported or geolocation not in the spec
        // This is fine - we'll rely on the error callback instead
        console.log("Permissions API check not available, will use error callback");
      }
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(lat);
        setLongitude(lng);

        // Try to reverse geocode to get address
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          );
          const data = await response.json();
          
          if (data.locality) setCity(data.locality);
          if (data.principalSubdivision) setState(data.principalSubdivision);
          if (data.postcode) setZipCode(data.postcode);
          if (data.countryName) setCountry(data.countryName);
          if (data.localityInfo?.administrative) {
            const admin = data.localityInfo.administrative;
            const addressParts = [
              admin.find((a: { name: string }) => a.name === data.locality)?.name,
              admin.find((a: { name: string }) => a.name === data.principalSubdivision)?.name,
            ].filter(Boolean);
            if (addressParts.length > 0) {
              setAddress(addressParts.join(", "));
            }
          }
          
          toast.success("Location retrieved successfully");
          
          // Trigger business lookup after address is populated
          // The useEffect will handle this automatically
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          toast.success("Location coordinates saved (address lookup failed)");
        }
        
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsGettingLocation(false);
        
        // Provide user-friendly error messages based on error code
        let errorMessage = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser settings and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Please check your device settings.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
          default:
            errorMessage = `Failed to get location: ${error.message}`;
            break;
        }
        
        toast.error(errorMessage, { duration: 5000 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Generate auto-keywords from data
    const { allKeywords } = generateAutoKeywords(role, company, description, [...tags, ...autoTags]);

    const contactData: Omit<Contact, "id"> & { isShared?: boolean } = {
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

    // Check for duplicates if enabled and not editing
    if (checkDuplicates && !isEditing) {
      try {
        const duplicates = await findDuplicatesForContact(contactData);
        if (duplicates.length > 0) {
          setFoundDuplicates(duplicates);
          setPendingContact(contactData);
          setDuplicateDialogOpen(true);
          return;
        }
      } catch (error) {
        console.error("Error checking for duplicates:", error);
        // Continue with save if duplicate check fails
      }
    }

    // No duplicates found, proceed with save
    onSave(contactData);
    resetForm();
    onOpenChange(false);
  };

  const handleMerge = async (primaryContact: Contact, newContactData: Omit<Contact, "id">) => {
    mergeContact(
      { primaryContact, newContactData },
      {
        onSuccess: () => {
          setDuplicateDialogOpen(false);
          setFoundDuplicates([]);
          setPendingContact(null);
          resetForm();
          onOpenChange(false);
        },
      }
    );
  };

  const handleSaveAnyway = () => {
    if (pendingContact) {
      onSave(pendingContact);
      setDuplicateDialogOpen(false);
      setFoundDuplicates([]);
      setPendingContact(null);
      resetForm();
      onOpenChange(false);
    }
  };


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {/* Mode Toggle - only show for new contacts */}
          {!isEditing && (
            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant={mode === "quick" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("quick")}
                className={mode === "quick" ? "gradient-hero text-primary-foreground" : ""}
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
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
                  Smart parse will extract name, email, phone, company, role, and keywords automatically.
                </p>
              </div>
              
              {/* Use Current Location Button */}
              {navigator.geolocation && (
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
              )}
              
              <Button
                type="button"
                onClick={handleQuickParse}
                disabled={!quickInput.trim()}
                className="w-full gradient-hero text-primary-foreground"
              >
                <Zap className="h-4 w-4 mr-2" />
                Smart Parse
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
                {folders.length > 0 && (
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

              {/* Address - Collapsible */}
              <CollapsibleSection title="Address" open={addressOpen} onOpenChange={setAddressOpen}>
                {/* Use Current Location Button */}
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
                    <p className="text-xs text-muted-foreground px-1">
                      Your browser will ask for location permission. If denied, you can still enter the address manually.
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="San Francisco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="CA"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="94102"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
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
                
                {/* Business Lookup Section */}
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
                              <Label htmlFor="businessName" className="text-xs text-muted-foreground mb-1 block">
                                Business Name
                              </Label>
                              <Input
                                id="businessName"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Business name"
                                className="h-8 text-sm"
                              />
                              {businessType && businessType !== 'unknown' && (
                                <>
                                  <Label htmlFor="businessType" className="text-xs text-muted-foreground mb-1 block mt-2">
                                    Business Type
                                  </Label>
                                  <Input
                                    id="businessType"
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
                        <p className="text-xs text-muted-foreground">
                          {detectedBusinessName === businessName ? "Auto-detected" : "Manually entered"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleSection>

              {/* Keywords - Collapsible */}
              <CollapsibleSection title="Keywords" open={keywordsOpen} onOpenChange={setKeywordsOpen}>
                {/* Auto-generated keywords */}
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
    
    {pendingContact && (
      <DuplicateContactDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        newContact={pendingContact}
        duplicateContacts={foundDuplicates}
        onMerge={handleMerge}
        onSaveAnyway={handleSaveAnyway}
        isMerging={isMerging}
      />
    )}
    </>
  );
}
