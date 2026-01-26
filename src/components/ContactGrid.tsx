import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { DraggableContactCard } from "./DraggableContactCard";
import { Users, Trash2 } from "lucide-react";
import { ActionType } from "@/hooks/useActionSearch";
import { Button } from "@/components/ui/button";
import { useResponsiveView } from "@/hooks/use-mobile";

const VIRTUALIZE_THRESHOLD = 500;
// Must be at least as tall as one row of contact cards (avatar, name, metadata, phone, padding).
// Too small causes the next row to be translateY'd too high and overlap.
const ROW_HEIGHT_ESTIMATE = 300;

interface ContactGridProps {
  contacts: Contact[];
  searchQuery: string;
  action?: ActionType;
  onEditContact: (contact: Contact) => void;
  onViewContact?: (contact: Contact) => void;
  isTrashView?: boolean;
  trashCount?: number; // Accurate count of trashed contacts (not limited by 1000)
  onDeleteContact?: (id: string) => void;
  onRestoreContact?: (id: string) => void;
  onPermanentlyDelete?: (id: string) => void;
  onEmptyTrash?: () => void;
  folders?: Folder[];
  onUpdateFolder?: (contactId: string, folderId: string | null) => void;
  showOwnershipBadge?: boolean;
  onMarkContacted?: (id: string) => void;
  onToggleClient?: (id: string, isClient: boolean) => void;
  // Selection props
  selectedContactIds?: Set<string>;
  onSelectContact?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMoveToFolder?: (ids: string[], folderId: string | null) => void;
  onBulkToggleClient?: (ids: string[], isClient: boolean) => void;
  onBulkMarkContacted?: (ids: string[]) => void;
  hasClientAccess?: boolean;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  // Pagination: show "Load more" when there are more contacts for the current view
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export function ContactGrid({ 
  contacts, 
  searchQuery, 
  action, 
  onEditContact,
  onViewContact,
  isTrashView = false,
  trashCount,
  onDeleteContact,
  onRestoreContact,
  onPermanentlyDelete,
  onEmptyTrash,
  folders = [],
  onUpdateFolder,
  showOwnershipBadge = false,
  onMarkContacted,
  onToggleClient,
  selectedContactIds = new Set(),
  onSelectContact,
  onSelectAll,
  onBulkDelete,
  onBulkMoveToFolder,
  onBulkToggleClient,
  onBulkMarkContacted,
  hasClientAccess = false,
  selectionMode = false,
  onToggleSelectionMode,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: ContactGridProps) {
  const responsiveView = useResponsiveView();
  const isCompactMode = responsiveView === 'mobile' || responsiveView === 'tablet';
  
  // Track which contact is expanded in compact mode
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  
  // Debug log to see what ContactGrid is receiving and rendering
  useEffect(() => {
    console.log('[ContactGrid] Render state:', {
      contactsLength: contacts.length,
      searchQuery,
      isTrashView,
      useVirtualized: contacts.length >= VIRTUALIZE_THRESHOLD && !isTrashView
    });
  }, [contacts.length, searchQuery, isTrashView]);

  // Memoize folder map for quick lookup - only recreate when folders change
  const folderMap = useMemo(() => 
    new Map(folders.map(f => [f.id, f])),
    [folders]
  );

  const handleToggleExpand = useCallback((contactId: string) => {
    setExpandedContactId(prev => prev === contactId ? null : contactId);
  }, []);

  // Memoize grid classes - only recalculate when compact mode changes
  // MUST be before early return to follow Rules of Hooks
  const gridClasses = useMemo(() => 
    isCompactMode
      ? "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6",
    [isCompactMode]
  );

  // Memoize selection checks - only recalculate when contacts or selection changes
  // MUST be before early return to follow Rules of Hooks
  const allSelected = useMemo(() => 
    contacts.length > 0 && contacts.every(c => selectedContactIds.has(c.id)),
    [contacts, selectedContactIds]
  );

  const useVirtualizedList = contacts.length >= VIRTUALIZE_THRESHOLD && !isTrashView;
  const columns = isCompactMode ? 2 : 4;
  const rowCount = useVirtualizedList ? Math.ceil(contacts.length / columns) : 0;
  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Start loading the next page as soon as the user scrolls near the bottom,
  // so more contacts appear without waiting for a click.
  useEffect(() => {
    if (isTrashView || !hasMore || !onLoadMore) return;
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting && !isLoadingMore) onLoadMore();
      },
      { rootMargin: "200px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isTrashView, hasMore, onLoadMore, isLoadingMore]);

  const useDynamicMeasurement =
    typeof window === "undefined" || !navigator.userAgent.toLowerCase().includes("firefox");
  // Match grid row gap: compact uses gap-2/gap-3 (8–12px), desktop uses gap-3/gap-4/gap-6 (12–24px)
  const rowGapPx = isCompactMode ? 12 : 24;
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 3,
    enabled: useVirtualizedList,
    gap: rowGapPx,
    measureElement: useDynamicMeasurement
      ? (el) =>
          el
            ? Math.max(ROW_HEIGHT_ESTIMATE, el.getBoundingClientRect().height)
            : ROW_HEIGHT_ESTIMATE
      : undefined,
  });

  // Force virtualizer to measure when contacts change or virtualization toggles
  useEffect(() => {
    if (!useVirtualizedList) {
      console.log('[ContactGrid] Not using virtualization');
      return;
    }
    
    console.log('[ContactGrid] Virtualization active, contacts:', contacts.length, 'rowCount:', rowCount);
    
    // Wait for next frame to ensure DOM is updated, then measure multiple times
    // to ensure the virtualizer has valid measurements
    requestAnimationFrame(() => {
      rowVirtualizer.measure();
      console.log('[ContactGrid] Initial measure done');
      
      // Measure again after a short delay to handle async layout
      setTimeout(() => {
        rowVirtualizer.measure();
        const virtualItems = rowVirtualizer.getVirtualItems();
        console.log('[ContactGrid] Second measure - virtual items:', virtualItems.length, 'totalSize:', rowVirtualizer.getTotalSize());
      }, 50);
    });
  }, [useVirtualizedList, contacts.length, rowCount]);

  // Early return AFTER all hooks
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          {isTrashView ? (
            <Trash2 className="h-10 w-10 text-muted-foreground" />
          ) : (
            <Users className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <h3 className="font-display font-semibold text-xl text-foreground mb-2">
          {isTrashView ? "Trash is empty" : "No contacts found"}
        </h3>
        <p className="text-muted-foreground text-center max-w-sm">
          {isTrashView
            ? "Deleted contacts will appear here."
            : searchQuery
            ? `No results for "${searchQuery}". Try a different search term.`
            : "Start adding contacts to see them here."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {isTrashView && (contacts.length > 0 || (trashCount && trashCount > 0)) && (
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {trashCount !== undefined ? trashCount : contacts.length} contact{(trashCount !== undefined ? trashCount : contacts.length) !== 1 ? "s" : ""} in trash
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={onEmptyTrash}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Empty Trash
          </Button>
        </div>
      )}
      {useVirtualizedList ? (
        <div
          ref={parentRef}
          className="overflow-auto rounded-lg"
          style={{ height: "70vh" }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {(() => {
              const virtualItems = rowVirtualizer.getVirtualItems();
              console.log('[ContactGrid] Rendering virtual items:', virtualItems.length, 'totalSize:', rowVirtualizer.getTotalSize());
              return virtualItems.map((virtualRow) => {
              const start = virtualRow.index * columns;
              const rowContacts = contacts.slice(start, start + columns);
              return (
                <div
                  key={virtualRow.key}
                  ref={useDynamicMeasurement ? rowVirtualizer.measureElement : undefined}
                  data-index={virtualRow.index}
                  className={gridClasses}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {rowContacts.map((contact, index) => (
                    <DraggableContactCard
                      key={contact.id}
                      contact={contact}
                      index={start + index}
                      action={action}
                      onEdit={() => onEditContact(contact)}
                      onView={onViewContact ? () => onViewContact(contact) : undefined}
                      isTrashView={isTrashView}
                      onDelete={onDeleteContact ? () => onDeleteContact(contact.id) : undefined}
                      onRestore={onRestoreContact ? () => onRestoreContact(contact.id) : undefined}
                      onPermanentlyDelete={onPermanentlyDelete ? () => onPermanentlyDelete(contact.id) : undefined}
                      folder={contact.folderId ? folderMap.get(contact.folderId) : undefined}
                      folders={folders}
                      onUpdateFolder={onUpdateFolder}
                      showOwnershipBadge={showOwnershipBadge}
                      onMarkContacted={onMarkContacted ? () => onMarkContacted(contact.id) : undefined}
                      onToggleClient={onToggleClient ? (isClient) => onToggleClient(contact.id, isClient) : undefined}
                      hasClientAccess={hasClientAccess}
                      compact={isCompactMode}
                      isExpanded={expandedContactId === contact.id}
                      onToggleExpand={() => handleToggleExpand(contact.id)}
                      isSelected={selectedContactIds.has(contact.id)}
                      onSelect={onSelectContact ? (selected) => onSelectContact(contact.id, selected) : undefined}
                      selectionMode={selectionMode}
                    />
                  ))}
                </div>
              );
            });
            })()}
          </div>
        </div>
      ) : (
        <div className={gridClasses}>
          {contacts.map((contact, index) => (
            <DraggableContactCard
              key={contact.id}
              contact={contact}
              index={index}
              action={action}
              onEdit={() => onEditContact(contact)}
              onView={onViewContact ? () => onViewContact(contact) : undefined}
              isTrashView={isTrashView}
              onDelete={onDeleteContact ? () => onDeleteContact(contact.id) : undefined}
              onRestore={onRestoreContact ? () => onRestoreContact(contact.id) : undefined}
              onPermanentlyDelete={onPermanentlyDelete ? () => onPermanentlyDelete(contact.id) : undefined}
              folder={contact.folderId ? folderMap.get(contact.folderId) : undefined}
              folders={folders}
              onUpdateFolder={onUpdateFolder}
              showOwnershipBadge={showOwnershipBadge}
              onMarkContacted={onMarkContacted ? () => onMarkContacted(contact.id) : undefined}
              onToggleClient={onToggleClient ? (isClient) => onToggleClient(contact.id, isClient) : undefined}
              hasClientAccess={hasClientAccess}
              compact={isCompactMode}
              isExpanded={expandedContactId === contact.id}
              onToggleExpand={() => handleToggleExpand(contact.id)}
              isSelected={selectedContactIds.has(contact.id)}
              onSelect={onSelectContact ? (selected) => onSelectContact(contact.id, selected) : undefined}
              selectionMode={selectionMode}
            />
          ))}
        </div>
      )}
      {hasMore && onLoadMore && !isTrashView && (
        <>
          <div ref={loadMoreSentinelRef} className="min-h-px w-full" aria-hidden />
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => onLoadMore()}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
