# Feature Specification: Unified AI usage panel (Chrome extension)

**Feature Branch**: `001-chrome-ai-usage-tracker`  
**Created**: 2026-03-19  
**Status**: Draft  
**Input**: User description: "I want to create an extension for Google Chrome to track my AI tool usage in one place. Idea: already logged into Cursor and Codex. Desired starter pages: Codex usage (ChatGPT) and Cursor spending. Flow: + for URL, section selection, scrollable list, persistence, configurable title/favicon."

## Clarifications

### Session 2026-03-19

- Q: When and how should sample content update relative to the source page? → A: When opening the panel and/or via an explicit refresh action per entry; no continuous automatic background refresh (option A).
- Q: Where does the user open and use the unified panel in Chrome? → A: Popup when clicking the extension icon (option A).
- Q: How should the extension access added sites (permissions)? → A: Personal use only by the author; no requirement to minimize permissions or formal security posture — the broadest/simplest permission scope the implementation needs is acceptable (practical equivalent to option B).
- Q: How should entry order in the list be determined? → A: Manual reordering by the user, with order persisted (option C).
- Q: Should there be an explicit way to open the full page from each entry? → A: Yes — a dedicated, clear control to open the URL in a new tab, without relying on clicking the sample (option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a new monitored page (Priority: P1)

The user wants to register a web page (for example, an AI tool’s usage or spending area) and choose which part of that page should always appear in the unified panel. They tap the “+” control at the top, enter the page address, confirm, and visually pick the page section whose content they want to keep visible in the list. The new entry appears in the list with a sample of that section.

**Why this priority**: Without this flow there is no product — it is the core for consolidating tracking in one place.

**Independent Test**: Can be tested end-to-end with a single URL: after the flow, the entry exists in the list and shows the chosen area.

**Acceptance Scenarios**:

1. **Given** the extension panel open with no entries (or with existing entries), **When** the user taps “+”, enters a valid URL, and completes section selection, **Then** a new row appears in the list with a preview of the chosen section.
2. **Given** a created entry, **When** the user closes and later reopens the browser (or the extension), **Then** the same entry and chosen section remain available without repeating the flow.

---

### User Story 2 - See all areas in a simple scrollable list (Priority: P2)

The user wants to browse, in the extension popup window, the various areas they configured (Codex usage, Cursor spending, future pages), each as a sample of the chosen section, in a simple vertical list. They can **reorder** entries manually to set their preferred sequence; that order is saved. When there are many entries, the list allows scrolling to see everything within the popup’s available space.

**Why this priority**: Delivers the “one place” value to compare and review several sources without manually jumping between tabs.

**Independent Test**: With at least two saved entries, verify both appear in the list and that scrolling reaches the last one.

**Acceptance Scenarios**:

1. **Given** several saved entries, **When** the user opens the panel, **Then** they see each entry as a block/list item with the sample for that section.
2. **Given** more entries than fit on the visible screen, **When** the user scrolls the list, **Then** they can reach all entries without leaving the panel.
3. **Given** the panel was closed and data on the source page changed, **When** the user opens the panel again, **Then** the samples reflect a new read at that moment (without relying on continuous automatic refresh while the panel was open).
4. **Given** the panel is already open and an entry shows stale data, **When** the user requests an explicit refresh on that entry, **Then** only that sample is renewed to match the current state of the target page.
5. **Given** at least two entries in the list, **When** the user manually reorders items (e.g. by dragging or move-up/move-down actions), **Then** the list immediately reflects the new order.
6. **Given** a custom order, **When** the user closes the browser and later reopens the panel, **Then** entries appear in the same saved order.
7. **Given** an entry with a saved URL, **When** the user uses the **dedicated control** to open the full page, **Then** the correct URL opens in a **new tab** without the interaction depending on clicking the sample.

---

### User Story 3 - Identifiable and editable title and icon (Priority: P3)

For each entry, the user can accept the page title and favicon suggested automatically, or set their own title at creation. Later, they can keep the favicon visible and change only the title to organize the panel as they prefer.

**Why this priority**: Improves quick recognition and organization when many similar tools are present.

**Independent Test**: Create an entry with automatic title; edit the title; confirm the favicon remains visible as expected.

**Acceptance Scenarios**:

1. **Given** the add-page flow, **When** the user does not set a manual title, **Then** the system uses the page title and shows the favicon associated with the entry.
2. **Given** the add-page flow, **When** the user sets a custom title, **Then** that title appears in the list and the favicon may still be shown.
3. **Given** an existing entry, **When** the user changes only the title, **Then** the favicon and monitored section are unchanged; only the identifying text changes.

---

### User Story 4 - Extension easy to extend to new pages (Priority: P2)

The user wants adding new monitoring pages (beyond those used today) to always follow the same “+ → URL → choose section” flow, without depending on manual updates to a fixed site list.

**Why this priority**: Ensures the product can follow new tools or new report URLs without rework of “fixed” configuration.

**Independent Test**: Add a URL different from the initial examples and repeat the flow successfully.

**Acceptance Scenarios**:

1. **Given** the user discovers a new statistics or usage page, **When** they use the same add flow, **Then** they can include it in the list like existing entries.

---

### Edge Cases

- Invalid URL, error page, or temporarily unavailable site: the user gets clear feedback and can correct or cancel without losing already saved entries.
- User is not authenticated on the target site: the preview reflects what the site shows in that state (e.g. login screen); automatic login by the extension is not assumed.
- Chosen section is very large: the list must remain usable (e.g. by limiting sample height with internal scroll or visible truncation, without breaking global list scroll).
- Popup window dimensions limited by Chrome: the layout MUST keep the list and samples usable using internal scroll only (global vertical list scroll and, if needed, per-entry scroll), without requiring manual resizing by the user to complete main tasks.
- Same URL added more than once with different sections: each entry is independent (distinct logical id); reordering affects each list item without conflating distinct entries.
- Page content changes on the server: the sample updates when the user opens (or reopens) the main panel or triggers an explicit refresh on that entry; there is no periodic automatic background refresh; if page structure changes incompatibly with the saved section, the user may need to reconfigure that entry.
- Opening the original site: the user always uses the dedicated control (**FR-014**); if the sample is interactive or clickable for other reasons, it must not replace or obscure that intentional “open full page” action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST show a main panel with a vertical list of monitored areas, opened as a **popup** when clicking the extension icon in the Chrome toolbar.
- **FR-002**: Each list item MUST show a visual sample of the page section the user selected for that entry.
- **FR-003**: The panel MUST include a “+” control at the top that starts the flow to add a new page.
- **FR-004**: In the add flow, the user MUST be able to enter the page URL and then select which section of the page is associated with the entry.
- **FR-005**: All entries (URL, chosen section, title, icon display preferences, **list order**) MUST persist across browser sessions until the user removes or changes them.
- **FR-006**: For each entry, the user MUST be able to use a custom title at creation OR accept the title derived from the page together with the favicon shown in the list.
- **FR-007**: For each existing entry, the user MUST be able to change the title while keeping the favicon (and section) saved, unless they explicitly act otherwise.
- **FR-008**: When the list exceeds visible space, the user MUST be able to scroll to see all items.
- **FR-009**: The add flow MUST be generic: any URL the user allows MUST be addable through the same process, without an exclusive fixed domain list (informational examples or shortcuts may exist for pages the user values today: Codex usage on ChatGPT and spending on the Cursor dashboard).
- **FR-010**: The user MUST be able to remove or reconfigure an entry (e.g. re-pick section or URL) without deleting the others.
- **FR-011**: Samples MUST get updated content from the target page when the user opens or reopens the main panel; the user MUST be able to request an explicit refresh per entry; the system MUST NOT perform continuous automatic refresh or fixed-interval background refresh while the panel stays open.
- **FR-012**: Given **personal-only** use by the author, the Chrome permission model MAY be the **broadest scope required** by the implementation (e.g. broad HTTPS URL access), **without** mandatory incremental consent per domain when adding each URL or threat documentation for third parties.
- **FR-013**: The user MUST be able to **manually reorder** entries in the list; the resulting order MUST persist together with the rest of the entry data (aligned with **FR-005**).
- **FR-014**: Each entry MUST expose a **clear, dedicated** way (e.g. icon or link in the entry header) to open the saved **full URL** in a **new tab**; opening the site MUST NOT depend solely on clicking the sample area.

### Key Entities

- **Monitored entry**: Represents a source in the panel. Attributes: page address; reference to the chosen section (so the sample can be reproduced); displayed title; associated favicon; **sortable position** in the list (user-defined and persisted); creation / last-updated metadata if useful to the user.

### Assumptions

- The user manages their own authentication on each site (Cursor, Codex/ChatGPT, others); the extension does not replace login or store credentials for those services.
- Example pages the user wants to see today are only value references; behavior is the same for any new page added via the “+” flow.
- Configuration storage is local to the user’s device, appropriate for personal organization data.
- The product targets Google Chrome as the distribution channel requested by the user.
- **Personal use**: Tool for a single user (author); no requirement to minimize permissions, harden for shared machines, or meet explicit Chrome Web Store publication requirements beyond what local installation needs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a new entry (URL + section selection) and see it in the list in under 2 minutes on first use, without external documentation.
- **SC-002**: After fully closing the browser and reopening, 100% of configured entries reappear with the same section, titles/favicons, and **list order** saved, in a test with up to 10 entries.
- **SC-003**: With 5 or more entries, the user can locate any one by scrolling the list in under 15 seconds.
- **SC-004**: At least 90% of participants in an informal usability test correctly identify which tool each entry corresponds to thanks to title and icon, without opening the original site.
- **SC-005**: The user rates adding a generic new page as “easy” or equivalent (simple scale or short interview), aligned with the extensibility goal.
