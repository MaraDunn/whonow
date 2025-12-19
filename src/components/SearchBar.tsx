import { Search, X } from "lucide-react";
import { useRef, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export function SearchBar({ value, onChange, placeholder = "Search contacts...", isLoading = false }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        onChange("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onChange]);

  return (
    <div className="relative w-full max-w-2xl mx-auto group">
      <div className="absolute inset-0 rounded-2xl gradient-hero opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
      <div className="relative flex items-center">
        {isLoading ? (
          <div className="absolute left-5 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <Search className="absolute left-5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-14 pl-14 pr-24 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground shadow-search focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-base"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-16 p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div className="absolute right-4 flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs font-medium">
          <span>⌘</span>
          <span>K</span>
        </div>
      </div>
    </div>
  );
}
