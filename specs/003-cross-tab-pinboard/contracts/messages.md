# Runtime messages (003 — pinboard)

All messages use `type` as a string discriminator. Responses use `{ ok: boolean, ... }` unless noted.

## Popup → background

| `type` | Purpose | Payload | Response |
|--------|---------|---------|----------|
| `PICKER_START` | Begin picker session | `url?` (http/https, optional if `tabId` set), `tabId?` (inject into this tab), `title?` (optional custom title hint), `pinId?` (when re-pinning/updating an existing pin) | `{ ok, error? }` when the session **ends** (not on each incremental save). |
| `PICKER_SAVE_PIN` | Content script only: save one pin during a session | From picker: `pageUrl`, `pageTitle`, `faviconUrl`, `field`: `{ label, selector, valueText }` | `{ ok, pin?, error? }` |
| `PICKER_SESSION_END` | Content script only: user finished the session | — | `{ ok }` |
| `PICKER_RESULT` | **Deprecated** — batch field save; not used by the pinboard flow. | — | — |
| `PICKER_CANCEL` | Cancel picker (from content or synthesized) | `error?` | `{ ok: false }` path on session |
| `PINS_GET` | Load all pins | — | `{ ok, pins? }` |
| `PINS_SAVE` | Replace ordered pin list | `pins` | `{ ok, pins? }` |
| `REFRESH_PIN` | Re-read DOM for one pin | `id` | `{ type: 'REFRESH_PIN_RESULT', id, ok, fields?, updatedAt?, error? }` |
| `OPEN_PIN_SOURCE` | Open source URL in a new tab | `url` | `{ ok, error? }` |
| `RELOAD_OPEN_PAGES` | Reload tabs matching stored URLs (optional power-user) | — | `{ ok }` |

## Background → content (optional)

Responses to `PICKER_SESSION_END` and `PICKER_SAVE_PIN` are delivered via `sendResponse` on the same message.

## Legacy aliases (removed)

`ENTRIES_GET` / `ENTRIES_SAVE` / `REFRESH_ENTRY` are superseded by `PINS_*` and `REFRESH_PIN` in the pinboard implementation.
