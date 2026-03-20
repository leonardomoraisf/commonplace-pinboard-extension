# Tasks: Painel unificado de uso de IA (Chrome)

**Input**: Design documents from `/home/leokr/projects/ai_usage_tracking/specs/001-chrome-ai-usage-tracker/`  
**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md), [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: Não solicitados na spec — sem tarefas de teste automático.

**Organization**: Fases por user story (P1 → P2 → P3), com setup e fundação primeiro.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Paralelizável (ficheiros diferentes, sem dependência de tarefas incompletas do mesmo lote)
- **[Story]**: [US1]…[US4] nas fases de histórias

## Path Conventions

Código da extensão na raiz do repo: `extension/` (ver [`plan.md`](./plan.md)).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estrutura do projeto e ficheiros estáticos mínimos.

- [X] T001 Create directory tree `extension/`, `extension/content/`, `extension/vendor/`, `extension/icons/` at repo root per `specs/001-chrome-ai-usage-tracker/plan.md`
- [X] T002 Create `extension/manifest.json` (MV3, `action.default_popup` → `popup.html`, `background` service worker `background.js`, `permissions`: `storage`, `scripting`, `tabs`, `host_permissions`: `https://*/*`, `http://*/*`)
- [X] T003 [P] Add placeholder toolbar icons `extension/icons/icon16.png`, `extension/icons/icon48.png`, `extension/icons/icon128.png`
- [X] T004 [P] Add SortableJS minified bundle to `extension/vendor/sortable.min.js` (official SortableJS release)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infra partilhada entre popup e service worker — **nenhuma user story começa antes disto**.

**⚠️ CRITICAL**: Bloqueia todas as fases US1–US4.

- [X] T005 Create `extension/storage.js` with load/save of `monitoredEntries` in `chrome.storage.local`, order normalization, and UUID helpers per `specs/001-chrome-ai-usage-tracker/data-model.md`
- [X] T006 [P] Create `extension/sanitize.js` exporting `sanitizePreviewHtml(html)` (strip `script`, `iframe`, inline event handlers, `javascript:` URLs; truncate per data-model size guidance)
- [X] T007 Create `extension/background.js` registering `chrome.runtime.onMessage`, using `importScripts('storage.js','sanitize.js')` (adjust paths relative to service worker)
- [X] T008 Create `extension/popup.html` scaffold: header with `+` control, container `#card-list`, script tags for `storage.js`, `vendor/sortable.min.js`, `popup.js`
- [X] T009 [P] Create `extension/popup.css` with design tokens (`--radius-card: 12px`, `--radius-control: 8px`), card layout, list scroll, preview `max-height` + inner scroll per plan/spec

**Checkpoint**: Fundação pronta — iniciar US1.

---

## Phase 3: User Story 1 — Adicionar uma nova página monitorizada (Priority: P1) 🎯 MVP

**Goal**: Fluxo `+` → URL → seleção de secção num separador → nova entrada na lista com amostra e persistência após reabrir o browser.

**Independent Test**: Um URL real (ex. dashboard); após fluxo, cartão aparece com pré-visualização; reiniciar Chrome e confirmar entrada ainda presente ([`spec.md`](./spec.md) US1).

### Implementation for User Story 1

- [X] T010 [US1] Implement `extension/content/picker.js`: full-page overlay, hover highlight, click to select element, compute CSS selector path, post message to extension with raw subtree HTML
- [X] T011 [US1] Handle `PICKER_START` in `extension/background.js`: open or focus tab for URL, `chrome.scripting.executeScript` to inject/register `extension/content/picker.js`, handle user cancel/timeout if applicable
- [X] T012 [US1] On picker completion in `extension/background.js`: run `sanitizePreviewHtml`, assemble `PICKER_RESULT` per `specs/001-chrome-ai-usage-tracker/contracts/messages.md` (selector, `pageUrl`, `title`, `faviconUrl`, `previewHtml`)
- [X] T013 [US1] Implement add flow in `extension/popup.js`: URL input (validate `http`/`https`), `chrome.runtime.sendMessage` `PICKER_START`, on success append `MonitoredEntry` with new `id`, `order` = max+1, `saveEntries` via `storage.js`
- [X] T014 [US1] Render card row in `extension/popup.js` (and minimal markup in `extension/popup.html`) showing header stub + `.preview` filled with sanitized cached HTML for each entry

**Checkpoint**: US1 funcional e testável sozinha (MVP).

---

## Phase 4: User Story 2 — Ver áreas, scroll, refresh, abrir URL, reordenar (Priority: P2)

**Goal**: Lista vertical com scroll no popup; refresh ao abrir + refresh por entrada; botão dedicado abrir URL em novo separador; reordenação manual persistida (SortableJS).

**Independent Test**: Duas entradas; scroll; reordenar e reiniciar browser; abrir URL dedicado; refresh com e sem separador aberto ([`spec.md`](./spec.md) US2, [`research.md`](./research.md) R2).

### Implementation for User Story 2

- [X] T015 [US2] Sort and render all entries by `order` in `extension/popup.js`
- [X] T016 [US2] Implement `REFRESH_ENTRY` in `extension/background.js`: prefer matching open tab by origin/URL; else inactive tab load + `executeScript` extractor using stored `selector`; return sanitized HTML / errors per `specs/001-chrome-ai-usage-tracker/research.md`
- [X] T017 [US2] On popup open in `extension/popup.js`, sequentially request refresh for entries (or single `REFRESH_ALL` handler in `extension/background.js` if implemented) and update `previewHtml` + `updatedAt` in storage
- [X] T018 [US2] Add per-card refresh control in `extension/popup.js` calling `REFRESH_ENTRY` for that `id`
- [X] T019 [US2] Add dedicated per-card “open full page” control in `extension/popup.js` using `chrome.tabs.create({ url: entry.pageUrl })` (never sole action on preview click)
- [X] T020 [US2] Initialize Sortable on `#card-list` in `extension/popup.js` (`onEnd` reindex `order`, `saveEntries`)

**Checkpoint**: US1 + US2 testáveis em conjunto.

---

## Phase 5: User Story 3 — Título e favicon (Priority: P3)

**Goal**: Título opcional na criação; favicon visível; editar título depois sem perder favicon/secção.

**Independent Test**: Criar com título automático e manual; editar título num cartão existente; favicon visível ([`spec.md`](./spec.md) US3).

### Implementation for User Story 3

- [X] T021 [US3] Extend add UI in `extension/popup.html` / `extension/popup.js` with optional custom title field; default from `PICKER_RESULT.title` when empty
- [X] T022 [US3] Display `faviconUrl` on each card header in `extension/popup.js` / `extension/popup.css` with sensible fallback when missing
- [X] T023 [US3] Implement inline title edit (e.g. double-click or edit icon) + persist `title` only in `extension/popup.js`

**Checkpoint**: US3 completa.

---

## Phase 6: User Story 4 — Extensão fácil a novas páginas (Priority: P2)

**Goal**: Mesmo fluxo para qualquer URL genérico; referências opcionais às páginas exemplo (Cursor / Codex).

**Independent Test**: Adicionar URL diferente dos exemplos; UI não depende de lista fixa de domínios ([`spec.md`](./spec.md) US4, FR-009).

### Implementation for User Story 4

- [X] T024 [US4] Add empty-state or helper copy in `extension/popup.html` / `extension/popup.js` linking or listing example URLs (informational only, non-blocking) per FR-009

**Checkpoint**: US4 satisfeita (principalmente validação + copy; lógica já genérica na US1).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Erros, reconfigurar, remover, validação manual.

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

- **Phase 1**: T003 e T004 em paralelo (após T001–T002).
- **Phase 2**: T006 e T009 em paralelo com T005 (ficheiros distintos); T007 depois de T005–T006.
- **Phase 7**: T025, T026, T027 em paralelo se diferentes secções de ficheiros e merges cuidadosos.

### Parallel Example: Phase 2

```text
# Após T001–T002, em paralelo:
T003 — extension/icons/*.png
T004 — extension/vendor/sortable.min.js

# Após T005 iniciado, em paralelo onde possível:
T006 — extension/sanitize.js
T009 — extension/popup.css
```

### Parallel Example: User Story 1

```text
T010 — extension/content/picker.js (pode ser desenvolvido em paralelo com T008 refinamentos,
       mas integração T011 requer T007 + T010 completos)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 + Phase 2  
2. Complete Phase 3 (US1)  
3. **STOP** — validar com [`quickstart.md`](./quickstart.md) cenário de adição + persistência  

### Incremental Delivery

1. US1 → MVP  
2. US2 → painel completo (scroll, refresh, abrir, drag)  
3. US3 → polish identidade visual por cartão  
4. US4 → hints exemplo  
5. Phase 7 → erros, reconfigurar, remover, checklist final  

---

## Notes

- Cada tarefa inclui caminho de ficheiro explícito para execução por agente/LLM.  
- Contratos de mensagens: [`contracts/messages.md`](./contracts/messages.md).  
- Schema storage: [`contracts/storage.schema.json`](./contracts/storage.schema.json).  

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
