import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Contact } from "@/types/contact";
import { Folder } from "@/types/folder";
import { DraggableContactCard } from "./DraggableContactCard";
import { Users, Trash2 } from "lucide-react";

/** Sample contact shown when the user has no contacts (first-time / empty state). Not persisted. */
const SAMPLE_CONTACT: Contact = {
  id: "__demo__",
  name: "Sample Contact",
  email: "sample@example.com",
  phone: "+1 (555) 000-0000",
  company: "Example Corp",
  role: "Product Manager",
  tags: [],
  description: "This is what a contact card looks like. Add your own contacts to get started.",
  isClient: true,
  lastContactedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
};
import { ActionType } from "@/hooks/useActionSearch";
import { devLog } from "@/lib/devLog";
import { Button } from "@/components/ui/button";
import { useResponsiveView } from "@/hooks/use-mobile";

const VIRTUALIZE_THRESHOLD = 500;
// Match desktop card row height (28rem ≈ 448px) so virtualized rows don't overlap before measurement.
const ROW_HEIGHT_ESTIMATE = 460;
// Compact (mobile/tablet) cards are single-row ~60–80px; use slightly larger for expanded state.
const COMPACT_ROW_HEIGHT_ESTIMATE = 90;
const DESKTOP_CARD_MIN_WIDTH_PX = 280; // Reduced to allow 3+ cards per row
const DESKTOP_GRID_GAP_PX = 24;

interface ContactGridProps {
  contacts: Contact[];
  searchQuery: string;
  action?: ActionType;
  onEditContact: (contact: Contact) => void;
  onViewContact?: (contact: Contact) => void;
  isTrashView?: boolean;
  trashCount?: number; // Accurate count of trashed contacts (not limited by 1000)
  onDeleteContact?: (id: string) => void;
  onExportContact?: (contact: Contact) => void;
  onShareToSlack?: (contact: Contact) => void;
  onShareToTeams?: (contact: Contact) => void;
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
  /** Set of contact emails (lowercase) that are internal/team members. When provided, cards show an "Internal" badge for those contacts. Omit in Team Directory or Trash. */
  internalContactEmails?: Set<string>;
  /** When provided, contacts with contact.companyId === this value also show the Internal badge (company-linked contacts). */
  internalCompanyId?: string;
  /** Set of team member user ids — contacts with contact.ownerId in this set (e.g. imported/created by a colleague) show the Internal badge. */
  internalContactOwnerIds?: Set<string>;
  /** Current user's email — contacts matching this (or with tags "my-profile") show the "You" badge. */
  currentUserEmail?: string | null;
  /** Current user's id — contacts with id matching this show the "You" badge. */
  currentUserId?: string | null;
  // Pagination: show "Load more" when there are more contacts for the current view
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  /** When true and there are no contacts, show a sample contact card (e.g. during onboarding). Hidden after tutorial and when user has real contacts. */
  showSampleContact?: boolean;
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
  onExportContact,
  onShareToSlack,
  onShareToTeams,
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
  internalContactEmails,
  internalCompanyId,
  internalContactOwnerIds,
  currentUserEmail,
  currentUserId,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  showSampleContact = false,
}: ContactGridProps) {
  const responsiveView = useResponsiveView();
  const isInternalContact = useCallback(
    (contact: Contact) => {
      if (!internalContactEmails && !internalCompanyId && !internalContactOwnerIds) return false;
      const emailMatch =
        !!internalContactEmails && !!contact.email && internalContactEmails.has(contact.email.toLowerCase().trim());
      const companyMatch = !!internalCompanyId && !!contact.companyId && contact.companyId === internalCompanyId;
      const ownerInCompany =
        !!internalContactOwnerIds && !!contact.ownerId && internalContactOwnerIds.has(contact.ownerId);
      return emailMatch || companyMatch || ownerInCompany;
    },
    [internalContactEmails, internalCompanyId, internalContactOwnerIds]
  );
  const isCurrentUserContact = useCallback(
    (contact: Contact) =>
      !!(contact.tags && contact.tags.includes("my-profile")) ||
      (!!currentUserEmail && !!contact.email && contact.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()) ||
      (!!currentUserId && contact.id === currentUserId),
    [currentUserEmail, currentUserId]
  );
  const isCompactMode = responsiveView === 'mobile' || responsiveView === 'tablet';

  // Match Tailwind sm (640px): single column only when grid is actually 1-col to avoid virtualizer overlap
  const [compactGridSingleCol, setCompactGridSingleCol] = useState(true);
  useEffect(() => {
    if (!isCompactMode) return;
    const mql = window.matchMedia("(min-width: 640px)");
    const update = () => setCompactGridSingleCol(!mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [isCompactMode]);
  
  // Track which contact is expanded in compact mode
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  
  // Debug log to see what ContactGrid is receiving and rendering
  useEffect(() => {
    devLog('[ContactGrid] Render state:', {
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
      ? "grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-3 items-stretch"
      : "grid w-full min-w-0 gap-4 sm:gap-5 lg:gap-6 items-stretch auto-rows-[28rem] grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
    [isCompactMode]
  );

  // Card wrapper: on compact use margin for spacing so cards never touch (grid gap can be unreliable on mobile)
  const cardWrapperClass = useMemo(
    () =>
      isCompactMode
        ? "min-h-0 overflow-hidden rounded-xl mb-4 last:mb-0 sm:mb-0"
        : "min-h-[28rem] h-full overflow-hidden rounded-xl sm:rounded-2xl",
    [isCompactMode]
  );

  // Memoize selection checks - only recalculate when contacts or selection changes
  // MUST be before early return to follow Rules of Hooks
  const allSelected = useMemo(() => 
    contacts.length > 0 && contacts.every(c => selectedContactIds.has(c.id)),
    [contacts, selectedContactIds]
  );

  const useVirtualizedList = contacts.length >= VIRTUALIZE_THRESHOLD && !isTrashView;
  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Columns per row: compact uses 1 when grid is 1-col (< 640px), 2 when grid is 2-col (≥ 640px); desktop uses container width.
  const [virtualizedColumns, setVirtualizedColumns] = useState(4);
  useEffect(() => {
    if (!useVirtualizedList || !parentRef.current || isCompactMode) return;
    const el = parentRef.current;
    const updateColumns = () => {
      const w = el.clientWidth;
      const n = Math.floor((w + DESKTOP_GRID_GAP_PX) / (DESKTOP_CARD_MIN_WIDTH_PX + DESKTOP_GRID_GAP_PX));
      setVirtualizedColumns(Math.max(1, n));
    };
    updateColumns();
    const ro = new ResizeObserver(updateColumns);
    ro.observe(el);
    return () => ro.disconnect();
  }, [useVirtualizedList, isCompactMode]);

  const columns = isCompactMode
    ? (compactGridSingleCol ? 1 : 2)
    : (useVirtualizedList ? virtualizedColumns : 1);
  const rowCount = useVirtualizedList ? Math.ceil(contacts.length / columns) : 0;

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
  const rowHeightEstimate = isCompactMode ? COMPACT_ROW_HEIGHT_ESTIMATE : ROW_HEIGHT_ESTIMATE;
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeightEstimate,
    overscan: 3,
    enabled: useVirtualizedList,
    gap: rowGapPx,
    measureElement: useDynamicMeasurement
      ? (el) =>
          el
            ? Math.max(rowHeightEstimate, el.getBoundingClientRect().height)
            : rowHeightEstimate
      : undefined,
  });

  // Force virtualizer to measure when contacts change or virtualization toggles
  useEffect(() => {
    if (!useVirtualizedList) {
      devLog('[ContactGrid] Not using virtualization');
      return;
    }
    
    devLog('[ContactGrid] Virtualization active, contacts:', contacts.length, 'rowCount:', rowCount);
    
    // Wait for next frame to ensure DOM is updated, then measure multiple times
    // to ensure the virtualizer has valid measurements
    requestAnimationFrame(() => {
      rowVirtualizer.measure();
      devLog('[ContactGrid] Initial measure done');
      
      // Measure again after a short delay to handle async layout
      setTimeout(() => {
        rowVirtualizer.measure();
        const virtualItems = rowVirtualizer.getVirtualItems();
        devLog('[ContactGrid] Second measure - virtual items:', virtualItems.length, 'totalSize:', rowVirtualizer.getTotalSize());
      }, 50);
    });
  }, [useVirtualizedList, contacts.length, rowCount]);

  // Early return AFTER all hooks
  if (contacts.length === 0) {
    const showSampleCard = showSampleContact && !isTrashView && !searchQuery;
    // When showing sample card, render it in the same grid position as the first contact would be
    if (showSampleCard) {
      return (
        <div className="min-w-0 overflow-x-hidden w-full animate-fade-in">
          <p className="text-sm text-muted-foreground mb-3">
            Here&apos;s what a contact looks like:
          </p>
          <div className={gridClasses}>
            <div className={cardWrapperClass} data-onboarding-contact-card="">
              <DraggableContactCard
                contact={SAMPLE_CONTACT}
                index={0}
                action={action}
                onEdit={() => {}}
                onView={undefined}
                isTrashView={false}
                folder={undefined}
                folders={folders}
                showOwnershipBadge={showOwnershipBadge}
                hasClientAccess={true}
                isInternal={false}
                isCurrentUser={false}
                compact={isCompactMode}
                isExpanded={false}
                onToggleExpand={() => {}}
                isSelected={false}
                selectionMode={false}
                onMarkContacted={() => {}}
                onToggleClient={() => {}}
              />
            </div>
          </div>
        </div>
      );
    }
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
          className="overflow-x-hidden overflow-y-auto rounded-lg"
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
              devLog('[ContactGrid] Rendering virtual items:', virtualItems.length, 'totalSize:', rowVirtualizer.getTotalSize());
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
                    gridTemplateColumns: isCompactMode ? undefined : `repeat(${columns}, minmax(${DESKTOP_CARD_MIN_WIDTH_PX}px, 1fr))`,
                  }}
                >
                  {rowContacts.map((contact, index) => (
                    <div key={contact.id} className={cardWrapperClass}>
                      <DraggableContactCard
                        contact={contact}
                        index={start + index}
                        action={action}
                        onEdit={() => onEditContact(contact)}
                        onView={onViewContact ? () => onViewContact(contact) : undefined}
                        isTrashView={isTrashView}
                        onDelete={onDeleteContact ? () => onDeleteContact(contact.id) : undefined}
                        onExportContact={onExportContact ? () => onExportContact(contact) : undefined}
                        onShareToSlack={onShareToSlack ? () => onShareToSlack(contact) : undefined}
                        onShareToTeams={onShareToTeams ? () => onShareToTeams(contact) : undefined}
                        onRestore={onRestoreContact ? () => onRestoreContact(contact.id) : undefined}
                        onPermanentlyDelete={onPermanentlyDelete ? () => onPermanentlyDelete(contact.id) : undefined}
                        folder={contact.folderId ? folderMap.get(contact.folderId) : undefined}
                        folders={folders}
                        onUpdateFolder={onUpdateFolder}
                        showOwnershipBadge={showOwnershipBadge}
                        onMarkContacted={onMarkContacted ? () => onMarkContacted(contact.id) : undefined}
                        onToggleClient={onToggleClient ? (isClient) => onToggleClient(contact.id, isClient) : undefined}
                        hasClientAccess={hasClientAccess}
                        isInternal={isInternalContact(contact)}
                        isCurrentUser={isCurrentUserContact(contact)}
                        compact={isCompactMode}
                        isExpanded={expandedContactId === contact.id}
                        onToggleExpand={() => handleToggleExpand(contact.id)}
                        isSelected={selectedContactIds.has(contact.id)}
                        onSelect={onSelectContact ? (selected) => onSelectContact(contact.id, selected) : undefined}
                        selectionMode={selectionMode}
                      />
                    </div>
                  ))}
                </div>
              );
            });
            })()}
          </div>
        </div>
      ) : (
        <div className="min-w-0 overflow-x-hidden w-full">
          <div className={gridClasses}>
          {contacts.map((contact, index) => (
            <div key={contact.id} className={cardWrapperClass}>
              <DraggableContactCard
                contact={contact}
                index={index}
              action={action}
              onEdit={() => onEditContact(contact)}
              onView={onViewContact ? () => onViewContact(contact) : undefined}
              isTrashView={isTrashView}
              onDelete={onDeleteContact ? () => onDeleteContact(contact.id) : undefined}
              onExportContact={onExportContact ? () => onExportContact(contact) : undefined}
              onShareToSlack={onShareToSlack ? () => onShareToSlack(contact) : undefined}
              onShareToTeams={onShareToTeams ? () => onShareToTeams(contact) : undefined}
              onRestore={onRestoreContact ? () => onRestoreContact(contact.id) : undefined}
              onPermanentlyDelete={onPermanentlyDelete ? () => onPermanentlyDelete(contact.id) : undefined}
              folder={contact.folderId ? folderMap.get(contact.folderId) : undefined}
              folders={folders}
              onUpdateFolder={onUpdateFolder}
              showOwnershipBadge={showOwnershipBadge}
              onMarkContacted={onMarkContacted ? () => onMarkContacted(contact.id) : undefined}
              onToggleClient={onToggleClient ? (isClient) => onToggleClient(contact.id, isClient) : undefined}
              hasClientAccess={hasClientAccess}
              isInternal={isInternalContact(contact)}
              isCurrentUser={isCurrentUserContact(contact)}
              compact={isCompactMode}
              isExpanded={expandedContactId === contact.id}
              onToggleExpand={() => handleToggleExpand(contact.id)}
              isSelected={selectedContactIds.has(contact.id)}
              onSelect={onSelectContact ? (selected) => onSelectContact(contact.id, selected) : undefined}
              selectionMode={selectionMode}
              />
            </div>
          ))}
          </div>
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
