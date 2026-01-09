import { useState } from "react";
import { AlertTriangle, Merge, X, Save, Loader2 } from "lucide-react";
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
import { previewMerge } from "@/utils/contactMerge";
import { formatPhoneNumber } from "@/utils/formatContact";

interface DuplicateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newContact: Omit<Contact, "id">;
  duplicateContacts: Contact[];
  onMerge: (primaryContact: Contact, newContactData: Omit<Contact, "id">) => void;
  onSaveAnyway: () => void;
  isMerging?: boolean;
}

export function DuplicateContactDialog({
  open,
  onOpenChange,
  newContact,
  duplicateContacts,
  onMerge,
  onSaveAnyway,
  isMerging = false,
}: DuplicateContactDialogProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<Contact | null>(
    duplicateContacts[0] || null
  );

  if (duplicateContacts.length === 0) {
    return null;
  }

  const primary = selectedPrimary || duplicateContacts[0];
  const preview = previewMerge(primary, newContact);

  const handleMerge = () => {
    if (primary) {
      onMerge(primary, newContact);
    }
  };

  const handleSaveAnyway = () => {
    onSaveAnyway();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Contact Detected
          </DialogTitle>
          <DialogDescription>
            We found {duplicateContacts.length} existing contact{duplicateContacts.length > 1 ? "s" : ""} that may be the same person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing Contact(s) */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Existing Contact{duplicateContacts.length > 1 ? "s" : ""}</h3>
            {duplicateContacts.length > 1 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {duplicateContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedPrimary(contact)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedPrimary?.id === contact.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.avatar} />
                        <AvatarFallback>
                          {contact.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contact.name}</p>
                          {selectedPrimary?.id === contact.id && (
                            <Badge variant="default" className="text-xs">Selected</Badge>
                          )}
                        </div>
                        {contact.email && (
                          <p className="text-sm text-muted-foreground">{contact.email}</p>
                        )}
                        {contact.phone && (
                          <p className="text-sm text-muted-foreground">
                            {formatPhoneNumber(contact.phone)}
                          </p>
                        )}
                        {contact.company && (
                          <p className="text-sm text-muted-foreground">{contact.company}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={primary.avatar} />
                    <AvatarFallback>
                      {primary.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{primary.name}</p>
                    {primary.email && (
                      <p className="text-sm text-muted-foreground">{primary.email}</p>
                    )}
                    {primary.phone && (
                      <p className="text-sm text-muted-foreground">
                        {formatPhoneNumber(primary.phone)}
                      </p>
                    )}
                    {primary.company && (
                      <p className="text-sm text-muted-foreground">{primary.company}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New Contact */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">New Contact</h3>
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={newContact.avatar} />
                  <AvatarFallback>
                    {newContact.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{newContact.name}</p>
                  {newContact.email && (
                    <p className="text-sm text-muted-foreground">{newContact.email}</p>
                  )}
                  {newContact.phone && (
                    <p className="text-sm text-muted-foreground">
                      {formatPhoneNumber(newContact.phone)}
                    </p>
                  )}
                  {newContact.company && (
                    <p className="text-sm text-muted-foreground">{newContact.company}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Merge Preview */}
          {(preview.willAdd.length > 0 || preview.willMerge.length > 0) && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
              <h4 className="text-sm font-medium mb-2">What will be merged:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {preview.willAdd.length > 0 && (
                  <li>
                    <span className="font-medium text-foreground">Will add:</span>{" "}
                    {preview.willAdd.join(", ")}
                  </li>
                )}
                {preview.willMerge.length > 0 && (
                  <li>
                    <span className="font-medium text-foreground">Will merge:</span>{" "}
                    {preview.willMerge.join(", ")}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveAnyway}
            disabled={isMerging}
            className="text-muted-foreground"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Anyway
          </Button>
          <Button onClick={handleMerge} disabled={isMerging || !primary}>
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="h-4 w-4 mr-2" />
                Merge with Existing
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

