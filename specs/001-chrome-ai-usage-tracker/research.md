# Research: Painel unificado de uso de IA (Chrome)

**Feature**: `001-chrome-ai-usage-tracker`  
**Date**: 2026-03-19

## R1 — Pré-visualização de páginas que bloqueiam iframe (Cursor, ChatGPT, etc.)

**Decision**: Não depender de `<iframe src="…">` no popup para a amostra. Usar **extração de DOM** na página real (separador com sessão autenticada) e **reproduzir** no popup como HTML sanitizado dentro de um contentor com altura máxima e scroll interno.

**Rationale**: `X-Frame-Options` e `frame-ancestors` em CSP impedem incorporar dashboards sensíveis no popup. A spec exige amostra visual e refresh com credenciais do perfil — isso exige executar código no contexto da página (content script) ou num separador que carrega o URL com as mesmas cookies.

**Alternatives considered**:

- **Iframe no popup** — rejeitado: falha nos alvos principais.
- **Screenshot (`captureVisibleTab`)** — rejeitado como única solução: só funciona para o separador visível; não escala para N entradas sem UX frágil.
- **Offscreen documents** — possível mais tarde; mais complexo para MVP “HTML/CSS/JS simples”. Adiar.

## R2 — Política de atualização ao abrir o popup e por entrada (FR-011)

**Decision**:

1. **Ao abrir o popup**: para cada entrada, tentar **atualizar** nesta ordem: (a) se existir separador cuja URL é **mesma origem** que a entrada e o path é compatível (prefixo ou match normalizado), injetar script e ler o nó pelo seletor guardado; (b) caso contrário, mostrar **cache** da última extração bem-sucedida com indicador opcional de idade (“última atualização”).
2. **Atualização explícita por entrada**: o service worker abre um separador **inativo** (`active: false`) com o URL guardado, espera `complete`, injeta o extrator, grava HTML/texto em cache, fecha o separador se foi criado para este efeito (ou deixa aberto conforme preferência de implementação mínima: fechar para não poluir).

**Rationale**: Cumpre “nova leitura ao reabrir” sem polling. Evita abrir N separadores em paralelo no primeiro passo (usa separadores já abertos). O refresh manual cobre o caso “não tenho o site aberto”.

**Alternatives considered**:

- **Sempre abrir separador oculto por entrada ao abrir popup** — simples mas lento e intrusivo; usar só no botão de refresh.
- **Apenas cache sem tentativa de tab matching** — não cumpre FR-011 ao abrir.

## R3 — Representação da “secção escolhida”

**Decision**: Guardar um **CSS selector** estável gerado no momento da seleção (caminho com `nth-of-type` / similar até ao elemento clicado) e, na primeira gravação, persistir também **snapshot inicial** (`innerHTML` sanitizado: remover `<script>`, `on*` attributes, `javascript:` URLs) para mostrar imediatamente no popup mesmo antes do primeiro refresh.

**Rationale**: Balanceia simplicidade e capacidade de re-leitura. Seletores quebram quando o DOM muda — já coberto na spec (reconfigurar entrada).

**Alternatives considered**:

- **XPath apenas** — equivalente; CSS selector é familiar para debug.
- **Só coordenadas de crop** — frágil com responsive layout.

## R4 — Arrastar cartões (FR-013)

**Decision**: Incluir **SortableJS** (um único ficheiro `vendor/sortable.min.js` ou pacote npm copiado para `extension/vendor/`) ligado ao contentor da lista no `popup.html`. Persistir nova ordem com `chrome.storage.local` após `onEnd`.

**Rationale**: Arrastar com pointer events puro é trabalhoso; a spec autoriza um pacote só para isto. Mantém o resto em vanilla.

**Alternatives considered**:

- **HTML5 drag-and-drop nativo** — viável mas UX inconsistente entre browsers; Sortable é um ficheiro e API pequena.
- **Só botões subir/descer** — cumpre FR sem dependência; reservar como fallback se Sortable falhar no popup (raro).

## R5 — Permissões (FR-012)

**Decision**: Manifest V3 com `host_permissions`: `https://*/*` e `http://*/*` (ou `<all_urls>` se necessário para ficheiros locais — provavelmente não). `permissions`: `storage`, `scripting`, `tabs`, `activeTab` opcional se quiseres reduzir declarações (mas com scraping genérico, `tabs` + host broad é o caminho simples).

**Rationale**: Alinhado com clarificação “uso pessoal, permissões largas”.

**Alternatives considered**: `optional_host_permissions` por domínio — rejeitado pelo utilizador na clarificação.

## R6 — UI: clean, bordas arredondadas (input do plano)

**Decision**: Tema **claro neutro** (fundo `#f4f4f5`, cartões brancos), **border-radius 12px** nos cartões, **8px** em botões e inputs, sombra suave (`box-shadow` discreta), tipografia sistema (`system-ui`), espaçamento generoso, ícones inline SVG ou Unicode para ações (abrir, atualizar, remover) para evitar pipeline de assets.

**Rationale**: Cumpre pedido de design simples e legível no espaço limitado do popup; tudo em CSS sem framework.
