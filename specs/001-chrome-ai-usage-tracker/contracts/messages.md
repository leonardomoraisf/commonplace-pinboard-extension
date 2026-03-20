# Extension message contracts

Convention: JSON-serializable messages via `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`.  
All payloads include `type: string`.

## Popup ↔ Service worker

### `PICKER_START`

- **Direction**: popup → service worker  
- **Payload**: `{ type: 'PICKER_START', url: string, entryId?: string, title?: string }`
- **Behavior**: Opens a tab with `url` and injects the picker to select multiple fields.

### `PICKER_RESULT`

- **Direction**: service worker → popup (after picker)
- **Payload**: `{ type: 'PICKER_RESULT', ok: true, pageUrl: string, title: string, faviconUrl?: string, fields: { id: string, label: string, selector: string, valueText: string }[] }`
- **Error**: `{ type: 'PICKER_RESULT', ok: false, error: string }`

### `ENTRIES_GET`

- **Direction**: popup → service worker (optional; popup may read storage directly)  
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

### Selection

- On final click: compute `selector`, read visible text from the element, prompt for a field name, repeat until the user finishes.

## Errors

- Human-readable codes in `error` (short string). Popup shows a banner.
