import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Folder, DirectoryType } from "@/types/folder";
import { Building2, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
];

interface FolderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (folder: Omit<Folder, "id" | "createdAt">) => void;
  folder?: Folder | null;
  directoryType?: DirectoryType;
  existingNames?: string[];
  isAdmin?: boolean;
  hasCompany?: boolean;
}

export function FolderFormDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  folder,
  directoryType = "contacts",
  existingNames = [],
  isAdmin = false,
  hasCompany = false,
}: FolderFormDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isOrganizationFolder, setIsOrganizationFolder] = useState(false);

  const isEditing = !!folder;

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(folder.color);
      setIsOrganizationFolder(folder.isOrganizationFolder || false);
    } else {
      setName("");
      setColor(PRESET_COLORS[0]);
      setIsOrganizationFolder(false);
    }
    setError(null);
  }, [folder, open]);

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Folder name is required");
      return false;
    }
    
    // Check for duplicate name (case-insensitive), excluding current folder when editing
    const isDuplicate = existingNames.some(
      (existingName) => 
        existingName.toLowerCase() === trimmed.toLowerCase() &&
        (!isEditing || existingName.toLowerCase() !== folder?.name.toLowerCase())
    );
    
    if (isDuplicate) {
      setError("A folder with this name already exists");
      return false;
    }
    
    setError(null);
    return true;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (error) {
      validateName(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateName(name)) return;

    onSave({ 
      name: name.trim(), 
      color,
      directoryType: folder?.directoryType || directoryType,
      isOrganizationFolder: isOrganizationFolder,
    });
    onOpenChange(false);
  };

  const getTitle = () => {
    const directoryLabel = directoryType === "clients" 
      ? "Client" 
      : directoryType === "team" 
        ? "Team" 
        : "";
    return isEditing 
      ? `Edit ${directoryLabel} Folder`.trim() 
      : `New ${directoryLabel} Folder`.trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {getTitle()}
          </DialogTitle>
          {isAdmin && hasCompany && (
            <DialogDescription>
              Create a {isOrganizationFolder ? "shared organization" : "personal"} folder
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Work, Personal, Family..."
              autoFocus
              className={error ? "border-destructive" : ""}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Organization Folder Toggle - Only show for admins with company */}
          {isAdmin && hasCompany && (
            <div className="space-y-2 pb-2 border-b">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="organization-folder"
                  checked={isOrganizationFolder}
                  onCheckedChange={(checked) => setIsOrganizationFolder(checked === true)}
                />
                <Label 
                  htmlFor="organization-folder" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  Organization Folder
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Organization folders are visible to all members of your company. Only admins can create, edit, or delete organization folders.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
              </div>
              {isOrganizationFolder && (
                <p className="text-xs text-muted-foreground pl-6">
                  This folder will be shared with all members of your organization
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-8 w-8 rounded-full transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
