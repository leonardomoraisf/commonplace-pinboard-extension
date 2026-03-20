# Implementation Plan: Painel unificado de uso de IA (Chrome)

**Branch**: `001-chrome-ai-usage-tracker` | **Date**: 2026-03-19 | **Spec**: [`spec.md`](./spec.md)  
**Input**: Feature specification + clarificações (popup, refresh, permissões amplas, reordenação, abrir URL dedicado) + stack **HTML/CSS/JavaScript** simples; **SortableJS** permitido para arrasto; UI **clean**, bordas arredondadas.

## Summary

Construir uma extensão **Chrome Manifest V3** com **popup** que lista **cartões** (uma **entrada monitorizada** por cartão): título, favicon, **amostra** da secção (HTML sanitizado em cache), ações **abrir URL** (novo separador), **atualizar**, **editar título**, **reconfigurar/remover**, e **+** para novo URL com **fluxo de seleção** num separador real. Persistência em **`chrome.storage.local`**. **Sem** frameworks de UI; **SortableJS** (ficheiro em `vendor/`) para **reordenação** persistida. Pré-visualização **não** usa iframe cross-origin; usa **content scripts** / separadores com cookies do perfil e **CSS selector** guardado (ver [`research.md`](./research.md)).

## Technical Context

**Language/Version**: JavaScript (ES2020+), HTML5, CSS3 — sem TypeScript/build obrigatório no MVP.  
**Primary Dependencies**: **SortableJS** (única dependência JS opcional, cópia local); APIs Chrome (MV3).  
**Storage**: `chrome.storage.local` — esquema em [`contracts/storage.schema.json`](./contracts/storage.schema.json) e [`data-model.md`](./data-model.md).  
**Testing**: Manual conforme [`quickstart.md`](./quickstart.md); testes automatizados opcionais (ex.: funções puras de sanitização extraídas para ficheiro testável com `node:test`).  
**Target Platform**: Google Chrome (MV3).  
**Project Type**: browser-extension (popup + service worker + content scripts).  
**Performance Goals**: Popup utilizável com até ~10 entradas; refresh sequencial aceitável (sem polling contínuo).  
**Constraints**: Stack simples (pedido do autor); popup com altura/largura limitadas — scroll global + scroll interno por amostra; permissões **amplas** `https://*/*` (e `http` se necessário) alinhadas a FR-012.  
**Scale/Scope**: 1 utilizador, ~10–20 entradas, amostras com HTML cache limitado (~500KB por entrada recomendado).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verificado contra [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) **v1.0.0** (2026-03-19).

| Principle | Status |
|-----------|--------|
| I. Plain web platform MVP | **Pass** — ES2020+ HTML/CSS/JS; SortableJS em `vendor/`; sem TS/build obrigatório. |
| II. Chrome Manifest V3 compliance | **Pass** — MV3, service worker, permissões documentadas. |
| III. Contract-first storage and messaging | **Pass** — `contracts/storage.schema.json`, `contracts/messages.md`. |
| IV. Testing and lint discipline | **Pass** — `quickstart.md` para manual; testes auto opcionais até haver `package.json`. |
| V. Specification-driven delivery | **Pass** — plano derivado de `spec.md` e branch `001-chrome-ai-usage-tracker`. |

**Pós-fase 1**: Desenho alinha-se a simplicidade (vanilla + um vendor script); sem projetos extra.

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
└── tasks.md              # (/speckit.tasks — não criado por este comando)
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

**Structure Decision**: Repositório com pasta única **`extension/`** na raiz do projeto para código carregável pelo Chrome; especificações e contratos permanecem em **`specs/001-chrome-ai-usage-tracker/`**.

## Phase 0 & Phase 1 outputs

| Artifact | Path | Status |
|----------|------|--------|
| Research (decisões) | [`research.md`](./research.md) | Completo |
| Modelo de dados | [`data-model.md`](./data-model.md) | Completo |
| Contratos | [`contracts/messages.md`](./contracts/messages.md), [`contracts/storage.schema.json`](./contracts/storage.schema.json) | Completo |
| Quickstart | [`quickstart.md`](./quickstart.md) | Completo |

## Implementation notes (high level)

1. **`manifest.json`**: `manifest_version` 3; `action.default_popup` → `popup.html`; `background` service worker `background.js`; `permissions`: `storage`, `scripting`, `tabs`; `host_permissions`: `https://*/*`, `http://*/*`; `content_scripts` apenas se necessário para match patterns amplos — preferir **`scripting.executeScript`** dinâmico no picker/refresh para controlar quando corre.
2. **Picker**: ao `PICKER_START`, abrir tab com URL; injetar `picker.js`; overlay com highlight; clique → calcular selector + extrair HTML → sanitizar → `PICKER_RESULT` ao popup.
3. **Sanitização**: remover `<script>`, `<iframe>`, event handlers, `javascript:`; truncar string grande (ver data-model).
4. **Popup UI**: lista `#card-list`; cartão com header (favicon, título editável, botões abrir/atualizar/menu); corpo com `.preview` (scroll, max-height); **Sortable** na lista; **+** fixo no topo.
5. **Refresh**: implementar lógica em [`research.md`](./research.md) R2 (tab match primeiro; cache; separador inativo no refresh explícito).
6. **Design**: variáveis CSS (`--radius-card: 12px`, `--radius-control: 8px`, `--bg`, `--card`, `--border`, `--accent`); foco visível; contraste razoável.

## Complexity Tracking

Constitution gates N/A; sem violações a justificar. Tabela omitida.

## Next step

Executar **`/speckit.tasks`** para gerar `tasks.md` a partir deste plano.
