# Extension message contracts

Convenção: mensagens JSON-serializáveis via `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`.  
Todos os payloads incluem `type: string`.

## Popup ↔ Service worker

### `PICKER_START`

- **Direction**: popup → service worker  
- **Payload**: `{ type: 'PICKER_START', url: string, entryId?: string, title?: string }`
- **Behavior**: Abre um separador com `url` e injeta o picker para selecionar vários campos.

### `PICKER_RESULT`

- **Direction**: service worker → popup (após picker)
- **Payload**: `{ type: 'PICKER_RESULT', ok: true, pageUrl: string, title: string, faviconUrl?: string, fields: { id: string, label: string, selector: string, valueText: string }[] }`
- **Error**: `{ type: 'PICKER_RESULT', ok: false, error: string }`

### `ENTRIES_GET`

- **Direction**: popup → service worker (opcional; pode ler storage diretamente no popup)  
- **Payload**: `{ type: 'ENTRIES_GET' }`  
- **Response**: `{ type: 'ENTRIES_DATA', entries: MonitoredEntry[] }`

### `ENTRIES_SAVE`

- **Direction**: popup → service worker  
- **Payload**: `{ type: 'ENTRIES_SAVE', entries: MonitoredEntry[] }`

### `REFRESH_ENTRY`

- **Direction**: popup → service worker  
- **Payload**: `{ type: 'REFRESH_ENTRY', id: string }`  
- **Response**: `{ type: 'REFRESH_ENTRY_RESULT', id: string, ok: boolean, fields?: { id: string, label: string, selector: string, valueText: string }[], updatedAt?: string, error?: string }`

## Content script (picker)

### Seleção

- Ao clique final: calcular `selector`, ler o texto visível do elemento, pedir um nome para o campo, e repetir até o utilizador finalizar.

## Erros

- Códigos humanos em `error` (string curta). Popup mostra banner.
