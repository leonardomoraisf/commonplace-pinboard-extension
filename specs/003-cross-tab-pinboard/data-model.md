# Data model: Pins (003)

## Entity: Pin

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Stable identifier (UUID or equivalent). |
| `title` | string | yes | Display title (user-editable, max 200 chars). |
| `pageUrl` | string | yes | Normalized http/https URL of the source page. |
| `pageTitle` | string | no | Document title at capture time (informational). |
| `faviconUrl` | string | no | Icon URL for recognition in the list. |
| `selector` | string | yes | CSS selector used to locate content for refresh (max 4096 chars). |
| `savedContent` | string | yes | Primary saved text from the page (bounded length). |
| `previewText` | string | yes | Short plain preview for the list (truncated from content). |
| `order` | integer | yes | Non-negative list order (reindexed on save). |
| `createdAt` | string (ISO 8601) | yes | When the pin was first saved. |
| `updatedAt` | string (ISO 8601) | yes | Last successful capture or refresh. |

## Source reference

Embedded in each pin: `pageUrl`, `pageTitle`, `faviconUrl` identify origin for scanning and “open source” actions. `selector` ties the pin to a DOM location for refresh.

## Normalization rules

- **URLs**: Only `http:` and `https:` schemes; invalid URLs cause the pin to be dropped on load (defensive).
- **Text clamping**: `title`, `selector`, `savedContent`, `previewText` use documented max lengths; ellipsis for overlong preview in UI, hard clamp in storage.
- **Order**: On any save, pins are sorted by `order`, then `id`, then reindexed to `0..n-1`.

## Migration from `monitoredEntries`

Legacy entries had `fields[]` (multiple tracked fields per page). Migration:

1. For each legacy entry in `order`, iterate `fields` in array order.
2. Emit one **Pin** per field: copy `pageUrl`, `faviconUrl`; set `pageTitle` from legacy `title`; pin `title` = `field.label` if multiple fields share an entry, else legacy `title`; `selector`/`savedContent`/`previewText` from the field; `createdAt`/`updatedAt` from legacy `updatedAt` or current time.
3. After successful migration, persist `pins` and stop reading legacy data for normal operation.

## Ephemeral UI state

`syncError` (refresh failure message) is **not** persisted; it is held in popup memory per pin for the current session.
