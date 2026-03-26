# Commonplace Pinboard

Chrome extension for saving snapshots from one page and reopening them from any other tab.

## What it does

- Captures a visible value, heading, or text block from the current page
- Stores each capture as an independent pin with source context and timestamps
- Keeps saved pins readable even after the source tab is closed
- Lets you rename, reorder, refresh, re-pin, reopen, and remove saved pins

## Install in Google Chrome

This project is meant to be loaded as an unpacked extension during development.

1. Open Google Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` folder from this repository.
6. Pin the extension to the Chrome toolbar if you want quicker access.

## Update the extension after changes

1. Save your files.
2. Return to `chrome://extensions`.
3. Click the extension's **Reload** button.

## Basic flow

1. Open any `http` or `https` page.
2. Open the popup and click **Pin From This Tab**.
3. In the picker overlay, click the content you want to save and confirm the label.
4. Reopen the popup from any other tab to read the saved snapshot.
5. Use the card controls to rename, reorder, refresh, re-pin, open the source page, or remove the pin.

## Project structure

- `extension/` - Chrome extension source
- `specs/` - feature specifications, contracts, and planning notes

## Notes

- The extension uses Manifest V3.
- Load it from the `extension/` directory, not the repository root.
- Saved pins live in `chrome.storage.local`.
- Refresh failures preserve the last saved snapshot and surface a re-pin prompt instead of deleting data.
