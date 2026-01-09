import { useState, useRef } from "react";
import { FileUp, Loader2, AlertCircle, Check, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ParsedContact {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
}

interface AdminPdfImportProps {
  onImport: (contacts: Array<{
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
    tags?: string[];
  }>) => void;
}

export function AdminPdfImport({ onImport }: AdminPdfImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (file: File) => {
    if (!file) return;

    // Check file type - accept PDF and images
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or image file (PNG, JPG, WEBP)');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);
    setParsedContacts([]);
    setSelectedContacts(new Set());

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call edge function with base64
      const { data, error: fnError } = await supabase.functions.invoke('parse-contact-pdf', {
        body: { pdfBase64: base64, mimeType: file.type }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to parse document');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse contacts');
      }

      if (!data.contacts || data.contacts.length === 0) {
        setError('No contacts found in the document. Please ensure the document contains readable contact information.');
        return;
      }

      setParsedContacts(data.contacts);
      // Select all by default
      setSelectedContacts(new Set(data.contacts.map((_: ParsedContact, i: number) => i)));
      
      toast({
        title: "Document parsed",
        description: `Found ${data.contacts.length} contact${data.contacts.length === 1 ? '' : 's'}`,
      });

    } catch (err) {
      console.error('Error parsing document:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
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

  const toggleContact = (index: number) => {
    const next = new Set(selectedContacts);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedContacts(next);
  };

  const selectAll = () => {
    setSelectedContacts(new Set(parsedContacts.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedContacts(new Set());
  };

  const handleImport = () => {
    const contactsToImport = parsedContacts
      .filter((_, i) => selectedContacts.has(i))
      .map(c => ({
        name: c.name,
        email: c.email || undefined,
        phone: c.phone || undefined,
        company: c.company || undefined,
        role: c.role || undefined,
        tags: ['imported-pdf'],
      }));

    onImport(contactsToImport);
    
    // Reset state
    setParsedContacts([]);
    setSelectedContacts(new Set());
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    toast({
      title: "Contacts imported",
      description: `Successfully imported ${contactsToImport.length} contact${contactsToImport.length === 1 ? '' : 's'}`,
    });
  };

  const handleClear = () => {
    setParsedContacts([]);
    setSelectedContacts(new Set());
    setFileName(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">Bulk Contact Import</Label>
        <p className="text-sm text-muted-foreground">
          Upload a PDF or image containing contact information to import multiple contacts at once.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          💡 <strong>Tip:</strong> For contact sheets with many contacts (50+), exporting as CSV and using the File import tab will give better results.
        </p>
      </div>

      {parsedContacts.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border'
          } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Parsing document with AI...</p>
              {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
            </div>
          ) : (
            <>
              <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Drag & drop a PDF or image, or click to browse
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Select File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleInputChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supports PDF, PNG, JPG, WEBP (max 10MB)
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <div className="flex items-center justify-between p-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                {parsedContacts.length} contact{parsedContacts.length === 1 ? '' : 's'} found
              </span>
              {fileName && (
                <span className="text-xs text-muted-foreground">from {fileName}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-[200px]">
            <div className="divide-y">
              {parsedContacts.map((contact, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleContact(index)}
                >
                  <Checkbox
                    checked={selectedContacts.has(index)}
                    onCheckedChange={() => toggleContact(index)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{contact.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {contact.role && <span>{contact.role}</span>}
                      {contact.company && <span>@ {contact.company}</span>}
                      {contact.email && <span>{contact.email}</span>}
                      {contact.phone && <span>{contact.phone}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-3 border-t bg-muted/50">
            <Button
              onClick={handleImport}
              disabled={selectedContacts.size === 0}
              className="w-full"
            >
              Import {selectedContacts.size} Contact{selectedContacts.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
