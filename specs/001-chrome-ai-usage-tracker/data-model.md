# Data Model: Sites com campos nomeados

**Storage**: `chrome.storage.local`  
**Top-level key**: `monitoredEntries` (array)

## Entity: `MonitoredEntry`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` (UUID v4) | yes | Identificador estável da entrada. |
| `pageUrl` | `string` (URL absoluto) | yes | URL da página monitorizada. |
| `title` | `string` | yes | Título mostrado no cartão do site. |
| `faviconUrl` | `string` (URL) | no | URL do favicon do site. |
| `order` | `number` (integer ≥ 0) | yes | Ordem de exibição na lista. |
| `fields` | `MonitoredField[]` | yes | Lista de valores monitorizados desse site. |
| `updatedAt` | `string` (ISO-8601) | no | Momento da última leitura bem-sucedida. |

## Entity: `MonitoredField`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Identificador estável do campo dentro do site. |
| `label` | `string` | yes | Nome dado pelo utilizador ao valor monitorizado. |
| `selector` | `string` | yes | CSS selector do elemento alvo na página. |
| `valueText` | `string` | no | Valor textual extraído do elemento na última leitura. |

## Validation rules

- `pageUrl`: `new URL(pageUrl)` deve ser válido; rejeitar `chrome://`, `chrome-extension://`.
- `title`: não vazio após trim; máx. 200 caracteres.
- `fields`: pelo menos 1 campo por entrada.
- `fields[].label`: não vazio após trim; máx. 120 caracteres.
- `fields[].selector`: não vazio; máx. 4096 caracteres.
- `fields[].valueText`: truncar para não explodir o `storage.local`.

## Relationships

- Lista plana de sites, cada um com vários campos nomeados.
- Múltiplas entradas podem partilhar o mesmo `pageUrl`.

## State transitions

1. **Criação**: fluxo `+` → URL → picker abre → o utilizador seleciona vários campos e dá nome a cada um → guarda a entrada.
2. **Reordenação**: atualizar `order` em todos os itens afetados.
3. **Refresh**: atualizar apenas `fields[].valueText` e `updatedAt`.
4. **Edição de título**: atualizar `title` apenas.
5. **Remoção**: filtrar por `id`; reindexar `order`.
6. **Reconfigurar campos**: mesmo `id`, substituir `fields`.

## Scale assumptions

- Até **10–20** entradas, com vários campos por entrada.
- `fields[].valueText` deve ser curto o bastante para manter o `storage.local` confortável.
