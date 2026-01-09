import { useState, useEffect, useMemo } from "react";
import { Loader2, Merge, Trash2, AlertTriangle, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Contact } from "@/types/contact";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useContacts } from "@/hooks/useContacts";
import { findDuplicateContacts, calculateSimilarity } from "@/utils/duplicateDetection";
import { mergeContacts } from "@/utils/contactMerge";
import { formatPhoneNumber } from "@/utils/formatContact";
import { toast } from "sonner";

interface DuplicateGroup {
  contacts: Contact[];
  similarity: number;
}

interface DuplicateCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateCleanupDialog({
  open,
  onOpenChange,
}: DuplicateCleanupDialogProps) {
  const { contacts, mergeContact, deleteContact } = useContacts();
  const [isScanning, setIsScanning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Scan for duplicates when dialog opens
  useEffect(() => {
    if (open && contacts.length > 0) {
      scanForDuplicates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contacts]);

  const scanForDuplicates = () => {
    setIsScanning(true);
    setProcessedCount(0);

    try {
      // Group contacts by email or phone
      const emailMap = new Map<string, Contact[]>();
      const phoneMap = new Map<string, Contact[]>();
      const processed = new Set<string>();

      // Only check personal contacts (owner_id matches)
      const personalContacts = contacts.filter(c => !c.isShared);

      personalContacts.forEach((contact) => {
        // Group by normalized email
        if (contact.email) {
          const normalizedEmail = contact.email.trim().toLowerCase();
          if (!emailMap.has(normalizedEmail)) {
            emailMap.set(normalizedEmail, []);
          }
          emailMap.get(normalizedEmail)!.push(contact);
        }

        // Group by normalized phone
        if (contact.phone) {
          const normalizedPhone = contact.phone.replace(/\D/g, '');
          if (normalizedPhone) {
            if (!phoneMap.has(normalizedPhone)) {
              phoneMap.set(normalizedPhone, []);
            }
            phoneMap.get(normalizedPhone)!.push(contact);
          }
        }
      });

      // Find groups with duplicates (2+ contacts)
      const groups: DuplicateGroup[] = [];
      const seenContacts = new Set<string>();

      // Process email groups
      emailMap.forEach((groupContacts, email) => {
        if (groupContacts.length > 1) {
          const unprocessed = groupContacts.filter(c => !seenContacts.has(c.id));
          if (unprocessed.length > 1) {
            unprocessed.forEach(c => seenContacts.add(c.id));
            const similarity = calculateSimilarity(unprocessed[0], unprocessed[1]);
            groups.push({ contacts: unprocessed, similarity });
          }
        }
      });

      // Process phone groups
      phoneMap.forEach((groupContacts, phone) => {
        if (groupContacts.length > 1) {
          const unprocessed = groupContacts.filter(c => !seenContacts.has(c.id));
          if (unprocessed.length > 1) {
            unprocessed.forEach(c => seenContacts.add(c.id));
            const similarity = calculateSimilarity(unprocessed[0], unprocessed[1]);
            groups.push({ contacts: unprocessed, similarity });
          }
        }
      });

      // Sort by similarity (highest first)
      groups.sort((a, b) => b.similarity - a.similarity);

      setDuplicateGroups(groups);
      setProcessedCount(groups.length);
    } catch (error) {
      console.error("Error scanning for duplicates:", error);
      toast.error("Failed to scan for duplicates");
    } finally {
      setIsScanning(false);
    }
  };

  const toggleGroup = (index: number) => {
    setSelectedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedGroups(new Set(duplicateGroups.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedGroups(new Set());
  };

  const handleMergeSelected = () => {
    if (selectedGroups.size === 0) {
      toast.error("Please select at least one group to merge");
      return;
    }

    setIsProcessing(true);
    
    // Collect all merge operations
    const mergeOperations: Array<{ primary: Contact; duplicate: Contact; groupIndex: number }> = [];
    
    Array.from(selectedGroups).forEach((groupIndex) => {
      const group = duplicateGroups[groupIndex];
      if (group.contacts.length < 2) return;

      // Sort by created_at to use oldest as primary
      const sorted = [...group.contacts].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
        return dateA - dateB;
      });

      const primary = sorted[0];
      // Merge all duplicates into primary
      for (let i = 1; i < sorted.length; i++) {
        mergeOperations.push({
          primary,
          duplicate: sorted[i],
          groupIndex,
        });
      }
    });

    if (mergeOperations.length === 0) {
      setIsProcessing(false);
      return;
    }

    let processedCount = 0;
    let currentIndex = 0;

    const processNext = () => {
      if (currentIndex >= mergeOperations.length) {
        toast.success(
          `Merged ${processedCount} duplicate${processedCount !== 1 ? "s" : ""}`
        );
        setIsProcessing(false);
        // Refresh the scan
        setTimeout(() => {
          scanForDuplicates();
          setSelectedGroups(new Set());
        }, 1000);
        return;
      }

      const { primary, duplicate } = mergeOperations[currentIndex];
      currentIndex++;

      // Merge duplicate into primary
      mergeContact(
        { primaryContact: primary, newContactData: duplicate },
        {
          onSuccess: () => {
            // Delete the duplicate after successful merge
            deleteContact(duplicate.id);
            processedCount++;
            // Process next after a short delay
            setTimeout(processNext, 300);
          },
          onError: (error) => {
            console.error("Merge error:", error);
            toast.error(`Failed to merge: ${error.message || "Unknown error"}`);
            setIsProcessing(false);
          },
        }
      );
    };

    processNext();
  };

  const handleDeleteSelected = async () => {
    if (selectedGroups.size === 0) {
      toast.error("Please select at least one group to delete");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedGroups.size} duplicate group(s)? This will delete all contacts in the selected groups.`)) {
      return;
    }

    setIsProcessing(true);
    let deletedCount = 0;

    try {
      for (const groupIndex of selectedGroups) {
        const group = duplicateGroups[groupIndex];
        for (const contact of group.contacts) {
          deleteContact(contact.id);
          deletedCount++;
        }
      }

      toast.success(`Deleted ${deletedCount} duplicate contact${deletedCount !== 1 ? "s" : ""}`);

      // Refresh the scan
      setTimeout(() => {
        scanForDuplicates();
        setSelectedGroups(new Set());
      }, 1000);
    } catch (error) {
      toast.error("Failed to delete duplicates");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalDuplicates = useMemo(() => {
    return duplicateGroups.reduce((sum, group) => sum + group.contacts.length - 1, 0);
  }, [duplicateGroups]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Contact Cleanup
          </DialogTitle>
          <DialogDescription>
            Find and merge or delete duplicate contacts in your contact book.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {isScanning ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mr-3" />
              <span className="text-muted-foreground">Scanning for duplicates...</span>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="text-center py-12">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No duplicates found!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your contact book is clean.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Found {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? "s" : ""} ({totalDuplicates} duplicate{totalDuplicates !== 1 ? "s" : ""})
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {duplicateGroups.map((group, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      selectedGroups.has(index)
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedGroups.has(index)}
                        onCheckedChange={() => toggleGroup(index)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {group.contacts.length} duplicate{group.contacts.length !== 1 ? "s" : ""}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(group.similarity * 100)}% similar
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {group.contacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-start gap-3 p-2 rounded border border-border/50 bg-muted/30"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.avatar} />
                                <AvatarFallback className="text-xs">
                                  {contact.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{contact.name}</p>
                                {contact.email && (
                                  <p className="text-xs text-muted-foreground">{contact.email}</p>
                                )}
                                {contact.phone && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatPhoneNumber(contact.phone)}
                                  </p>
                                )}
                                {contact.company && (
                                  <p className="text-xs text-muted-foreground">{contact.company}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {duplicateGroups.length > 0 && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              variant="outline"
              onClick={handleDeleteSelected}
              disabled={isProcessing || selectedGroups.size === 0}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </>
              )}
            </Button>
            <Button
              onClick={handleMergeSelected}
              disabled={isProcessing || selectedGroups.size === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4 mr-2" />
                  Merge Selected
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

