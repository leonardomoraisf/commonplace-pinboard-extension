# Data Model: Sites with named fields

**Storage**: `chrome.storage.local`  
**Top-level key**: `monitoredEntries` (array)

## Entity: `MonitoredEntry`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` (UUID v4) | yes | Stable entry identifier. |
| `pageUrl` | `string` (absolute URL) | yes | Monitored page URL. |
| `title` | `string` | yes | Title shown on the site card. |
| `faviconUrl` | `string` (URL) | no | Site favicon URL. |
| `order` | `number` (integer ≥ 0) | yes | Display order in the list. |
| `fields` | `MonitoredField[]` | yes | List of monitored values for that site. |
| `updatedAt` | `string` (ISO-8601) | no | Timestamp of last successful read. |

## Entity: `MonitoredField`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Stable field id within the site. |
| `label` | `string` | yes | User-given name for the monitored value. |
| `selector` | `string` | yes | CSS selector of the target element on the page. |
| `valueText` | `string` | no | Text extracted from the element on last read. |

## Validation rules

- `pageUrl`: `new URL(pageUrl)` must be valid; reject `chrome://`, `chrome-extension://`.
- `title`: non-empty after trim; max 200 characters.
- `fields`: at least 1 field per entry.
- `fields[].label`: non-empty after trim; max 120 characters.
- `fields[].selector`: non-empty; max 4096 characters.
- `fields[].valueText`: truncate so `storage.local` does not blow up.

## Relationships

- Flat list of sites, each with multiple named fields.
- Multiple entries may share the same `pageUrl`.

## State transitions

1. **Create**: `+` flow → URL → picker opens → user selects multiple fields and names each → save entry.
2. **Reorder**: update `order` on all affected items.
3. **Refresh**: update only `fields[].valueText` and `updatedAt`.
4. **Edit title**: update `title` only.
5. **Remove**: filter by `id`; reindex `order`.
6. **Reconfigure fields**: same `id`, replace `fields`.

## Scale assumptions

- Up to **10–20** entries, with several fields per entry.
- `fields[].valueText` should stay short enough to keep `storage.local` comfortable.
