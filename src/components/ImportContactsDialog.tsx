import { useState, useRef, useEffect } from "react";
import { Smartphone, Chrome, Check, AlertCircle, Loader2, FileUp, Upload, X, Camera, RotateCcw } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePhoneContacts } from "@/hooks/usePhoneContacts";
import { useGoogleContacts } from "@/hooks/useGoogleContacts";
import { useFileContacts } from "@/hooks/useFileContacts";
import { useBusinessCardScanner } from "@/hooks/useBusinessCardScanner";
import { Contact } from "@/types/contact";

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contacts: Omit<Contact, "id">[]) => void;
  defaultTab?: string;
}

export function ImportContactsDialog({
  open,
  onOpenChange,
  onImport,
  defaultTab,
}: ImportContactsDialogProps) {
  const [selectedPhoneContacts, setSelectedPhoneContacts] = useState<Set<number>>(new Set());
  const [selectedGoogleContacts, setSelectedGoogleContacts] = useState<Set<number>>(new Set());
  const [selectedFileContacts, setSelectedFileContacts] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab || "scan");
  const [cameraActive, setCameraActive] = useState(false);
  const [editedContact, setEditedContact] = useState<{
    name: string;
    email: string;
    phone: string;
    company: string;
    role: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const phone = usePhoneContacts();
  const google = useGoogleContacts();
  const fileImport = useFileContacts();
  const scanner = useBusinessCardScanner();

  // Update edited contact when scanned contact changes
  useEffect(() => {
    if (scanner.scannedContact) {
      setEditedContact({ ...scanner.scannedContact });
    }
  }, [scanner.scannedContact]);

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
    }
  }, [open, activeTab, scanner.stopCamera]);

  const handlePhoneImport = () => {
    const contactsToImport: Omit<Contact, "id">[] = phone.contacts
      .filter((_, i) => selectedPhoneContacts.has(i))
      .map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: "",
        role: "",
        tags: ["imported-phone"],
      }));
    
    onImport(contactsToImport);
    phone.clearContacts();
    setSelectedPhoneContacts(new Set());
    onOpenChange(false);
  };

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
      .map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        role: c.role,
        tags: ["imported-file"],
      }));
    
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
      tags: ["scanned-card"],
    }]);

    scanner.reset();
    setEditedContact(null);
    setCameraActive(false);
    onOpenChange(false);
  };

  const togglePhoneContact = (index: number) => {
    const next = new Set(selectedPhoneContacts);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedPhoneContacts(next);
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

  const selectAllPhone = () => {
    setSelectedPhoneContacts(new Set(phone.contacts.map((_, i) => i)));
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

  const handleStartCamera = async () => {
    if (videoRef.current) {
      await scanner.startCamera(videoRef.current);
      setCameraActive(true);
    }
  };

  const handleCapture = async () => {
    await scanner.captureAndScan();
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
    if (scanFileInputRef.current) {
      scanFileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            Scan a business card, import from a file, or sync from your accounts
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="scan" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Scan
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              File
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Phone
            </TabsTrigger>
            <TabsTrigger value="google" className="flex items-center gap-2">
              <Chrome className="h-4 w-4" />
              Google
            </TabsTrigger>
          </TabsList>

          {/* Scan Tab */}
          <TabsContent value="scan" className="space-y-4">
            {!scanner.scannedContact && !scanner.capturedImage ? (
              <div className="space-y-4">
                {cameraActive ? (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
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
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCapture} className="flex-1 gap-2">
                        <Camera className="h-4 w-4" />
                        Capture
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <div className="flex gap-3">
                      <Button onClick={handleStartCamera} size="lg" className="gap-2">
                        <Camera className="h-4 w-4" />
                        Use Camera
                      </Button>
                      <Button
                        onClick={() => scanFileInputRef.current?.click()}
                        variant="outline"
                        size="lg"
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
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
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {scanner.error}
                  </div>
                )}
              </div>
            ) : scanner.isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Analyzing business card...</p>
              </div>
            ) : scanner.scannedContact && editedContact ? (
              <div className="space-y-4">
                {scanner.capturedImage && (
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <img
                      src={scanner.capturedImage}
                      alt="Captured business card"
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="scan-name">Name</Label>
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
                </div>
                {scanner.error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {scanner.error}
                  </div>
                )}
                <div className="flex gap-2">
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
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {scanner.error}
                </div>
                <Button onClick={handleScanReset} variant="outline" className="w-full gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : null}
          </TabsContent>

          {/* File Tab */}
          <TabsContent value="file" className="space-y-4">
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
                        Supports vCard (.vcf) and CSV (.csv)
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vcf,.vcard,.csv"
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
              <>
                <div className="flex items-center justify-between">
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
                <ScrollArea className="h-64 rounded-md border">
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
                </ScrollArea>
                <div className="flex items-center justify-between">
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
              </>
            )}
          </TabsContent>

          {/* Phone Tab */}
          <TabsContent value="phone" className="space-y-4">
            {!phone.isSupported ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Contact Picker is only supported on Chrome for Android.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Try opening this app on your Android phone.
                </p>
              </div>
            ) : phone.contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Button
                  onClick={phone.pickContacts}
                  disabled={phone.isLoading}
                  size="lg"
                  className="gap-2"
                >
                  {phone.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Smartphone className="h-4 w-4" />
                  )}
                  Select Contacts from Phone
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {phone.contacts.length} contacts found
                  </span>
                  <Button variant="ghost" size="sm" onClick={selectAllPhone}>
                    Select All
                  </Button>
                </div>
                <ScrollArea className="h-64 rounded-md border">
                  <div className="p-4 space-y-2">
                    {phone.contacts.map((contact, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedPhoneContacts.has(i)}
                          onCheckedChange={() => togglePhoneContact(i)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{contact.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.email || contact.phone || "No details"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedPhoneContacts.size} selected
                  </span>
                  <Button
                    onClick={handlePhoneImport}
                    disabled={selectedPhoneContacts.size === 0}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Import Selected
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Google Tab */}
          <TabsContent value="google" className="space-y-4">
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
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Loading contacts...</p>
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
              <>
                <div className="flex items-center justify-between">
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
                <ScrollArea className="h-64 rounded-md border">
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
                </ScrollArea>
                <div className="flex items-center justify-between">
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
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
