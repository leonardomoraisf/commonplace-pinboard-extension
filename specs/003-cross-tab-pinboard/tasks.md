---

description: "Task list for Cross-tab information pinboard (003)"
---

# Tasks: Cross-tab information pinboard

**Input**: Design documents from `/specs/003-cross-tab-pinboard/`
**Prerequisites**: [`plan.md`](./plan.md) (required), [`spec.md`](./spec.md) (required for user stories)

**Tests**: Not included — [`spec.md`](./spec.md) and [`plan.md`](./plan.md) specify manual validation in Chrome and optional isolated helper tests only; no TDD or automated test mandate for this feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label ([US1]–[US4]) for story phases only
- Include exact file paths in descriptions

## Path Conventions (this repo)

Chrome MV3 extension under `extension/` with `manifest.json`, service worker, popup, content script, `extension/storage.js`, optional `extension/vendor/sortable.min.js`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline tooling and extension layout before design and implementation.

- [ ] T001 Verify MV3 wiring (popup, service worker, content script, permissions) matches pinboard scope in `extension/manifest.json`
- [ ] T002 [P] Confirm `npm test` and `npm run lint` scripts and dependencies at repository root `package.json`
- [ ] T003 [P] Confirm `extension/vendor/sortable.min.js` and `extension/sanitize.js` remain valid for reuse in pin capture and list reorder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Design contracts and shared pin storage/messaging must exist before user-story work.

**⚠️ CRITICAL**: No user story implementation should proceed until design artifacts and `extension/storage.js` / `extension/background.js` pin alignment are in place per [`plan.md`](./plan.md).

- [ ] T004 Capture rework decisions (single vs multi capture per session, minimum pin shape, refresh behavior, visual repositioning criteria) in `specs/003-cross-tab-pinboard/research.md`
- [ ] T005 Define `Pin` and source-reference fields, normalization, and migration from legacy monitored-entry semantics in `specs/003-cross-tab-pinboard/data-model.md`
- [ ] T006 [P] Document popup ↔ background ↔ content script message names and payloads after pin-oriented rename in `specs/003-cross-tab-pinboard/contracts/messages.md`
- [ ] T007 [P] Define persisted pin collection JSON shape for `chrome.storage.local` in `specs/003-cross-tab-pinboard/contracts/storage.schema.json`
- [ ] T008 [P] Describe manual flows (create, cross-tab read, rename, remove, reorder, reopen, refresh failures) in `specs/003-cross-tab-pinboard/quickstart.md`
- [ ] T009 Implement pin load/save/normalize (replacing `monitoredEntries`-oriented behavior) in `extension/storage.js` per `data-model.md` and `storage.schema.json`
- [ ] T010 Align service worker routing, message names, and payloads for pin lifecycle operations in `extension/background.js` per `contracts/messages.md`

**Checkpoint**: Foundation ready — user story phases can begin.

---

## Phase 3: User Story 1 - Pin information from a page (Priority: P1) 🎯 MVP (partial)

**Goal**: User can capture visible content from the active tab, optionally label it, and save a new pin without leaving the page; multiple pins from the same page are independent.

**Independent Test**: On any `http`/`https` page with visible content, create a pin and confirm it is saved with recognizable content, default or custom title, and source context.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Adapt picker output to a single saved pin snapshot per save action (and session behavior per `research.md`) in `extension/content/picker.js`
- [ ] T012 [US1] Implement pin creation flow: capture confirmation, custom title, default title from page or content, and messaging to background/storage in `extension/popup.js`
- [ ] T013 [P] [US1] Replace AI-centric creation UI copy and structure with pin-centric, general-purpose labels in `extension/popup.html`
- [ ] T014 [P] [US1] Restyle creation-related popup regions for neutral pinboard identity (not AI tracker) in `extension/popup.css`
- [ ] T015 [US1] Provide clear feedback when capture fails or content is not meaningful, without altering existing pins, in `extension/content/picker.js` and `extension/popup.js`

**Checkpoint**: New pins can be created from arbitrary pages with FR-001–FR-005, FR-015, FR-016 (capture path), FR-017–FR-020 (creation UI) addressed for this flow.

---

## Phase 4: User Story 2 - Reuse pinned information from any other tab (Priority: P1) 🎯 MVP

**Goal**: Saved pins are visible and readable from any tab via the extension surface; list is scannable with title, source context, and compact preview.

**Independent Test**: Save a pin in one tab, switch to another tab, open the extension, and verify the same pin content and context appear without returning to the source tab.

### Implementation for User Story 2

- [ ] T016 [US2] Load and render all persisted pins with compact preview and source reference in `extension/popup.js`
- [ ] T017 [P] [US2] Structure pin list markup for scanning (title, preview, source cues) in `extension/popup.html`
- [ ] T018 [P] [US2] Style list and preview for neutral general-purpose pinboard in `extension/popup.css`
- [ ] T019 [US2] Ensure cross-tab read uses persisted storage only (pins survive source tab closure) in `extension/popup.js` and `extension/storage.js`

**Checkpoint**: FR-003, FR-006, FR-007, FR-008 (read path), FR-012 (display of timestamps may be completed in US4), FR-016 (read path) satisfied for cross-tab access.

---

## Phase 5: User Story 3 - Organize and maintain pins over time (Priority: P2)

**Goal**: User can rename, reorder, remove pins, and reopen the original page from a pin; changes persist.

**Independent Test**: With at least three pins, rename one, reorder, remove another, reopen source from a pin; reopen extension and confirm persistence.

### Implementation for User Story 3

- [ ] T020 [P] [US3] Implement rename with persisted title in `extension/popup.js` and `extension/storage.js`
- [ ] T021 [P] [US3] Integrate `extension/vendor/sortable.min.js` for drag reorder and persist order in `extension/popup.js` and `extension/popup.html`
- [ ] T022 [US3] Implement remove-pin action without affecting other pins in `extension/popup.js` and `extension/storage.js`
- [ ] T023 [US3] Implement “open source URL” from a pin via background tab handling in `extension/background.js` and `extension/popup.js`

**Checkpoint**: FR-008–FR-011 and organize acceptance scenarios for US3 are met.

---

## Phase 6: User Story 4 - Keep pinned information trustworthy (Priority: P2)

**Goal**: User sees snapshot vs live distinction, last refreshed/captured time, successful refresh/re-pin or clear failure and recapture guidance.

**Independent Test**: Refresh or re-pin from source when possible; when source cannot be matched, last snapshot remains with clear messaging; timestamps visible.

### Implementation for User Story 4

- [ ] T024 [US4] Display created and last-refreshed/captured timestamps on each pin in `extension/popup.js` and `extension/popup.html`
- [ ] T025 [US4] Implement refresh or re-capture from source (picker + background + popup) in `extension/content/picker.js`, `extension/background.js`, and `extension/popup.js`
- [ ] T026 [US4] On refresh failure or structural mismatch, preserve last saved content and show clear recapture guidance in `extension/popup.js`
- [ ] T027 [P] [US4] Style error/stale/trust states in `extension/popup.css`

**Checkpoint**: FR-012–FR-014 and US4 acceptance scenarios satisfied; edge cases for auth loss and invalid URLs covered per [`spec.md`](./spec.md).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Extension metadata, documentation, and validation across stories.

- [ ] T028 [P] Update extension name, description, and any user-visible strings still implying AI-only scope in `extension/manifest.json`
- [ ] T029 [P] Align product description with pinboard positioning at repository root `README.md`
- [ ] T030 Execute and reconcile gaps against manual steps in `specs/003-cross-tab-pinboard/quickstart.md`
- [ ] T031 Run `npm test && npm run lint` from repository root and fix any regressions introduced by this feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **blocks** all user stories.
- **User stories (Phases 3–6)**: Depend on Foundational completion. US1 → US2 is the natural MVP vertical slice (create then read elsewhere); US3 and US4 extend behavior and trust UI.
- **Polish (Phase 7)**: Depends on all targeted user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on other stories; enables saving pins.
- **User Story 2 (P1)**: After Foundational; **practically** validates after US1 for E2E cross-tab read, but list/render logic can be built against stored pins independently.
- **User Story 3 (P2)**: After US1–US2 for meaningful manage/reorder UX on a populated list; persistence APIs from Foundational.
- **User Story 4 (P2)**: After US1–US2 minimum; refresh builds on storage and picker/background contracts.

### Within Each User Story

- Contracts (`data-model`, `messages`, `storage`) before behavior that depends on them.
- HTML structure and CSS can proceed in parallel where marked [P].
- Core logic in `extension/popup.js` before closing the checkpoint.

### Parallel Opportunities

- **Phase 1**: T002, T003 parallel with each other after T001 or in parallel if different concerns.
- **Phase 2**: T006, T007, T008 parallel; T004 → T005 can precede or overlap T006–T008 once decisions exist.
- **Phase 2**: After T009 schema is stable, coordinate T010 (same story: messaging + storage).
- **US1**: T013, T014 parallel; T011 parallel with T013/T014 if picker contract is fixed in Foundational.
- **US2**: T017, T018 parallel.
- **US3**: T020, T021 parallel.
- **US4**: T027 parallel with T024–T026 once copy is known.
- **Phase 7**: T028, T029 parallel.

---

## Parallel Example: User Story 1

```bash
# After T011 and T012 are specified/merged, parallel UI work:
Task: "Replace AI-centric creation UI copy in extension/popup.html"
Task: "Restyle creation-related regions in extension/popup.css"
```

## Parallel Example: User Story 2

```bash
Task: "Structure pin list markup in extension/popup.html"
Task: "Style list and preview in extension/popup.css"
```

## Parallel Example: User Story 3

```bash
Task: "Implement rename in extension/popup.js and extension/storage.js"
Task: "Integrate SortableJS reorder in extension/popup.js and extension/popup.html"
```

---

## Implementation Strategy

### MVP First (P1 stories: US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (design artifacts + `extension/storage.js` + `extension/background.js`)
3. Complete Phase 3: User Story 1 (create pins from pages)
4. Complete Phase 4: User Story 2 (cross-tab list and preview)
5. **STOP and VALIDATE**: Manual checks from `quickstart.md` for create + cross-tab read (SC-001, SC-002)
6. Ship or demo MVP

### Incremental Delivery

1. Setup + Foundational → stable pin model and messages
2. Add US1 → pins can be created
3. Add US2 → full cross-tab value (recommended **MVP**)
4. Add US3 → curation and reopen
5. Add US4 → trust, refresh, failure transparency
6. Polish → manifest, README, lint/test gate

### Parallel Team Strategy

After Foundational:

- Developer A: US1 (picker + create path in popup)
- Developer B: US2 (list rendering + styles) — coordinate on `popup.html` / `popup.js` merge order to avoid conflicts

---

## Notes

- [P] tasks assume no conflicting edits to the same file in parallel.
- Visual rework (FR-017–FR-020) is **in scope** in US1/US2 UI tasks, not deferred to Phase 7 alone; Phase 7 catches manifest/README and validation.
- Each task ID is sequential; story labels apply only to Phases 3–6.
