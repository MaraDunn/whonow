import { Search, X } from "lucide-react";
import { useRef, useEffect, useLayoutEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export function SearchBar({ value, onChange, placeholder = "Search contacts...", isLoading = false }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const cursorPosRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);

  // Restore cursor SYNCHRONOUSLY after React re-render (before browser paint)
  useLayoutEffect(() => {
    if (cursorPosRef.current !== null && inputRef.current && !isComposingRef.current) {
      const pos = cursorPosRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      cursorPosRef.current = null;
    }
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Save cursor position BEFORE onChange causes re-render
    if (!isComposingRef.current) {
      cursorPosRef.current = e.target.selectionStart;
    }
    console.log('[SearchBar] handleChange:', e.target.value);
    onChange(e.target.value);
  };

  const handleClear = () => {
    console.log('[SearchBar] handleClear called');
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto group min-w-0">
      <div className="absolute inset-0 rounded-xl sm:rounded-2xl gradient-hero opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
      <div className="relative flex items-center min-w-0">
        {isLoading ? (
          <div className="absolute left-3 sm:left-4 md:left-5 h-4 w-4 sm:h-5 sm:w-5 animate-spin rounded-full border-2 border-primary border-t-transparent z-10" />
        ) : (
          <Search className="absolute left-3 sm:left-4 md:left-5 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200 z-10" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          placeholder={isMobile ? "Search..." : placeholder}
          className="w-full h-10 sm:h-12 md:h-14 pl-10 sm:pl-12 md:pl-14 pr-8 sm:pr-20 md:pr-24 rounded-xl sm:rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground shadow-search focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm sm:text-base min-w-0"
        />
        {value && (
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
