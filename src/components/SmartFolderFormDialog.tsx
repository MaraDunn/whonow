import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { Folder, DirectoryType } from "@/types/folder";
import { Search } from "lucide-react";
import { parseSearchQueryToSchema } from "@/utils/searchQueryParser";
import type { SearchQueryFilters } from "@/types/searchQuery";
import { useContactVocabulary } from "@/hooks/useContactVocabulary";
import { correctTypos } from "@/utils/spellCheck";

const PRESET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

interface SmartFolderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (folder: Omit<Folder, "id" | "createdAt">) => void;
  folder?: Folder | null;
  directoryType?: DirectoryType;
  existingNames?: string[];
}

/** Build a minimal query string from filters for display (e.g. when editing). */
function filtersToQueryHint(filters: SearchQueryFilters | null | undefined): string {
  if (!filters || typeof filters !== "object") return "";
  const parts: string[] = [];
  if (filters.name?.trim()) parts.push(filters.name.trim());
  if (filters.company?.trim()) parts.push(filters.company.trim());
  if (filters.job_title?.trim()) parts.push(filters.job_title.trim());
  if (filters.location?.trim()) parts.push(filters.location.trim());
  if (filters.tags?.length) parts.push(filters.tags.join(", "));
  if (filters.relationship_type) parts.push(filters.relationship_type);
  return parts.join(" · ");
}

const SPELLCHECK_DEBOUNCE_MS = 400;

export function SmartFolderFormDialog({
  open,
  onOpenChange,
  onSave,
  folder,
  directoryType = "contacts",
  existingNames = [],
}: SmartFolderFormDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [dictionary, setDictionary] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { cities, companies, roles } = useContactVocabulary();

  useEffect(() => {
    import("an-array-of-english-words").then((mod) => setDictionary(mod.default));
  }, []);

  // Dictionary first (lowercase), then contact vocab (proper casing overrides)
  const allWords = useMemo(
    () => [...dictionary, ...cities, ...companies, ...roles],
    [dictionary, cities, companies, roles]
  );

  const isEditing = !!folder;

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(folder.color);
      setSearchQuery(folder.savedSearchQuery || filtersToQueryHint(folder.filterCriteria) || "");
    } else {
      setName("");
      setColor(PRESET_COLORS[0]);
      setSearchQuery("");
    }
    setError(null);
    setSuggestion(null);
  }, [folder, open]);

  const checkSpelling = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || allWords.length === 0) {
        setSuggestion(null);
        return;
      }
      setSuggestion(correctTypos(trimmed, allWords));
    },
    [allWords]
  );

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => checkSpelling(searchQuery), SPELLCHECK_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery, checkSpelling]);

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Folder name is required");
      return false;
    }
    const isDuplicate = existingNames.some(
      (existingName) =>
        existingName.toLowerCase() === trimmed.toLowerCase() &&
        (!isEditing || existingName.toLowerCase() !== folder?.name.toLowerCase())
    );
    if (isDuplicate) {
      setError("A smart folder with this name already exists");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateName(name)) return;

    const queryTrimmed = searchQuery.trim();
    if (!queryTrimmed) {
      setError("Enter a search (e.g. \"engineers at Acme\" or \"clients\") to filter contacts.");
      return;
    }

    let filterCriteria: SearchQueryFilters;
    try {
      const parsed = parseSearchQueryToSchema(queryTrimmed);
      filterCriteria = parsed.filters;
      const hasFilter =
        filterCriteria.name ||
        filterCriteria.company ||
        filterCriteria.job_title ||
        (filterCriteria.tags && filterCriteria.tags.length > 0) ||
        filterCriteria.location ||
        filterCriteria.relationship_type ||
        filterCriteria.date_range?.from ||
        filterCriteria.date_range?.to ||
        filterCriteria.interaction_date_range?.from ||
        filterCriteria.interaction_date_range?.to;
      if (!hasFilter) {
        setError("Could not understand the search. Try words like a company name, job title, or \"clients\".");
        return;
      }
    } catch {
      setError("Could not parse the search. Try simpler terms like a company or job title.");
      return;
    }

    onSave({
      name: name.trim(),
      color,
      directoryType: folder?.directoryType ?? directoryType,
      isOrganizationFolder: false,
      isSmartFolder: true,
      filterCriteria,
      savedSearchQuery: queryTrimmed,
    });
    onOpenChange(false);
  };

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      setSearchQuery(suggestion);
      setSuggestion(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isEditing ? "Edit Smart Folder" : "New Smart Folder"}
          </DialogTitle>
          <DialogDescription>
            Smart folders save a search and show all matching contacts now and in the future. You can still search inside the folder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="smart-folder-name">Folder Name</Label>
            <Input
              id="smart-folder-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) validateName(e.target.value);
              }}
              placeholder="e.g. Acme team, Designers"
              autoFocus
              className={error ? "border-destructive" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smart-folder-search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Filter by search
            </Label>
            <Input
              id="smart-folder-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='e.g. engineers at Acme, clients, job title: designer'
              className={error && !name.trim() ? "" : error ? "border-destructive" : ""}
            />
            {isEditing && folder?.filterCriteria && !searchQuery && (
              <p className="text-xs text-muted-foreground">
                Current filter: {filtersToQueryHint(folder.filterCriteria) || "saved criteria"}
              </p>
            )}
            {suggestion && (
              <button
                type="button"
                onClick={handleAcceptSuggestion}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                Did you mean:{" "}
                <span className="font-medium text-primary cursor-pointer underline underline-offset-2">
                  {suggestion}
                </span>
                ?
              </button>
            )}
            {error && (error.includes("search") || error.includes("parse") || error.includes("understand")) && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

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

          {error && !error.includes("search") && !error.includes("parse") && !error.includes("understand") && (
            <p className="text-sm text-destructive">{error}</p>
          )}

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
