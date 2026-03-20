# Tasks: Unified AI usage panel (Chrome)

**Input**: Design documents from `/home/leokr/projects/ai_usage_tracking/specs/001-chrome-ai-usage-tracker/`  
**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md), [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: Not requested in the spec — no automated test tasks.

**Organization**: Phases by user story (P1 → P2 → P3), with setup and foundation first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependency on incomplete tasks in the same batch)
- **[Story]**: [US1]…[US4] in story phases

## Path Conventions

Extension code at repo root: `extension/` (see [`plan.md`](./plan.md)).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project structure and minimal static files.

- [X] T001 Create directory tree `extension/`, `extension/content/`, `extension/vendor/`, `extension/icons/` at repo root per `specs/001-chrome-ai-usage-tracker/plan.md`
- [X] T002 Create `extension/manifest.json` (MV3, `action.default_popup` → `popup.html`, `background` service worker `background.js`, `permissions`: `storage`, `scripting`, `tabs`, `host_permissions`: `https://*/*`, `http://*/*`)
- [X] T003 [P] Add placeholder toolbar icons `extension/icons/icon16.png`, `extension/icons/icon48.png`, `extension/icons/icon128.png`
- [X] T004 [P] Add SortableJS minified bundle to `extension/vendor/sortable.min.js` (official SortableJS release)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infra between popup and service worker — **no user story starts before this**.

**⚠️ CRITICAL**: Blocks all US1–US4 phases.

- [X] T005 Create `extension/storage.js` with load/save of `monitoredEntries` in `chrome.storage.local`, order normalization, and UUID helpers per `specs/001-chrome-ai-usage-tracker/data-model.md`
- [X] T006 [P] Create `extension/sanitize.js` exporting `sanitizePreviewHtml(html)` (strip `script`, `iframe`, inline event handlers, `javascript:` URLs; truncate per data-model size guidance)
- [X] T007 Create `extension/background.js` registering `chrome.runtime.onMessage`, using `importScripts('storage.js','sanitize.js')` (adjust paths relative to service worker)
- [X] T008 Create `extension/popup.html` scaffold: header with `+` control, container `#card-list`, script tags for `storage.js`, `vendor/sortable.min.js`, `popup.js`
- [X] T009 [P] Create `extension/popup.css` with design tokens (`--radius-card: 12px`, `--radius-control: 8px`), card layout, list scroll, preview `max-height` + inner scroll per plan/spec

**Checkpoint**: Foundation ready — start US1.

---

## Phase 3: User Story 1 — Add a new monitored page (Priority: P1) 🎯 MVP

**Goal**: `+` → URL → section selection in a tab → new entry in list with sample and persistence after browser restart.

**Independent Test**: A real URL (e.g. dashboard); after flow, card appears with preview; restart Chrome and confirm entry still present ([`spec.md`](./spec.md) US1).

### Implementation for User Story 1

- [X] T010 [US1] Implement `extension/content/picker.js`: full-page overlay, hover highlight, click to select element, compute CSS selector path, post message to extension with raw subtree HTML
- [X] T011 [US1] Handle `PICKER_START` in `extension/background.js`: open or focus tab for URL, `chrome.scripting.executeScript` to inject/register `extension/content/picker.js`, handle user cancel/timeout if applicable
- [X] T012 [US1] On picker completion in `extension/background.js`: run `sanitizePreviewHtml`, assemble `PICKER_RESULT` per `specs/001-chrome-ai-usage-tracker/contracts/messages.md` (selector, `pageUrl`, `title`, `faviconUrl`, `previewHtml`)
- [X] T013 [US1] Implement add flow in `extension/popup.js`: URL input (validate `http`/`https`), `chrome.runtime.sendMessage` `PICKER_START`, on success append `MonitoredEntry` with new `id`, `order` = max+1, `saveEntries` via `storage.js`
- [X] T014 [US1] Render card row in `extension/popup.js` (and minimal markup in `extension/popup.html`) showing header stub + `.preview` filled with sanitized cached HTML for each entry

**Checkpoint**: US1 functional and testable alone (MVP).

---

## Phase 4: User Story 2 — View areas, scroll, refresh, open URL, reorder (Priority: P2)

**Goal**: Vertical list with scroll in popup; refresh on open + per-entry refresh; dedicated button to open URL in new tab; manual reorder persisted (SortableJS).

**Independent Test**: Two entries; scroll; reorder and restart browser; dedicated open URL; refresh with and without open tab ([`spec.md`](./spec.md) US2, [`research.md`](./research.md) R2).

### Implementation for User Story 2

- [X] T015 [US2] Sort and render all entries by `order` in `extension/popup.js`
- [X] T016 [US2] Implement `REFRESH_ENTRY` in `extension/background.js`: prefer matching open tab by origin/URL; else inactive tab load + `executeScript` extractor using stored `selector`; return sanitized HTML / errors per `specs/001-chrome-ai-usage-tracker/research.md`
- [X] T017 [US2] On popup open in `extension/popup.js`, sequentially request refresh for entries (or single `REFRESH_ALL` handler in `extension/background.js` if implemented) and update `previewHtml` + `updatedAt` in storage
- [X] T018 [US2] Add per-card refresh control in `extension/popup.js` calling `REFRESH_ENTRY` for that `id`
- [X] T019 [US2] Add dedicated per-card “open full page” control in `extension/popup.js` using `chrome.tabs.create({ url: entry.pageUrl })` (never sole action on preview click)
- [X] T020 [US2] Initialize Sortable on `#card-list` in `extension/popup.js` (`onEnd` reindex `order`, `saveEntries`)

**Checkpoint**: US1 + US2 testable together.

---

## Phase 5: User Story 3 — Title and favicon (Priority: P3)

**Goal**: Optional title at creation; visible favicon; edit title later without losing favicon/section.

**Independent Test**: Create with automatic and manual title; edit title on existing card; favicon visible ([`spec.md`](./spec.md) US3).

### Implementation for User Story 3

- [X] T021 [US3] Extend add UI in `extension/popup.html` / `extension/popup.js` with optional custom title field; default from `PICKER_RESULT.title` when empty
- [X] T022 [US3] Display `faviconUrl` on each card header in `extension/popup.js` / `extension/popup.css` with sensible fallback when missing
- [X] T023 [US3] Implement inline title edit (e.g. double-click or edit icon) + persist `title` only in `extension/popup.js`

**Checkpoint**: US3 complete.

---

## Phase 6: User Story 4 — Easy extension to new pages (Priority: P2)

**Goal**: Same flow for any generic URL; optional references to example pages (Cursor / Codex).

**Independent Test**: Add URL different from examples; UI does not depend on a fixed domain list ([`spec.md`](./spec.md) US4, FR-009).

### Implementation for User Story 4

- [X] T024 [US4] Add empty-state or helper copy in `extension/popup.html` / `extension/popup.js` linking or listing example URLs (informational only, non-blocking) per FR-009

**Checkpoint**: US4 satisfied (mostly validation + copy; logic already generic in US1).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Errors, reconfigure, remove, manual validation.

- [X] T025 [P] Add user-visible error handling for invalid URL, load failures, and picker cancel in `extension/popup.js` and `extension/background.js`
- [X] T026 [P] Implement reconfigure flow: `PICKER_START` with `entryId` updating `pageUrl`/`selector`/`previewHtml` for that entry in `extension/background.js` + UI entry point in `extension/popup.js` per FR-010
- [X] T027 [P] Implement remove entry control + persist filtered list in `extension/popup.js` per FR-010
- [X] T028 Run full manual validation steps in `specs/001-chrome-ai-usage-tracker/quickstart.md` and adjust code or quickstart if paths differ

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends on | Notes |
|-------|------------|--------|
| Phase 1 Setup | — | Start immediately |
| Phase 2 Foundational | Phase 1 | Blocks all user stories |
| Phase 3 US1 | Phase 2 | MVP |
| Phase 4 US2 | Phase 2, US1 (needs cards/list) | Builds on US1 render/storage |
| Phase 5 US3 | Phase 2, US1 (cards exist) | Can start after T014 |
| Phase 6 US4 | Phase 2, US1 | Copy-only; parallelizable after T014 conceptually |
| Phase 7 Polish | US1–US4 desired scope | Reconfigure/remove need stable list |

### User Story Dependencies

```text
US1 (P1) ──► US2 (P2)   [list/refresh/reorder/open need entries + render]
US1 (P1) ──► US3 (P3)   [title/favicon on cards]
US1 (P1) ──► US4 (P2)   [generic flow already in US1; US4 is UX hints]
```

### Parallel Opportunities

- **Phase 1**: T003 and T004 in parallel (after T001–T002).
- **Phase 2**: T006 and T009 in parallel with T005 (different files); T007 after T005–T006.
- **Phase 7**: T025, T026, T027 in parallel if different file sections and careful merges.

### Parallel Example: Phase 2

```text
# After T001–T002, in parallel:
T003 — extension/icons/*.png
T004 — extension/vendor/sortable.min.js

# After T005 started, in parallel where possible:
T006 — extension/sanitize.js
T009 — extension/popup.css
```

### Parallel Example: User Story 1

```text
T010 — extension/content/picker.js (can be developed in parallel with T008 refinements,
       but T011 integration needs T007 + T010 complete)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 + Phase 2  
2. Complete Phase 3 (US1)  
3. **STOP** — validate with [`quickstart.md`](./quickstart.md) add + persistence scenario  

### Incremental Delivery

1. US1 → MVP  
2. US2 → full panel (scroll, refresh, open, drag)  
3. US3 → polish per-card identity  
4. US4 → example hints  
5. Phase 7 → errors, reconfigure, remove, final checklist  

---

## Notes

- Each task includes an explicit file path for agent/LLM execution.  
- Message contracts: [`contracts/messages.md`](./contracts/messages.md).  
- Storage schema: [`contracts/storage.schema.json`](./contracts/storage.schema.json).  

---

## Task summary

| Metric | Value |
|--------|--------|
| **Total tasks** | 28 |
| **Phase 1** | 4 |
| **Phase 2** | 5 |
| **US1** | 5 |
| **US2** | 6 |
| **US3** | 3 |
| **US4** | 1 |
| **Polish** | 4 |
| **Parallel-marked [P]** | 9 |
