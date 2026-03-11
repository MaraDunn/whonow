import { useState, useRef, useEffect } from "react";
import { Chrome, Check, AlertCircle, Loader2, FileUp, Upload, X, Camera, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { devLog } from "@/lib/devLog";

import { useAuth } from "@/hooks/useAuth";
import { useGoogleContacts } from "@/hooks/useGoogleContacts";
import { useFileContacts } from "@/hooks/useFileContacts";
import { useBusinessCardScannerAI as useBusinessCardScanner } from "@/hooks/useBusinessCardScannerAI";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contacts: Omit<Contact, "id">[]) => void;
  defaultTab?: string;
  folders?: Folder[];
  presetKeywords?: string[];
  defaultFolderId?: string | null;
}

export function ImportContactsDialog({
  open,
  onOpenChange,
  onImport,
  defaultTab,
  folders = [],
  presetKeywords = [],
  defaultFolderId,
}: ImportContactsDialogProps) {
  
  const [selectedGoogleContacts, setSelectedGoogleContacts] = useState<Set<number>>(new Set());
  const [selectedFileContacts, setSelectedFileContacts] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab || "scan");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraInitializing, setCameraInitializing] = useState(false);
  const [editedContact, setEditedContact] = useState<{
    name: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    description: string;
    tags: string[];
    avatar?: string;
    folderId?: string;
  } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { uploadAvatar, uploading: avatarUploading } = useAvatarUpload();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { signOut } = useAuth();
  const google = useGoogleContacts();
  const fileImport = useFileContacts();
  const scanner = useBusinessCardScanner();

  const isSessionExpiredError = scanner.error?.includes("Session expired") ?? false;
  const handleSignInAgain = async () => {
    await signOut();
    onOpenChange(false);
  };

  // Update edited contact when scanned contact changes
  useEffect(() => {
    if (scanner.scannedContact) {
      devLog("=== ImportContactsDialog: Updating editedContact from scannedContact ===");
      devLog("scanner.scannedContact:", JSON.stringify(scanner.scannedContact, null, 2));
      const newEditedContact = { 
        ...scanner.scannedContact,
        description: "",
        tags: [],
        avatar: undefined,
        folderId: defaultFolderId || undefined,
      };
      devLog("New editedContact:", JSON.stringify(newEditedContact, null, 2));
      setEditedContact(newEditedContact);
    }
  }, [scanner.scannedContact, defaultFolderId]);

  // Sync activeTab with defaultTab when dialog opens
  useEffect(() => {
    if (open && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  // Cleanup camera when dialog closes or tab changes
  useEffect(() => {
    if (!open || activeTab !== "scan") {
      scanner.stopCamera();
      setCameraActive(false);
      setCameraInitializing(false);
    }
  }, [open, activeTab, scanner.stopCamera]);

  // Start camera when cameraActive is set and video element is available.
  // Depend only on startCamera (stable from useCallback), not the whole scanner object,
  // to avoid re-running and interrupting play() with a new load.
  useEffect(() => {
    if (cameraActive && videoRef.current && cameraInitializing) {
      scanner.startCamera(videoRef.current).then(() => {
        setCameraInitializing(false);
      }).catch(() => {
        setCameraActive(false);
        setCameraInitializing(false);
      });
    }
  }, [cameraActive, cameraInitializing, scanner.startCamera]);


  const handleGoogleImport = () => {
    const contactsToImport: Omit<Contact, "id">[] = google.contacts
      .filter((_, i) => selectedGoogleContacts.has(i))
      .map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        role: c.role,
        avatar: c.avatar,
        tags: ["imported-google"],
      }));
    
    onImport(contactsToImport);
    google.clearContacts();
    setSelectedGoogleContacts(new Set());
    onOpenChange(false);
  };

  const handleFileImport = () => {
    const contactsToImport: Omit<Contact, "id">[] = fileImport.contacts
      .filter((_, i) => selectedFileContacts.has(i))
      .filter((c) => c.name && c.name.trim()) // Filter out contacts without names
      .map((c) => ({
        name: c.name.trim(),
        email: c.email?.trim() || "",
        phone: c.phone?.trim() || "",
        company: c.company?.trim() || "",
        role: c.role?.trim() || "",
        tags: ["imported-file"],
      }));
    
    if (contactsToImport.length === 0) {
      alert("No valid contacts selected. Please select contacts with names to import.");
      return;
    }
    
    onImport(contactsToImport);
    fileImport.clearContacts();
    setSelectedFileContacts(new Set());
    onOpenChange(false);
  };

  const handleScannedImport = () => {
    if (!editedContact || !editedContact.name) return;

    onImport([{
      name: editedContact.name,
      email: editedContact.email,
      phone: editedContact.phone,
      company: editedContact.company,
      role: editedContact.role,
      description: editedContact.description || undefined,
      tags: editedContact.tags,
      avatar: editedContact.avatar,
      folderId: editedContact.folderId,
    }]);

    scanner.reset();
    setEditedContact(null);
    setTagInput("");
    setCameraActive(false);
    onOpenChange(false);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (!editedContact) return;
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !editedContact.tags.includes(newTag)) {
        setEditedContact({ ...editedContact, tags: [...editedContact.tags, newTag] });
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    if (!editedContact) return;
    setEditedContact({ ...editedContact, tags: editedContact.tags.filter((t) => t !== tagToRemove) });
  };

  const togglePresetTag = (preset: string) => {
    if (!editedContact) return;
    if (editedContact.tags.includes(preset)) {
      setEditedContact({ ...editedContact, tags: editedContact.tags.filter((t) => t !== preset) });
    } else {
      setEditedContact({ ...editedContact, tags: [...editedContact.tags, preset] });
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editedContact) return;
    if (!file.type.startsWith("image/")) return;
    const url = await uploadAvatar(file);
    if (url) {
      setEditedContact({ ...editedContact, avatar: url });
    }
  };


  const toggleGoogleContact = (index: number) => {
    const next = new Set(selectedGoogleContacts);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedGoogleContacts(next);
  };

  const toggleFileContact = (index: number) => {
    const next = new Set(selectedFileContacts);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedFileContacts(next);
  };


  const selectAllGoogle = () => {
    setSelectedGoogleContacts(new Set(google.contacts.map((_, i) => i)));
  };

  const selectAllFile = () => {
    setSelectedFileContacts(new Set(fileImport.contacts.map((_, i) => i)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      fileImport.handleFile(file);
      setSelectedFileContacts(new Set());
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      fileImport.handleFile(file);
      setSelectedFileContacts(new Set());
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClearFile = () => {
    fileImport.clearContacts();
    setSelectedFileContacts(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleStartCamera = () => {
    scanner.reset();
    setCameraActive(true);
    setCameraInitializing(true);
  };

  const handleCapture = async () => {
    if (videoRef.current) {
      await scanner.captureAndScan(videoRef.current);
    }
    scanner.stopCamera();
    setCameraActive(false);
  };

  const handleScanFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await scanner.handleFileUpload(file);
    }
  };

  const handleScanReset = () => {
    scanner.reset();
    setEditedContact(null);
    setTagInput("");
    if (scanFileInputRef.current) {
      scanFileInputRef.current.value = "";
    }
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-x-hidden w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            Scan a business card, import from a file, or sync from your accounts
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 shrink-0 min-w-0">
            <TabsTrigger value="scan" className="flex items-center justify-center gap-1.5 min-w-0 sm:gap-2">
              <Camera className="h-4 w-4 shrink-0" />
              <span className="truncate">Scan</span>
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center justify-center gap-1.5 min-w-0 sm:gap-2">
              <FileUp className="h-4 w-4 shrink-0" />
              <span className="truncate">File</span>
            </TabsTrigger>
            <TabsTrigger value="google" className="flex items-center justify-center gap-1.5 min-w-0 sm:gap-2">
              <Chrome className="h-4 w-4 shrink-0" />
              <span className="truncate">Google</span>
            </TabsTrigger>
          </TabsList>

          {/* Scan Tab */}
          <TabsContent value="scan" className="flex-1 flex flex-col min-h-0 mt-4 data-[state=inactive]:hidden">
            {!scanner.scannedContact && !scanner.capturedImage ? (
              <div className="space-y-4">
                {cameraActive ? (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                      {cameraInitializing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
                            <p className="text-sm text-white/70">Starting camera...</p>
                          </div>
                        </div>
                      )}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border-2 border-dashed border-white/50 m-4 rounded-lg pointer-events-none" />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          scanner.stopCamera();
                          setCameraActive(false);
                          setCameraInitializing(false);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCapture} disabled={cameraInitializing} className="flex-1 gap-2">
                        <Camera className="h-4 w-4" />
                        Capture
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4 w-full min-w-0">
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm sm:max-w-none sm:w-auto px-1">
                      <Button onClick={handleStartCamera} size="lg" className="gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
                        <Camera className="h-4 w-4 shrink-0" />
                        Use Camera
                      </Button>
                      <Button
                        onClick={() => scanFileInputRef.current?.click()}
                        variant="outline"
                        size="lg"
                        className="gap-2 w-full sm:w-auto sm:flex-1 min-w-0"
                      >
                        <Upload className="h-4 w-4 shrink-0" />
                        Upload Image
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Take a photo or upload an image of a business card
                    </p>
                    <input
                      ref={scanFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleScanFileUpload}
                      className="hidden"
                    />
                  </div>
                )}
                {scanner.error && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {scanner.error}
                    </div>
                    {isSessionExpiredError && (
                      <Button onClick={handleSignInAgain} size="sm" variant="default">
                        Sign in again
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : scanner.isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Analyzing business card...</p>
              </div>
            ) : scanner.scannedContact && editedContact ? (
              <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Avatar className="h-16 w-16 border-2 border-border">
                        <AvatarImage src={editedContact.avatar} alt={editedContact.name || "Avatar"} />
                        <AvatarFallback className="text-sm bg-muted">
                          {editedContact.name ? editedContact.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        {avatarUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Camera className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                      disabled={avatarUploading}
                    />
                    <span className="text-xs text-muted-foreground">Click to add photo</span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="scan-name">Name *</Label>
                      <Input
                        id="scan-name"
                        value={editedContact.name}
                        onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="scan-email">Email</Label>
                        <Input
                          id="scan-email"
                          type="email"
                          value={editedContact.email}
                          onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="scan-phone">Phone</Label>
                        <Input
                          id="scan-phone"
                          value={editedContact.phone}
                          onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                          placeholder="+1 555-1234"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="scan-company">Company</Label>
                        <Input
                          id="scan-company"
                          value={editedContact.company}
                          onChange={(e) => setEditedContact({ ...editedContact, company: e.target.value })}
                          placeholder="Company name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="scan-role">Role</Label>
                        <Input
                          id="scan-role"
                          value={editedContact.role}
                          onChange={(e) => setEditedContact({ ...editedContact, role: e.target.value })}
                          placeholder="Job title"
                        />
                      </div>
                    </div>

                    {/* Folder Selector */}
                    {folders.length > 0 && (
                      <div className="space-y-1.5">
                        <Label htmlFor="scan-folder">Folder</Label>
                        <Select 
                          value={editedContact.folderId || "none"} 
                          onValueChange={(val) => setEditedContact({ ...editedContact, folderId: val === "none" ? undefined : val })}
                        >
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

                    {/* Keywords */}
                    <div className="space-y-1.5">
                      <Label htmlFor="scan-tags">Keywords</Label>
                      {presetKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {presetKeywords.map((preset) => {
                            const isSelected = editedContact.tags.includes(preset);
                            return (
                              <Badge
                                key={preset}
                                variant={isSelected ? "default" : "outline"}
                                className={`cursor-pointer transition-colors text-xs ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent hover:text-accent-foreground"
                                }`}
                                onClick={() => togglePresetTag(preset)}
                              >
                                {isSelected && <Check className="h-2.5 w-2.5 mr-1" />}
                                {preset}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <Input
                        id="scan-tags"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="Type custom keywords..."
                      />
                      {editedContact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {editedContact.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                              onClick={() => removeTag(tag)}
                            >
                              {tag}
                              <X className="h-2.5 w-2.5 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <Label htmlFor="scan-description">Description</Label>
                      <Textarea
                        id="scan-description"
                        value={editedContact.description}
                        onChange={(e) => setEditedContact({ ...editedContact, description: e.target.value })}
                        placeholder="What do they handle? (e.g. Handles all marketing campaigns)"
                        rows={2}
                      />
                    </div>
                  </div>
                  {scanner.error && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {scanner.error}
                      </div>
                      {isSessionExpiredError && (
                        <Button onClick={handleSignInAgain} size="sm" variant="default">
                          Sign in again
                        </Button>
                      )}
                    </div>
                  )}
                  </div>
                  <div className="shrink-0 flex gap-2 pt-4 mt-2 border-t">
                    <Button onClick={handleScanReset} variant="outline" className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Scan Another
                    </Button>
                    <Button
                      onClick={handleScannedImport}
                      disabled={!editedContact.name}
                      className="flex-1 gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Add Contact
                    </Button>
                  </div>
              </div>
            ) : scanner.capturedImage && scanner.error ? (
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden bg-muted">
                  <img
                    src={scanner.capturedImage}
                    alt="Captured image"
                    className="w-full h-40 object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {scanner.error}
                  </div>
                  {isSessionExpiredError ? (
                    <Button onClick={handleSignInAgain} className="w-full">
                      Sign in again
                    </Button>
                  ) : (
                    <Button onClick={handleScanReset} variant="outline" className="w-full gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* File Tab */}
          <TabsContent value="file" className="flex-1 flex flex-col min-h-0 data-[state=inactive]:hidden">
            {fileImport.contacts.length === 0 ? (
              <div className="space-y-4">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    flex flex-col items-center justify-center py-12 px-6
                    border-2 border-dashed rounded-lg cursor-pointer
                    transition-colors duration-200
                    ${isDragging 
                      ? "border-primary bg-primary/5" 
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                    }
                  `}
                >
                  {fileImport.isLoading ? (
                    <>
                      <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mb-4" />
                      <p className="text-sm text-muted-foreground">Parsing file...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium">Drop a file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supports vCard (.vcf), CSV (.csv), and PDF (.pdf)
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vcf,.vcard,.csv,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {fileImport.error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {fileImport.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 gap-4">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileUp className="h-4 w-4" />
                    <span className="truncate max-w-[150px]">{fileImport.fileName}</span>
                    <span>• {fileImport.contacts.length} contacts</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleClearFile}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={selectAllFile}>
                      Select All
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto rounded-md border">
                  <div className="p-4 space-y-2">
                    {fileImport.contacts.map((contact, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedFileContacts.has(i)}
                          onCheckedChange={() => toggleFileContact(i)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{contact.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.email || contact.phone || contact.company || "No details"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {selectedFileContacts.size} selected
                  </span>
                  <Button
                    onClick={handleFileImport}
                    disabled={selectedFileContacts.size === 0}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Import Selected
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>


          {/* Google Tab */}
          <TabsContent value="google" className="flex-1 flex flex-col min-h-0 data-[state=inactive]:hidden">
            {!google.isConfigured ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Google OAuth is not configured.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Add VITE_GOOGLE_CLIENT_ID to enable Google Contacts import.
                </p>
              </div>
            ) : !google.isAuthenticated ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Button
                  onClick={google.signIn}
                  disabled={google.isLoading}
                  size="lg"
                  className="gap-2"
                >
                  {google.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Chrome className="h-4 w-4" />
                  )}
                  Sign in with Google
                </Button>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  We'll only access your contacts. No emails or other data.
                </p>
              </div>
            ) : google.isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 w-full max-w-sm mx-auto">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-3">Syncing contacts from Google…</p>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full w-1/3 rounded-full bg-primary animate-sync-indeterminate"
                    aria-hidden
                  />
                </div>
              </div>
            ) : google.contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No contacts found in your Google account.
                </p>
                <Button variant="ghost" size="sm" onClick={google.signOut} className="mt-4">
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 gap-4">
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-sm text-muted-foreground">
                    {google.contacts.length} contacts found
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={google.signOut}>
                      Sign out
                    </Button>
                    <Button variant="ghost" size="sm" onClick={selectAllGoogle}>
                      Select All
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto rounded-md border">
                  <div className="p-4 space-y-2">
                    {google.contacts.map((contact, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedGoogleContacts.has(i)}
                          onCheckedChange={() => toggleGoogleContact(i)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{contact.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.email || contact.phone || contact.company || "No details"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {selectedGoogleContacts.size} selected
                  </span>
                  <Button
                    onClick={handleGoogleImport}
                    disabled={selectedGoogleContacts.size === 0}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Import Selected
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
