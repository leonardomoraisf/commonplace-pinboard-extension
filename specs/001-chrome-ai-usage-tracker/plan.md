# Implementation Plan: Unified AI usage panel (Chrome)

**Branch**: `001-chrome-ai-usage-tracker` | **Date**: 2026-03-19 | **Spec**: [`spec.md`](./spec.md)  
**Input**: Feature specification + clarifications (popup, refresh, broad permissions, reordering, dedicated open URL) + **HTML/CSS/JavaScript** stack; **SortableJS** allowed for drag; **clean** UI, rounded corners.

## Summary

Build a **Chrome Manifest V3** **popup** extension that lists **cards** (one **monitored entry** per card): title, favicon, **sample** of the section (sanitized HTML in cache), **open URL** (new tab), **refresh**, **edit title**, **reconfigure/remove**, and **+** for a new URL with **selection flow** in a real tab. Persistence in **`chrome.storage.local`**. **No** UI frameworks; **SortableJS** (file in `vendor/`) for **persisted** reordering. Preview **does not** use cross-origin iframe; uses **content scripts** / tabs with profile cookies and a stored **CSS selector** (see [`research.md`](./research.md)).

## Technical Context

**Language/Version**: JavaScript (ES2020+), HTML5, CSS3 — no mandatory TypeScript/build for MVP.  
**Primary Dependencies**: **SortableJS** (only optional JS dependency, local copy); Chrome APIs (MV3).  
**Storage**: `chrome.storage.local` — schema in [`contracts/storage.schema.json`](./contracts/storage.schema.json) and [`data-model.md`](./data-model.md).  
**Testing**: Manual per [`quickstart.md`](./quickstart.md); optional automated tests (e.g. pure sanitization functions in a file testable with `node:test`).  
**Target Platform**: Google Chrome (MV3).  
**Project Type**: browser-extension (popup + service worker + content scripts).  
**Performance Goals**: Popup usable with up to ~10 entries; sequential refresh acceptable (no continuous polling).  
**Constraints**: Simple stack (author request); popup with limited height/width — global scroll + per-sample internal scroll; **broad** permissions `https://*/*` (and `http` if needed) aligned with FR-012.  
**Scale/Scope**: 1 user, ~10–20 entries, samples with limited HTML cache (~500KB per entry recommended).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) **v1.0.0** (2026-03-19).

| Principle | Status |
|-----------|--------|
| I. Plain web platform MVP | **Pass** — ES2020+ HTML/CSS/JS; SortableJS in `vendor/`; no mandatory TS/build. |
| II. Chrome Manifest V3 compliance | **Pass** — MV3, service worker, documented permissions. |
| III. Contract-first storage and messaging | **Pass** — `contracts/storage.schema.json`, `contracts/messages.md`. |
| IV. Testing and lint discipline | **Pass** — `quickstart.md` for manual; optional auto tests until `package.json` exists. |
| V. Specification-driven delivery | **Pass** — plan derived from `spec.md` and branch `001-chrome-ai-usage-tracker`. |

**Post-phase 1**: Design aligns with simplicity (vanilla + one vendor script); no extra projects.

## Project Structure

### Documentation (this feature)

```text
specs/001-chrome-ai-usage-tracker/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── messages.md
│   └── storage.schema.json
└── tasks.md              # (/speckit.tasks — not created by this command)
```

### Source Code (repository root)

```text
extension/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
├── content/
│   └── picker.js
├── vendor/
│   └── sortable.min.js
└── icons/
    └── icon16.png … (placeholders)
```

**Structure Decision**: Repository with a single **`extension/`** folder at project root for Chrome-loadable code; specs and contracts stay in **`specs/001-chrome-ai-usage-tracker/`**.

## Phase 0 & Phase 1 outputs

| Artifact | Path | Status |
|----------|------|--------|
| Research (decisions) | [`research.md`](./research.md) | Complete |
| Data model | [`data-model.md`](./data-model.md) | Complete |
| Contracts | [`contracts/messages.md`](./contracts/messages.md), [`contracts/storage.schema.json`](./contracts/storage.schema.json) | Complete |
| Quickstart | [`quickstart.md`](./quickstart.md) | Complete |

## Implementation notes (high level)

1. **`manifest.json`**: `manifest_version` 3; `action.default_popup` → `popup.html`; `background` service worker `background.js`; `permissions`: `storage`, `scripting`, `tabs`; `host_permissions`: `https://*/*`, `http://*/*`; `content_scripts` only if needed for broad match patterns — prefer dynamic **`scripting.executeScript`** in picker/refresh to control when it runs.
2. **Picker**: on `PICKER_START`, open tab with URL; inject `picker.js`; overlay with highlight; click → compute selector + extract HTML → sanitize → `PICKER_RESULT` to popup.
3. **Sanitization**: remove `<script>`, `<iframe>`, event handlers, `javascript:`; truncate large strings (see data-model).
4. **Popup UI**: list `#card-list`; card with header (favicon, editable title, open/refresh/menu buttons); body with `.preview` (scroll, max-height); **Sortable** on list; **+** fixed at top.
5. **Refresh**: implement logic from [`research.md`](./research.md) R2 (tab match first; cache; inactive tab on explicit refresh).
6. **Design**: CSS variables (`--radius-card: 12px`, `--radius-control: 8px`, `--bg`, `--card`, `--border`, `--accent`); visible focus; reasonable contrast.

## Complexity Tracking

Constitution gates N/A; no violations to justify. Table omitted.

## Next step

Run **`/speckit.tasks`** to generate `tasks.md` from this plan.
