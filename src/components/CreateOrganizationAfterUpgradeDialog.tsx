import { useState } from "react";
import { Building2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateOrganizationAfterUpgradeDialogProps {
  open: boolean;
  onCreateCompany: (name: string) => void;
  onDismiss: () => void;
  isCreating?: boolean;
}

export function CreateOrganizationAfterUpgradeDialog({
  open,
  onCreateCompany,
  onDismiss,
  isCreating = false,
}: CreateOrganizationAfterUpgradeDialogProps) {
  const [companyName, setCompanyName] = useState("");

  const handleCreate = () => {
    const trimmed = companyName.trim();
    if (!trimmed) return;
    onCreateCompany(trimmed);
    setCompanyName("");
  };

  const handleLater = () => {
    onDismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleLater()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Sparkles className="h-6 w-6" />
            <DialogTitle className="text-xl">You're upgraded!</DialogTitle>
          </div>
          <DialogDescription>
            Create your organization to collaborate with your team, share contacts, and invite members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              placeholder="Acme Inc"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleCreate}
              disabled={!companyName.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Create organization
                </span>
              )}
            </Button>
            <Button variant="ghost" onClick={handleLater} disabled={isCreating} className="w-full">
              I'll do this later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
