import { useState, useRef } from "react";
import { FileUp, Loader2, AlertCircle, Check, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Load pdfjs-dist from CDN using unpkg (more reliable)
// Using a stable version that's known to work
const PDFJS_VERSION = "3.11.174";

// Type definition for PDF.js loaded from CDN
interface PDFJSLib {
  getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<any> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
}

// Load PDF.js library from CDN
async function loadPDFJS(): Promise<PDFJSLib> {
  if (typeof window === "undefined") {
    throw new Error("Window is not available");
  }
  
  // Check if already loaded
  const globalWindow = window as any;
  if (globalWindow.pdfjsLib && globalWindow.pdfjsLib.getDocument) {
    return globalWindow.pdfjsLib;
  }
  
  try {
    // Use unpkg (more reliable for npm packages)
    const unpkgUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.js`;
    const workerUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
    
    console.log('[AdminPdfImport] Loading PDF.js from:', unpkgUrl);
    
    // Load the main PDF.js library
    const script = document.createElement("script");
    script.src = unpkgUrl;
    script.async = true;
    script.crossOrigin = "anonymous";
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("PDF.js script load timeout"));
      }, 30000); // 30 second timeout
      
      script.onload = () => {
        clearTimeout(timeout);
        console.log('[AdminPdfImport] PDF.js script loaded, checking for pdfjsLib...');
        
        // PDF.js from CDN exposes itself as pdfjsLib globally
        // Check multiple possible global names
        const pdfjsLib = globalWindow.pdfjsLib || globalWindow.pdfjs || (window as any).pdfjs;
        
        if (pdfjsLib && pdfjsLib.getDocument) {
          console.log('[AdminPdfImport] PDF.js library found, configuring worker...');
          // Configure worker
          if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
          }
          resolve();
        } else {
          console.error('[AdminPdfImport] PDF.js loaded but pdfjsLib not found. Available globals:', Object.keys(globalWindow).filter(k => k.toLowerCase().includes('pdf')));
          reject(new Error("PDF.js library loaded but pdfjsLib not found. Check console for available globals."));
        }
      };
      script.onerror = (error) => {
        clearTimeout(timeout);
        console.error('[AdminPdfImport] Failed to load PDF.js script:', error);
        reject(new Error(`Failed to load PDF.js script from ${unpkgUrl}. Check network tab for errors.`));
      };
      
      document.head.appendChild(script);
    });
    
    const pdfjsLib = globalWindow.pdfjsLib || globalWindow.pdfjs || (window as any).pdfjs;
    if (!pdfjsLib || !pdfjsLib.getDocument) {
      throw new Error("PDF.js library not available after loading");
    }
    
    return pdfjsLib;
  } catch (error) {
    console.error("Failed to load PDF.js from CDN:", error);
    throw error;
  }
}

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
  const [debugText, setDebugText] = useState<string | null>(null);

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
    setDebugText(null);
    setFileName(file.name);
    setParsedContacts([]);
    setSelectedContacts(new Set());

    try {
      let extractedText: string | null = null;

      // For PDFs, extract text client-side using pdfjs-dist (CDN)
      if (file.type === 'application/pdf') {
        try {
          console.log('[AdminPdfImport] Loading PDF.js from CDN...');
          
          // Load PDF.js library from CDN
          const pdfjsLib = await loadPDFJS();
          if (!pdfjsLib) {
            throw new Error('Failed to load PDF.js library');
          }
          
          console.log('[AdminPdfImport] Extracting text from PDF using pdfjs-dist...');
          
          // Load PDF from file
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          console.log(`[AdminPdfImport] PDF loaded: ${pdf.numPages} page(s)`);
          
          // Extract text from all pages, preserving structure for tables
          const textParts: string[] = [];
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            console.log(`[AdminPdfImport] Page ${pageNum} text items:`, textContent.items.length);
            
            // Fallback: Simple text extraction if structured extraction fails
            if (textContent.items.length === 0) {
              console.warn(`[AdminPdfImport] Page ${pageNum} has no text items - might be image-based`);
              continue;
            }
            
            // Group text items by their Y position to preserve line structure
            // This is important for table detection
            const items = textContent.items as Array<{
              str: string;
              transform: number[];
              hasEOL?: boolean;
              width?: number;
              height?: number;
            }>;
            
            // Sort items by Y position (top to bottom), then X position (left to right)
            // Note: PDF coordinates have Y=0 at bottom, so we need to invert
            const sortedItems = items
              .filter(item => item.str && item.str.trim())
              .map(item => {
                // Transform array: [a, b, c, d, e, f] where:
                // e = x translation, f = y translation
                // For PDF coordinates, higher Y is higher on page
                const transform = item.transform || [];
                return {
                  text: item.str.trim(),
                  y: transform[5] || 0, // Y coordinate (higher = top of page)
                  x: transform[4] || 0,  // X coordinate (left to right)
                  hasEOL: item.hasEOL || false,
                  width: item.width || 0,
                };
              })
              .sort((a, b) => {
                // First sort by Y (top to bottom) - higher Y first
                const yTolerance = 3; // Items within 3px are on same line
                const yDiff = Math.abs(a.y - b.y);
                
                if (yDiff > yTolerance) {
                  return b.y - a.y; // Higher Y values first (top of page)
                }
                // Same line (within tolerance), sort by X (left to right)
                return a.x - b.x;
              });
            
            console.log(`[AdminPdfImport] Page ${pageNum} sorted items:`, sortedItems.length);
            
            // Detect column boundaries for multi-column layouts
            // Group items by Y position first to analyze column structure
            const itemsByLine = new Map<number, Array<{text: string; x: number; width?: number}>>();
            for (const item of sortedItems) {
              const yTolerance = 3;
              let lineY: number | null = null;
              
              // Find existing line within tolerance
              for (const y of itemsByLine.keys()) {
                if (Math.abs(item.y - y) <= yTolerance) {
                  lineY = y;
                  break;
                }
              }
              
              if (lineY === null) {
                lineY = item.y;
              }
              
              if (!itemsByLine.has(lineY)) {
                itemsByLine.set(lineY, []);
              }
              itemsByLine.get(lineY)!.push({text: item.text, x: item.x, width: item.width});
            }
            
            // Analyze column boundaries across multiple lines
            const columnBoundaries: number[] = [];
            const sampleLines = Array.from(itemsByLine.values()).slice(0, 20);
            const columnStarts = new Map<number, number>();
            
            for (const lineItems of sampleLines) {
              lineItems.sort((a, b) => a.x - b.x);
              for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                const prevItem = lineItems[i - 1];
                
                if (prevItem) {
                  const gap = item.x - (prevItem.x + (prevItem.width || prevItem.text.length * 5));
                  // Large gaps indicate column boundaries (more than 2 average character widths)
                  if (gap > 20) {
                    const boundary = Math.round((prevItem.x + (prevItem.width || prevItem.text.length * 5) + item.x) / 2);
                    columnStarts.set(boundary, (columnStarts.get(boundary) || 0) + 1);
                  }
                }
              }
            }
            
            // Find boundaries that appear in at least 30% of lines
            const threshold = Math.ceil(sampleLines.length * 0.3);
            for (const [boundary, count] of columnStarts.entries()) {
              if (count >= threshold) {
                columnBoundaries.push(boundary);
              }
            }
            columnBoundaries.sort((a, b) => a - b);
            
            // Build text lines, grouping items on the same Y level
            // Handle case where each character is extracted separately
            const lines: string[] = [];
            let currentLine: Array<{text: string; x: number; width?: number}> = [];
            let currentY: number | null = null;
            
            for (const item of sortedItems) {
              const yTolerance = 3; // Consider items within 3px as same line
              
              if (currentY === null || Math.abs(item.y - currentY) > yTolerance) {
                // New line - save previous line
                if (currentLine.length > 0) {
                  // Sort current line by X position
                  currentLine.sort((a, b) => a.x - b.x);
                  
                  // For multi-column layouts, preserve column separation
                  let lineText = '';
                  let lastColumnEnd = 0;
                  
                  for (let i = 0; i < currentLine.length; i++) {
                    const currentItem = currentLine[i];
                    const nextItem = currentLine[i + 1];
                    
                    // Check if we've crossed a column boundary
                    if (columnBoundaries.length > 0) {
                      const itemEnd = currentItem.x + (currentItem.width || currentItem.text.length * 5);
                      const crossedBoundary = columnBoundaries.some(boundary => 
                        currentItem.x > boundary && lastColumnEnd < boundary
                      );
                      
                      if (crossedBoundary && lineText.length > 0) {
                        // Add extra space for column separation (2+ spaces for table detection)
                        lineText += '  ';
                      }
                      lastColumnEnd = itemEnd;
                    }
                    
                    lineText += currentItem.text;
                    
                    // Add space only if next item is far enough away (likely a new word)
                    if (nextItem) {
                      const gap = nextItem.x - (currentItem.x + (currentItem.width || currentItem.text.length * 5));
                      // If gap is more than ~3 characters wide (rough estimate), add space
                      if (gap > 10) {
                        // For large gaps, use multiple spaces if it might be a column boundary
                        if (gap > 20 && columnBoundaries.length > 0) {
                          lineText += '  '; // 2 spaces for column separation
                        } else {
                          lineText += ' ';
                        }
                      } else {
                        // Items are close together, but check if we need space for word boundaries
                        // Add space if: lowercase letter followed by uppercase (word boundary)
                        const currentEnd = currentItem.text[currentItem.text.length - 1];
                        const nextStart = nextItem.text[0];
                        if (currentEnd && nextStart && 
                            /[a-z0-9]/.test(currentEnd) && /[A-Z]/.test(nextStart)) {
                          lineText += ' ';
                        }
                      }
                    }
                  }
                  
                  // Post-process: Fix common concatenation issues
                  // Add space before capital letters after lowercase (e.g., "RaynardHoward" -> "Raynard Howard")
                  lineText = lineText.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
                  // Add space around colons and parentheses if missing
                  lineText = lineText.replace(/([a-zA-Z])([:(])/g, '$1 $2');
                  lineText = lineText.replace(/([:(])([a-zA-Z])/g, '$1 $2');
                  
                  const trimmed = lineText.trim();
                  if (trimmed) {
                    lines.push(trimmed);
                  }
                }
                currentLine = [{text: item.text, x: item.x, width: item.width}];
                currentY = item.y;
              } else {
                // Same line, add to current line
                currentLine.push({text: item.text, x: item.x, width: item.width});
              }
            }
            
            // Add last line
            if (currentLine.length > 0) {
              currentLine.sort((a, b) => a.x - b.x);
              
              // Join items intelligently with column awareness
              let lineText = '';
              let lastColumnEnd = 0;
              
              for (let i = 0; i < currentLine.length; i++) {
                const currentItem = currentLine[i];
                const nextItem = currentLine[i + 1];
                
                // Check if we've crossed a column boundary
                if (columnBoundaries.length > 0) {
                  const itemEnd = currentItem.x + (currentItem.width || currentItem.text.length * 5);
                  const crossedBoundary = columnBoundaries.some(boundary => 
                    currentItem.x > boundary && lastColumnEnd < boundary
                  );
                  
                  if (crossedBoundary && lineText.length > 0) {
                    // Add extra space for column separation (2+ spaces for table detection)
                    lineText += '  ';
                  }
                  lastColumnEnd = itemEnd;
                }
                
                lineText += currentItem.text;
                
                if (nextItem) {
                  const gap = nextItem.x - (currentItem.x + (currentItem.width || currentItem.text.length * 5));
                  if (gap > 10) {
                    // For large gaps, use multiple spaces if it might be a column boundary
                    if (gap > 20 && columnBoundaries.length > 0) {
                      lineText += '  '; // 2 spaces for column separation
                    } else {
                      lineText += ' ';
                    }
                  } else {
                    // Items are close together, but check if we need space for word boundaries
                    const currentEnd = currentItem.text[currentItem.text.length - 1];
                    const nextStart = nextItem.text[0];
                    if (currentEnd && nextStart && 
                        /[a-z0-9]/.test(currentEnd) && /[A-Z]/.test(nextStart)) {
                      lineText += ' ';
                    }
                  }
                }
              }
              
              // Post-process: Fix common concatenation issues
              lineText = lineText.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
              lineText = lineText.replace(/([a-zA-Z])([:(])/g, '$1 $2');
              lineText = lineText.replace(/([:(])([a-zA-Z])/g, '$1 $2');
              
              const trimmed = lineText.trim();
              if (trimmed) {
                lines.push(trimmed);
              }
            }
            
            let pageText = lines.join('\n');
            
            // If structured extraction produced very little text, try simple extraction
            if (pageText.length < 50 && textContent.items.length > 10) {
              console.warn(`[AdminPdfImport] Page ${pageNum} structured extraction produced little text, trying simple extraction...`);
              // Simple extraction: just join all text items
              const simpleText = textContent.items
                .map((item: any) => item.str || '')
                .filter((str: string) => str.trim())
                .join(' ');
              if (simpleText.length > pageText.length) {
                pageText = simpleText;
                console.log(`[AdminPdfImport] Page ${pageNum} simple extraction produced ${simpleText.length} characters`);
              }
            }
            
            if (pageText) {
              textParts.push(pageText);
            }
            
            console.log(`[AdminPdfImport] Page ${pageNum}: extracted ${pageText.length} characters, ${lines.length} lines`);
            if (lines.length > 0 && lines.length <= 20) {
              console.log(`[AdminPdfImport] Page ${pageNum} all lines:`, lines);
            } else if (lines.length > 0) {
              console.log(`[AdminPdfImport] Page ${pageNum} first 10 lines:`, lines.slice(0, 10));
            }
          }
          
          extractedText = textParts.join('\n\n'); // Separate pages with double newline
          
          console.log(`[AdminPdfImport] Total extracted text: ${extractedText.length} characters`);
          console.log(`[AdminPdfImport] Text preview (first 1000 chars):`, extractedText.substring(0, 1000));
          
          // Count emails and phones found
          const emailCount = (extractedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || []).length;
          const phoneCount = (extractedText.match(/(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g) || []).length;
          console.log(`[AdminPdfImport] Found ${emailCount} emails and ${phoneCount} phones in extracted text`);
          
          if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('No text could be extracted from the PDF. The PDF might be image-based (scanned).');
          }
        } catch (pdfError) {
          console.error('[AdminPdfImport] PDF text extraction error:', pdfError);
          const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error';
          setError(`Failed to extract text from PDF: ${errorMessage}. The PDF might be image-based or corrupted.`);
          setIsLoading(false);
          return;
        }
      } else {
        // For images, we still need OCR (not implemented here, would need PaddleOCR)
        throw new Error('Image files require OCR. Please use a PDF with readable text, or use the business card scanner for single images.');
      }

      // Call edge function with extracted text
      console.log('[AdminPdfImport] Sending extracted text to edge function, length:', extractedText.length);
      console.log('[AdminPdfImport] Extracted text preview (first 500 chars):', extractedText.substring(0, 500));
      
      const { data, error: fnError } = await supabase.functions.invoke('parse-contact-pdf', {
        body: { 
          extractedText: extractedText,
          mimeType: file.type,
          debug: true // Request debug info
        }
      });

      if (fnError) {
        console.error('[AdminPdfImport] Edge function error:', fnError);
        throw new Error(fnError.message || 'Failed to parse document');
      }

      if (!data.success) {
        console.error('[AdminPdfImport] Edge function returned error:', data.error);
        // If we have extracted text, show it for debugging
        if (extractedText) {
          setDebugText(extractedText);
        }
        throw new Error(data.error || 'Failed to parse contacts');
      }
      
      console.log('[AdminPdfImport] Edge function returned:', {
        success: data.success,
        contactCount: data.contacts?.length || 0,
        hasDebug: !!data.debug
      });

      if (!data.contacts || data.contacts.length === 0) {
        // Check if debug info is available to show extracted text
        const debugInfo = data.debug;
        if (debugInfo?.extractedTextFull) {
          console.error('[AdminPdfImport] No contacts found. Extracted text:', debugInfo.extractedTextFull);
          console.error('[AdminPdfImport] Debug info:', {
            textLength: debugInfo.extractedTextLength,
            emailCount: debugInfo.emailCount,
            phoneCount: debugInfo.phoneCount,
            preview: debugInfo.extractedTextPreview?.substring(0, 500)
          });
          setDebugText(debugInfo.extractedTextFull);
          setError(`No contacts found in the document. Extracted ${debugInfo.extractedTextLength} characters (${debugInfo.emailCount} emails, ${debugInfo.phoneCount} phones found). See extracted text below.`);
        } else {
          console.error('[AdminPdfImport] No contacts found and no debug info available');
          setError('No contacts found in the document. Please ensure the document contains readable contact information.');
        }
        return;
      }

      // Clear debug text on successful parse
      setDebugText(null);

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
    setDebugText(null);
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
              <p className="text-sm text-muted-foreground">Extracting text from PDF...</p>
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
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {debugText && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">Extracted Text (for debugging):</p>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto bg-background p-2 rounded border">
                {debugText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
