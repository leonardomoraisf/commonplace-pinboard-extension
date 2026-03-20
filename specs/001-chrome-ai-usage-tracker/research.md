# Research: Unified AI usage panel (Chrome)

**Feature**: `001-chrome-ai-usage-tracker`  
**Date**: 2026-03-19

## R1 — Preview of pages that block iframe (Cursor, ChatGPT, etc.)

**Decision**: Do not rely on `<iframe src="…">` in the popup for the sample. Use **DOM extraction** on the real page (tab with authenticated session) and **reproduce** in the popup as sanitized HTML inside a container with max height and internal scroll.

**Rationale**: `X-Frame-Options` and `frame-ancestors` in CSP prevent embedding sensitive dashboards in the popup. The spec requires a visual sample and refresh with profile credentials — that requires running code in the page context (content script) or in a tab that loads the URL with the same cookies.

**Alternatives considered**:

- **Iframe in popup** — rejected: fails for main targets.
- **Screenshot (`captureVisibleTab`)** — rejected as sole solution: only works for the visible tab; does not scale to N entries without fragile UX.
- **Offscreen documents** — possible later; more complex for MVP “simple HTML/CSS/JS”. Defer.

## R2 — Refresh policy when opening the popup and per entry (FR-011)

**Decision**:

1. **When opening the popup**: for each entry, try to **update** in this order: (a) if a tab exists whose URL is **same origin** as the entry and path is compatible (prefix or normalized match), inject script and read the node by stored selector; (b) otherwise show **cache** from the last successful extraction with optional age indicator (“last updated”).
2. **Explicit refresh per entry**: the service worker opens an **inactive** tab (`active: false`) with the saved URL, waits for `complete`, injects the extractor, writes HTML/text to cache, closes the tab if it was created for this purpose (or leaves it open per minimal implementation preference: close to avoid clutter).

**Rationale**: Satisfies “new read on reopen” without polling. Avoids opening N hidden tabs on first pass (uses already open tabs). Manual refresh covers “I don’t have the site open”.

**Alternatives considered**:

- **Always open hidden tab per entry when opening popup** — simple but slow and intrusive; use only on refresh button.
- **Cache only with no tab matching** — does not satisfy FR-011 on open.

## R3 — Representation of the “chosen section”

**Decision**: Store a **stable CSS selector** generated at selection time (path with `nth-of-type` / similar to the clicked element) and, on first save, also persist an **initial snapshot** (sanitized `innerHTML`: remove `<script>`, `on*` attributes, `javascript:` URLs) to show immediately in the popup even before the first refresh.

**Rationale**: Balances simplicity and re-readability. Selectors break when the DOM changes — already covered in the spec (reconfigure entry).

**Alternatives considered**:

- **XPath only** — equivalent; CSS selector is familiar for debugging.
- **Crop coordinates only** — fragile with responsive layout.

## R4 — Drag cards (FR-013)

**Decision**: Include **SortableJS** (single file `vendor/sortable.min.js` or npm package copied to `extension/vendor/`) wired to the list container in `popup.html`. Persist new order with `chrome.storage.local` after `onEnd`.

**Rationale**: Drag with raw pointer events is heavy work; the spec allows one package for this. Keeps the rest vanilla.

**Alternatives considered**:

- **Native HTML5 drag-and-drop** — viable but inconsistent UX across browsers; Sortable is one file and a small API.
- **Move-up/move-down buttons only** — satisfies FR with no dependency; reserve as fallback if Sortable fails in the popup (rare).

## R5 — Permissions (FR-012)

**Decision**: Manifest V3 with `host_permissions`: `https://*/*` and `http://*/*` (or `<all_urls>` if local files are needed — probably not). `permissions`: `storage`, `scripting`, `tabs`, `activeTab` optional to reduce declarations (but for generic scraping, `tabs` + broad host is the simple path).

**Rationale**: Aligned with clarification “personal use, broad permissions”.

**Alternatives considered**: `optional_host_permissions` per domain — rejected by user in clarification.

## R6 — UI: clean, rounded corners (plan input)

**Decision**: **Neutral light** theme (background `#f4f4f5`, white cards), **border-radius 12px** on cards, **8px** on buttons and inputs, soft shadow (subtle `box-shadow`), system typography (`system-ui`), generous spacing, inline SVG or Unicode icons for actions (open, refresh, remove) to avoid an asset pipeline.

**Rationale**: Meets simple, readable design in limited popup space; all CSS, no framework.
