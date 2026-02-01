# Contact Card Layout and Grid — Implementation Notes

This document describes how contact cards are laid out, spaced, and rendered so future changes keep behavior and constraints in one place.

---

## 1. Contact Card Layout (Desktop)

**File:** `src/components/ContactCard.tsx`

### 1.1 Layout constants (top of file)

| Constant | Value | Purpose |
|----------|--------|---------|
| `NAME_BLOCK_H_DESKTOP` | `"3.25rem"` | Fixed height for the name area so two lines + descenders fit and badges never overlap the name. |
| `NAME_BLOCK_H_COMPACT` | `"2.25rem"` | Same idea for compact (mobile/tablet) name block. |
| `CARD_H_DESKTOP` | `"28rem"` | Minimum height of each desktop card. Grid row height and card min-height both use this so cards don’t overlap vertically. |

### 1.2 Structure (top to bottom)

1. **Folder row**  
   Fixed height (`h-7`). “No folder” or folder pill; spacing is fixed for consistent card height.

2. **Avatar + content row** (`flex items-start gap-4 shrink-0`)
   - **Avatar:** `w-14 h-14`, `rounded-xl`, `overflow-hidden`, `gradient-hero`. Rounding and overflow ensure the gradient doesn’t draw past the rounded rect.
   - **Content column** (`flex-1 min-w-0 flex flex-col overflow-visible`):
     - **Name block:** `height: NAME_BLOCK_H_DESKTOP`, `overflow-hidden`, `line-clamp-2`, `leading-snug`. Only the name lives here so badges never sit on the name.
     - **Role (optional):** Single line, truncated.
     - **“You” badge (optional):** Shown above the tag grid when `isCurrentUser`.
     - **Tag grid (2×2):** Client, Internal, Shared/Personal, Never contacted (see below).

3. **Contact details**  
   `flex-1 min-h-0 overflow-y-auto` so this block scrolls inside the card when there are many rows. Card height stays fixed.

4. **Action row**  
   Buttons (Client, Contacted, Edit, etc.) in a `shrink-0` row at the bottom.

The card root uses `overflow-hidden`, `box-border`, `h-full max-h-full min-h-0`, and `minHeight: CARD_H_DESKTOP` so it fills its cell, doesn’t grow past it, and never overlaps the next row.

### 1.3 Tag grid (2×2)

- **Order:** Row 1: Client | Internal. Row 2: Shared or Personal | Never contacted (or last-contact time).
- **Layout:** `grid` with `gridTemplateColumns: "minmax(min-content, 1fr) minmax(min-content, 1fr)"` so both columns can grow and full labels (e.g. “Never contacted”) stay visible.
- **Empty slots:** If Client, Internal, or Shared/Personal is missing, that cell is an empty placeholder with `min-h-[1.75rem]` and `aria-hidden` so the 2×2 structure and spacing stay consistent.
- **No truncation:** Tags use `shrink-0 w-fit` and full text (no `truncate`) so “Client”, “Internal”, “Shared”, “Personal”, “Never contacted” are always readable.
- **Spacing:** `mt-3` above the tag grid; `gap-x-2 gap-y-2` between tags. Role and “You” sit above with their own spacing.

### 1.4 Rounding

- **Card:** `rounded-xl sm:rounded-2xl` on the root.
- **Avatar (desktop):** `rounded-xl overflow-hidden` on the initials block so the gradient is clipped to the rounded shape. Compact variants use `rounded-md` / `rounded-lg` and `overflow-hidden` the same way.
- **Grid cell wrappers:** Wrappers in `ContactGrid` use `rounded-xl sm:rounded-2xl` so they don’t clip the card’s rounded corners.

### 1.5 Overflow and clipping

- Only the **name block** and the **role** line use `overflow-hidden` (and truncation where needed). The rest of the content column is `overflow-visible` so the tag grid is never clipped by that column.
- The **card** and the **grid cell wrapper** use `overflow-hidden` so nothing spills into adjacent cards or rows.

---

## 2. Contact Grid

**File:** `src/components/ContactGrid.tsx`

### 2.1 Grid layout (desktop, non-compact)

- **Template:** `grid-cols-[repeat(auto-fill,minmax(360px,1fr))]` so the number of columns depends on width. No fixed breakpoints; no horizontal scroll from the grid.
- **Row height:** `auto-rows-[28rem]` so every row is 28rem and cards align.
- **Gaps:** `gap-4 sm:gap-5 lg:gap-6`.
- **Container:** The grid is wrapped in `min-w-0 overflow-x-hidden w-full` so it never causes horizontal scroll and only uses the width it’s given.

**Constants:**

- `DESKTOP_CARD_MIN_WIDTH_PX = 360` — minimum width per card used in auto-fill and in virtualized column math.
- `DESKTOP_GRID_GAP_PX = 24` — gap used when computing how many columns fit in the virtualized container.

### 2.2 Grid cell wrapper

Each card is wrapped in a div:

- `min-h-[28rem] h-full overflow-hidden rounded-xl sm:rounded-2xl`

So:

- The cell is at least 28rem tall and stretches to the row height.
- Content is clipped to the cell.
- Corners match the card’s rounding so the card isn’t clipped to a rectangle.

### 2.3 Virtualized list (500+ contacts)

- **Trigger:** `useVirtualizedList = contacts.length >= VIRTUALIZE_THRESHOLD && !isTrashView` (threshold 500).
- **Scroll container:** `overflow-x-hidden overflow-y-auto`, height `70vh`, so only vertical scroll.
- **Column count:** A `ResizeObserver` on the scroll container updates `virtualizedColumns`:
  - `virtualizedColumns = max(1, floor((width + DESKTOP_GRID_GAP_PX) / (DESKTOP_CARD_MIN_WIDTH_PX + DESKTOP_GRID_GAP_PX)))`
  so the number of contacts per row matches the available width and no horizontal scroll is needed.
- **Rows:** Each virtual row is a div with `gridTemplateColumns: repeat(${columns}, minmax(360px, 1fr))` (when not compact) so column count matches the computed value.
- **Row height:** `ROW_HEIGHT_ESTIMATE = 460` (≈ 28rem) is used for virtualizer sizing; the virtualizer can measure rows for accuracy.

### 2.4 Compact mode (mobile/tablet)

- **When:** `isCompactMode = responsiveView === 'mobile' || responsiveView === 'tablet'` (from `useResponsiveView()`).
- **Grid:** `grid-cols-1 sm:grid-cols-2`, `gap-2 sm:gap-3`. Compact cards are used; layout and tags are different from desktop (see `ContactCard` compact branches).

---

## 3. Design rules (don’t break these)

1. **No overlap**
   - Name and tags are separated (fixed name height + `mt-3`), and tags never overlap the name.
   - Cards don’t overlap: fixed row height (28rem), card `max-h-full` and `minHeight: CARD_H_DESKTOP`, wrapper `overflow-hidden rounded-xl sm:rounded-2xl`.

2. **No horizontal scroll**
   - Desktop grid uses `repeat(auto-fill, minmax(360px, 1fr))` and lives in `min-w-0 overflow-x-hidden`.
   - Virtualized list uses a width-based column count and `overflow-x-hidden` on the scroll container.

3. **All tag text visible**
   - Tags use full labels (no truncation), `shrink-0 w-fit`, and a 2×2 grid with `minmax(min-content, 1fr)` so “Never contacted” and similar stay readable.

4. **Consistent card height**
   - Desktop cards use a 28rem minimum height and fixed row height so spacing between cards is consistent and rows align.

5. **Rounding**
   - Cards and grid wrappers use `rounded-xl sm:rounded-2xl`. Avatar blocks use `rounded-*` plus `overflow-hidden` so gradients don’t draw past the corners.

---

## 4. Where to change what

| Goal | Primary place |
|------|----------------|
| Card height, name height, tag spacing | `ContactCard.tsx` constants and the desktop return block. |
| Tag order, count, or layout | `ContactCard.tsx` “Client, Internal, Shared/Personal, Never contacted” 2×2 grid. |
| Min card width or column count behavior | `ContactGrid.tsx`: `DESKTOP_CARD_MIN_WIDTH_PX`, `DESKTOP_GRID_GAP_PX`, and the auto-fill / virtualized column logic. |
| Row height | `ContactGrid.tsx` `auto-rows-[28rem]` and wrapper `min-h-[28rem]`; `ContactCard.tsx` `CARD_H_DESKTOP`. |
| Rounding | Card and wrapper in `ContactGrid`; avatar and card in `ContactCard`. |

Keeping these in sync (e.g. `CARD_H_DESKTOP` and `28rem` in the grid) avoids overlap and layout bugs.
