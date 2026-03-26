# Research: Cross-tab information pinboard (003)

## Capture model

- **Single pin per save action**: Each confirmed capture in the picker produces **one** persisted pin (one selector, one saved text snapshot, one display title). The picker session may create **multiple** pins in sequence without reopening the extension popup.
- **Session behavior**: The user can save several pins from the same page in one picker session (each “Save pin” persists immediately). **Done** ends the session and returns control to the popup; **Cancel** discards only the in-progress label dialog and ends the session without requiring new pins.

## Minimum pin shape

- **Identity**: Stable `id`, user-facing `title`, `order` for list position.
- **Source reference**: `pageUrl` (normalized http/https), `pageTitle`, `faviconUrl`.
- **Captured content**: `selector` (CSS path for refresh), `savedContent` (primary text), `previewText` (short, list-scannable).
- **Timestamps**: `createdAt`, `updatedAt` (last capture or successful refresh).

## Refresh behavior

- **Success**: Re-read the DOM node for `selector` on a matching tab; update `savedContent`, `previewText`, `pageTitle`/`faviconUrl` if available, and `updatedAt`.
- **Failure** (tab closed, auth wall, selector missing, navigation): **Keep** the last stored snapshot; surface a clear error and direct the user to re-open the page or **re-pin** from the picker. No silent data loss.

## Visual repositioning (general-purpose pinboard)

- **Remove** AI-dashboard framing (“usage ledger”, “tracked panels”, AI-only seed URLs, spending-focused empty state).
- **Replace with** neutral language: pins, capture, source, preview, saved snapshot vs live page.
- **Keep** the single-popup layout; adjust hierarchy (saved list first, capture actions discoverable) and a calmer palette (less “dashboard metric” styling).

## Architecture reuse

- **Retain** MV3 service worker, `scripting.executeScript` picker injection, `chrome.storage.local` via a shared storage module, and vendored SortableJS for reorder.
- **Change** persisted key from `monitoredEntries` to `pins` with a one-time migration from legacy multi-field entries (each legacy field becomes its own pin).
