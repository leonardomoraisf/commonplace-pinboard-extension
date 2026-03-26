# Quickstart: Cross-tab pinboard (manual)

**Prerequisites**: Load unpacked extension from `extension/` in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Create a pin

1. Open any `http` or `https` page with selectable content.
2. Open the extension popup.
3. Click **Pin from this tab** (or enter a URL and use **Open picker in new tab**).
4. In the picker overlay, click the content to capture; name it if needed; click **Save pin**.
5. Optional: save additional pins from the same page; click **Done** to close the picker.
6. Confirm the new pin appears in the list with preview and source hostname.

## Cross-tab read

1. With at least one pin saved, switch to a **different** tab (any site).
2. Open the popup: the same pins appear without returning to the source tab.

## Rename / reorder / remove

1. **Rename**: Use the card menu → **Edit title**, or double-click the title flow per UI.
2. **Reorder**: Drag the handle on a card; order should persist after closing the popup.
3. **Remove**: Card menu → **Remove**; confirm; other pins stay intact.

## Open source

1. From a pin’s menu, choose **Open source** (or equivalent). The stored URL opens in a new tab.

## Refresh / trust

1. With the source page open in a compatible tab, use **Refresh** on a pin or **Refresh all** when available.
2. On failure: the last snapshot remains; an error or stale state is shown; use **Re-pin** after navigating to the page if needed.

## Failure cases to spot-check

- **No meaningful content**: Empty selection / cancel — existing pins unchanged.
- **Auth / closed tab**: Refresh fails with a clear message; snapshot preserved.
- **Invalid / redirect URL**: Open source may warn; snapshot still visible.
