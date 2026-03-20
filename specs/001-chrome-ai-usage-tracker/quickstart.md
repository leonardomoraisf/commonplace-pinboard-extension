# Quickstart: local development and testing

## Prerequisites

- Recent Google Chrome (Manifest V3).
- This repository cloned at `/home/leokr/projects/ai_usage_tracking` (or equivalent).

## Expected structure (after implementation)

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
│   └── sortable.min.js   # SortableJS, local copy
└── icons/
    └── *.png
```

## Load the unpacked extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → choose the `extension/` folder at repo root (created during implementation).

## Manual test flow

1. Click the extension icon → **popup** opens.
2. **+** → enter `https://cursor.com/dashboard/spending` (or test URL) → confirm → tab opens in selection mode → click desired region → verify card in popup with sample.
3. Repeat for a second URL (e.g. Codex page) and confirm **scroll** in the list.
4. **Drag** cards → close browser → reopen → confirm **order** (SC-002).
5. **Open full page** via dedicated control → new tab with correct URL.
6. **Refresh** an entry without the site open → confirm temporary open or message + cache per plan.

## Design (quick reference)

- Cards: white background, `border-radius: 12px`, light shadow.
- Buttons and inputs: `border-radius: 8px`, visible `:focus-visible` states.
- List: `max-height` on container with `overflow-y: auto` in popup.

## Notes

- Being **authenticated** on target sites in normal tabs helps tab matching; the **refresh** button covers the case with no open tab.
- For development, after changing `manifest.json` or the service worker, use **Reload** on `chrome://extensions`.
