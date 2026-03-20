<!--
Sync Impact Report
Version: (template placeholders) → 1.0.0
Principles: placeholder slots → I–V (Plain web MVP, MV3, Contracts, Test/lint, Spec-driven)
Added sections: Technology & platform constraints; Quality gates & documentation (filled)
Removed sections: none
Templates: .specify/templates/plan-template.md ✅ | spec-template.md ✅ | tasks-template.md ✅
Commands: .specify/templates/commands/* — not present in repo (N/A)
Runtime docs: README.md ⚠ missing at repo root; no change applied
Follow-up: none; ratification date set to first feature plan date (2026-03-19)
-->

# AI Usage Tracking Constitution

## Core Principles

### I. Plain web platform MVP

- The default implementation stack MUST be **JavaScript (ES2020+)**, **HTML5**, and **CSS3** for browser-facing code unless the
  feature specification explicitly requires otherwise.
- **TypeScript**, bundlers, and SPA frameworks are **not** required for MVP unless the spec names them; introducing them
  MUST be justified in the feature `plan.md` **Constitution Check** (or **Complexity Tracking**).
- Any third-party JavaScript used in the extension MUST be **vendored** under a path documented in `plan.md` (e.g.
  `extension/vendor/`), not loaded from a CDN at runtime.
- **Rationale:** Keeps “Load unpacked” workflows fast and matches the agreed simple stack for this project.

### II. Chrome Manifest V3 compliance

- Deliverables that ship as a Chrome extension MUST target **Manifest V3** (`manifest_version` 3, service worker
  background, MV3-aligned APIs).
- `manifest.json` permissions and host permissions MUST match the feature **spec** and **plan** (no undocumented
  expansion).
- Extension surfaces (popup, service worker, content scripts or `scripting` usage) MUST be described in `plan.md` so
  reviewers can verify MV3 feasibility.
- **Rationale:** MV3 is the supported extension model; alignment avoids store and runtime rejection.

### III. Contract-first storage and messaging

- Before implementation relies on persisted data or cross-context messages, the feature MUST define them under
  `specs/<feature>/contracts/` (e.g. JSON Schema for storage, message naming/payloads in `messages.md` or equivalent).
- Runtime code MUST NOT change stored shapes or message contracts without updating those artifacts and the feature
  **data-model** / **plan** as needed.
- **Rationale:** Prevents desync between popup, service worker, and optional content scripts.

### IV. Testing and lint discipline

- If `package.json` defines **`npm test`** and/or **`npm run lint`**, changes MUST keep **both** scripts passing for the
  paths they cover before merge.
- While those scripts are absent, each feature MUST provide **manual verification** steps in `quickstart.md` that cover at
  least the **P1** user story end-to-end.
- Automated tests MUST be added when the feature specification explicitly requires them; until then, extraction of
  testable pure logic (e.g. sanitization helpers) into modules covered by `node:test` is encouraged but not mandatory.
- **Rationale:** Matches the repo’s quality bar once tooling exists; documents how to validate before automation lands.

### V. Specification-driven delivery

- Implementation work MUST trace to **`spec.md`** user stories and functional requirements for the active feature branch.
- **`plan.md`** MUST exist before substantial coding and MUST reference the constitution **Constitution Check** gates.
- **`tasks.md`** MUST group work by user story (via `/speckit.tasks` or equivalent) so each story remains independently
  demonstrable unless **Complexity Tracking** documents why not.
- **Rationale:** Preserves Speckit traceability from need → design → tasks → code.

## Technology & platform constraints

- Primary product channel for this codebase is a **Google Chrome** extension; specs may name Chrome when it is the
  delivery surface (product), while staying free of unnecessary implementation detail elsewhere.
- Source layout for loadable extension assets MUST follow the paths declared in the feature `plan.md` (e.g. a single
  `extension/` tree with `manifest.json`, popup assets, service worker, optional `content/`, `vendor/`, `icons/`).
- Untrusted HTML captured from web pages MUST be **sanitized** and bounded per the feature **research** and **data-model**
  (e.g. strip executable content, size limits); implementation MUST NOT execute raw page scripts in the extension UI.
- **Rationale:** Security and UX constraints are inherent to the product; they are non-negotiable at the feature level.

## Quality gates & documentation

- Every **`plan.md`** MUST include a **Constitution Check** that states pass/fail (or justified waiver via **Complexity
  Tracking**) for each core principle.
- Feature **checklists** (e.g. requirements quality) MUST remain consistent with spec rules: technology-agnostic wording
  in the spec body except where the product channel itself is a requirement.
- Agent and editor guidance (e.g. `.cursor/rules/specify-rules.mdc`) SHOULD be updated when the constitution changes
  materially so day-to-day commands stay aligned.
- **Rationale:** Gates turn principles into actionable review steps.

## Governance

- This constitution supersedes conflicting informal practices in this repository for scope, stack, and Speckit workflow.
- **Amendments:** edit `.specify/memory/constitution.md`, bump **Version** per semantic rules below, refresh the **Sync
  Impact Report** HTML comment at the top, and update dependent templates or active feature plans when gates or section
  names change.
- **Versioning (this document):** **MAJOR** — removal or incompatible redefinition of a principle or governance rule;
  **MINOR** — new principle or materially expanded section; **PATCH** — clarifications, typos, non-semantic wording.
- **Compliance:** Authors and reviewers MUST verify the **Constitution Check** on new or revised `plan.md` files; agents
  running Speckit commands MUST treat failures as blockers unless **Complexity Tracking** records an approved exception.
- **Runtime guidance:** Use `.cursor/rules/specify-rules.mdc` (or successor) plus each feature’s `quickstart.md` for
  day-to-day development.

**Version**: 1.0.0 | **Ratified**: 2026-03-19 | **Last Amended**: 2026-03-19
