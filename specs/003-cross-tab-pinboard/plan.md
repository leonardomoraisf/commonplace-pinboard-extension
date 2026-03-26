# Implementation Plan: Cross-tab information pinboard

**Branch**: `003-cross-tab-pinboard` | **Date**: 2026-03-26 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from [`spec.md`](./spec.md)

## Summary

Rework the current AI usage tracker into a general-purpose cross-tab pinboard without changing the core technical
approach already established in the repository. The implementation stays on the existing Chrome MV3 extension
architecture and repurposes the current popup, background worker, content picker, storage layer, and local SortableJS
integration to store and present pinned information captured from arbitrary pages. This includes an explicit visual
rework: the popup must stop presenting itself as an AI-focused usage tool and instead read as a neutral, general-purpose
pinboard for arbitrary web content.

The visual repositioning is part of the implementation scope, not a later polish pass. The plan must therefore treat
UI copy, hierarchy, and styling changes as first-class work needed to complete the feature.

## Technical Context

**Language/Version**: JavaScript (ES2020+), HTML5, CSS3 — no TypeScript, no build step.  
**Primary Dependencies**: Chrome Extension APIs (MV3), local `SortableJS` bundle only if drag-reorder remains needed.  
**Storage**: `chrome.storage.local` via the existing shared storage module pattern in `extension/storage.js`.  
**Testing**: Manual validation in Chrome extension flow; optional small automated coverage only for isolated pure helpers.  
**Target Platform**: Google Chrome (MV3).  
**Project Type**: Browser extension with popup, background service worker, and content script picker.  
**Performance Goals**: Pin creation remains responsive for first-time use; popup remains scannable with ~20 saved pins.  
**Constraints**: Preserve current stack and code style; prefer renaming/refactoring existing modules over introducing new
frameworks, build tooling, or alternate persistence layers. The visual redesign must happen within the existing popup
architecture rather than through a separate UI stack or parallel app shell.  
**Scale/Scope**: Single-user local pinboard for saved snapshots and source metadata across arbitrary `http`/`https` tabs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|-----------|--------|
| I. Plain web platform MVP | **Pass** — rework remains in vanilla JS/HTML/CSS with no new framework or build tooling. |
| II. Chrome Manifest V3 compliance | **Pass** — popup, service worker, content script, and permissions continue within MV3. |
| III. Contract-first storage and messaging | **Pass** — storage schema and runtime messages can evolve from the existing shared-module pattern. |
| IV. Testing and lint discipline | **Pass** — manual quickstart remains primary, with optional isolated helper tests. |
| V. Specification-driven delivery | **Pass** — this plan is derived from [`spec.md`](./spec.md) and constrained by the current repo conventions. |

## Project Structure

```text
extension/
  background.js
  content/picker.js
  manifest.json
  popup.html
  popup.css
  popup.js
  sanitize.js
  storage.js
  vendor/sortable.min.js
specs/003-cross-tab-pinboard/
  checklists/
  plan.md
  spec.md
```

## Implementation Strategy

### Reuse-first rework

1. Keep the current extension surface centered on the popup and adapt the wording, data model, and actions from
   “tracked sections” to “pins”.
2. Reuse the existing content selection flow in `extension/content/picker.js` as the capture mechanism, but simplify the
   mental model from multi-field dashboard monitoring to saved content snapshots.
3. Keep `extension/background.js` as the orchestrator for tab opening, picker injection, message passing, and optional
   refresh/reopen actions.
4. Evolve `extension/storage.js` from `monitoredEntries` semantics to a pin-oriented collection while preserving the same
   load/save/normalize responsibilities.
5. Refactor `extension/popup.js`, `extension/popup.html`, and `extension/popup.css` in place instead of creating a new
   app shell or parallel UI implementation.

### Visual rework mandate

1. Treat the move away from AI-specific positioning as a required product rework, not as optional polish.
2. Remove AI-specific product framing, labels, explanatory copy, and empty-state messaging from the popup experience.
3. Rework the current visual identity so the extension feels suitable for general web capture and retrieval, not AI
   usage tracking.
4. Keep the existing implementation pattern, but use the rework to improve clarity of hierarchy, card scanning, and
   source-context readability in a more generalist interface.
5. Prefer adapting the current DOM/CSS structure over introducing a second UI architecture just for redesign purposes.

### Likely file-level impact

- `extension/popup.html`: Rename AI-centric UI copy, adjust hierarchy, and simplify structure around pin creation, pin
  list, source metadata, and saved preview/full-content affordances.
- `extension/popup.css`: Rework the popup's visual language from AI tracker styling to a more neutral general-purpose
  pinboard while preserving current DOM class strategy where practical.
- `extension/popup.js`: Replace entry/field-centric state transitions with pin-centric create/view/manage flows, reusing
  the current render/event-delegation approach and updating user-facing strings to match the generalist positioning.
- `extension/content/picker.js`: Keep the selection overlay pattern, but adjust capture output to a single saved pin
  snapshot per save action rather than a dashboard field bundle.
- `extension/storage.js`: Update normalization and defaults for pin entities, order, timestamps, saved content, compact
  preview, and source metadata.
- `extension/background.js`: Preserve message routing and browser-tab operations, updating message names and payloads only
  where required by the new pin model.
- `extension/manifest.json`: Minimal changes only if labels or permissions must be tightened or clarified for the rework.

## Phase 0: Research

Focus only on decisions required to rework the current implementation cleanly:

- Decide whether the current multi-field picker flow should become strictly single-pin-per-save or still allow repeated
  capture within one picker session.
- Decide the minimum stored content shape for each pin: preview text, sanitized snapshot, source URL, source title,
  favicon, timestamps, and optional custom title.
- Decide how refresh behaves when the source page is unavailable or structurally changed, while preserving the saved
  snapshot as the primary value.
- Decide how far the popup copy and visual hierarchy need to change so the product clearly stops reading as AI-specific.
- Define explicit UI/content criteria that make the popup read as a general-purpose pinboard rather than a repackaged AI
  tracker.

## Phase 1: Design

Produce only the artifacts needed to implement the rework on top of the current codebase:

- `research.md`: Capture the rework decisions above and justify reuse of the current architecture.
- `data-model.md`: Define the new pin entity and normalization rules replacing the old monitored-entry model.
- `contracts/messages.md`: Document popup/background/content-script message payloads after the pin-oriented rename.
- `contracts/storage.schema.json`: Define the persisted pin collection in `chrome.storage.local`.
- `quickstart.md`: Describe the manual flow for create, view from another tab, rename, remove, reopen, and failure cases.
- Design notes should explicitly cover the generalist visual repositioning of the popup, not only the storage and flow
  changes.
- The design outputs must make the visual rework auditable, including which legacy AI-oriented labels/cues are removed
  and what general-purpose replacements are expected.

## Phase 0 & Phase 1 outputs

**Expected deliverables before implementation**:

- Updated research and design docs under `specs/003-cross-tab-pinboard/`
- A storage contract aligned with the reworked pin model
- A runtime messaging contract aligned with the existing MV3 flow
- A manual quickstart proving the feature still fits the current extension architecture

**Post-phase 1**: Design should still fit the current repository shape with no new top-level application, framework,
build pipeline, or storage backend.
