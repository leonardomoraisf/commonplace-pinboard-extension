# AI Usage Tracker

Chrome extension to track selected values from AI-related dashboards and keep them in one place.

## What it does

- Lets you pin multiple values from a page
- Saves each pinned field with a custom name
- Shows the tracked entries in a popup
- Lets you reorder, edit, refresh, open, and remove entries

## Install in Google Chrome

This project is designed to be loaded as an unpacked extension during development.

1. Open Google Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the `extension/` folder from this repository.
6. The extension will appear in your Chrome toolbar.

## Update the extension after changes

If you change the code while developing:

1. Save your files.
2. Return to `chrome://extensions`.
3. Click the extension's **Reload** button, or refresh the extension from the Extensions page.

## How to use

1. Open the extension popup.
2. Add a page URL.
3. Use the picker to select the values you want to track.
4. Give each value a name.
5. Save the entry.

## Project structure

- `extension/` - Chrome extension source
- `specs/` - product spec, contracts, and planning notes

## Notes

- The extension uses Manifest V3.
- It is meant to be loaded from the `extension/` directory, not from the repository root.
- For now, the tracked pages must stay open in the browser for the extension to read and refresh their data.
- A practical way to keep things tidy is to leave those tabs open inside a collapsed tab group, which is how I use it too.
