import { Search, X } from "lucide-react";
import { useRef, useEffect, useState, type ChangeEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { devLog } from "@/lib/devLog";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  isLoading?: boolean;
}

export function SearchBar({ value, onChange, onEnter, placeholder = "Search contacts...", isLoading = false }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const isComposingRef = useRef(false);
  const [localValue, setLocalValue] = useState(value);
  const lastEmittedRef = useRef<string>(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const DEBOUNCE_MS = 180;

  // Some embedded browsers / editors can inject bidi control characters (LRM/RLM, overrides/isolates)
  // which can make typing *appear reversed*. Strip them to keep search input stable.
  const sanitizeSearchValue = (raw: string) => raw.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");

  // Keep local input in sync ONLY when the parent changes value externally (clear, navigation, etc).
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    setLocalValue(value);
    lastEmittedRef.current = value;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [value]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setLocalValue("");
        lastEmittedRef.current = "";
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        onChange("");
      }
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        onEnter?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onChange, onEnter]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value;
    const next = sanitizeSearchValue(raw);
    if (next !== raw) {
      devLog("[SearchBar] Stripped bidi control chars from search input");
    }
    devLog("[SearchBar] handleChange:", next);
    setLocalValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      lastEmittedRef.current = "";
      onChange("");
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      lastEmittedRef.current = next;
      onChange(next);
    }, DEBOUNCE_MS);
  };

  const handleClear = () => {
    devLog('[SearchBar] handleClear called');
    setLocalValue("");
    lastEmittedRef.current = "";
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full group min-w-0" data-onboarding-search>
      <div className="absolute inset-0 rounded-xl sm:rounded-2xl gradient-hero opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />
      <div className="relative flex items-center min-w-0">
        {isLoading ? (
          <div className="absolute left-3 sm:left-4 md:left-5 h-4 w-4 sm:h-5 sm:w-5 animate-spin rounded-full border-2 border-primary border-t-transparent z-10" />
        ) : (
          <Search className="absolute left-3 sm:left-4 md:left-5 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200 z-10" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          dir="ltr"
          style={{ unicodeBidi: "plaintext" }}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          placeholder={isMobile ? "Search..." : placeholder}
          className="w-full h-10 sm:h-12 md:h-14 pl-10 sm:pl-12 md:pl-14 pr-8 sm:pr-20 md:pr-24 rounded-xl sm:rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground shadow-search focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm sm:text-base min-w-0"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-2 sm:right-14 md:right-16 p-1 sm:p-1.5 rounded-lg hover:bg-secondary transition-colors z-10 shrink-0"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {!isMobile && (
          <div className="absolute right-3 sm:right-4 md:right-6 flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs font-medium z-10 shrink-0 pointer-events-none">
            <span>⌘</span>
            <span>K</span>
          </div>
        )}
      </div>
    </div>
  );
}
