# Feature Specification: Cross-tab information pinboard

**Feature Branch**: `003-cross-tab-pinboard`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Transform this project into a general-purpose browser extension for pinning information from one tab and making it easily accessible from any other tab."

**Constitution**: Keep requirements **technology-agnostic** except where the **product channel** (browser extension) is
itself a requirement. Delivery constraints agents apply in `plan.md` live in
[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md).

## User Scenarios & Testing *(mandatory)*

## Product Direction

This rework is not limited to behavior and data model changes. The extension's presentation must also move away from
the current AI-specific framing so the product reads as a general-purpose pinboard for arbitrary web information rather
than a tool centered on AI dashboards, AI usage, or AI spending.

The visual rework must preserve the existing browser-extension surface and simplicity, but it should update interface
copy, information hierarchy, and visual language so the extension feels neutral, broadly useful, and appropriate for
general browsing workflows.

This visual repositioning is mandatory for the feature to be considered complete. It is not a polish-only follow-up,
and it must be treated as part of the core product rework alongside capture, storage, and cross-tab access behavior.

### User Story 1 - Pin information from a page (Priority: P1)

The user wants to capture useful information from the page they are currently viewing and save it as a reusable pin.
They choose content from the current page, confirm what should be saved, give it a clear label if needed, and store it
without leaving the page they are working on.

**Why this priority**: Without a reliable way to create pins from arbitrary pages, the product has no core value.

**Independent Test**: Open any standard web page, create a pin from visible information, and confirm the new pin is
saved with recognizable content and source context.

**Acceptance Scenarios**:

1. **Given** the user is on an `http` or `https` page with visible content, **When** they choose information to pin and
   save it, **Then** a new pin is created with the captured content and a label the user can recognize later.
2. **Given** the user does not provide a custom label, **When** the pin is saved, **Then** the system assigns a sensible
   default label based on the source page or captured content.
3. **Given** the page contains more than one useful item, **When** the user creates multiple pins from that page,
   **Then** each pin is saved independently and can be managed separately.

---

### User Story 2 - Reuse pinned information from any other tab (Priority: P1)

The user wants the saved information to remain available while they browse elsewhere. From any other tab, they open the
extension and immediately see the pins they saved earlier, without needing to navigate back to the original page first.

**Why this priority**: The main product promise is cross-tab access to information that would otherwise require context
switching back to the source tab.

**Independent Test**: Save a pin on one page, switch to a different tab, open the extension surface, and verify the pin
is available there with the same content.

**Acceptance Scenarios**:

1. **Given** one or more saved pins exist, **When** the user opens the extension from a different browser tab,
   **Then** the previously saved pins are visible and readable from that tab.
2. **Given** the original source tab is no longer active, **When** the user opens the extension elsewhere, **Then** the
   pin still appears as saved content rather than disappearing with the source tab.
3. **Given** the user has several saved pins, **When** they open the extension from any tab, **Then** they can quickly
   identify the right pin by its title, source context, and content preview.

---

### User Story 3 - Organize and maintain pins over time (Priority: P2)

The user wants the saved information to stay useful after the first capture. They can rename pins, remove outdated
ones, reorder the list to match their workflow, and revisit the original page when they need to verify or refresh the
source information.

**Why this priority**: A pinboard becomes cluttered quickly unless users can keep it curated and trustworthy.

**Independent Test**: With at least three pins saved, rename one, reorder the list, remove another, and confirm the
changes persist after reopening the browser extension.

**Acceptance Scenarios**:

1. **Given** an existing pin, **When** the user changes its title, **Then** the new title is shown everywhere that pin
   appears.
2. **Given** multiple pins exist, **When** the user changes their order, **Then** the updated order is reflected the
   next time they open the extension.
3. **Given** a pin is no longer useful, **When** the user removes it, **Then** it no longer appears in the pinboard and
   the remaining pins stay intact.
4. **Given** a saved pin has source context, **When** the user chooses to revisit the source, **Then** the original page
   opens directly from that pin.

---

### User Story 4 - Keep pinned information trustworthy (Priority: P2)

The user wants confidence that a pin still represents the right information. They can tell when a pin is only a saved
snapshot, when it was last refreshed, and when the original page must be revisited because the source can no longer be
resolved in the same way.

**Why this priority**: A general-purpose pinboard is only useful if users can distinguish saved reference content from
stale or broken source links.

**Independent Test**: Save a pin, later refresh or re-pin it from its source page, and confirm the system updates the
content or clearly explains why it cannot.

**Acceptance Scenarios**:

1. **Given** a saved pin with source context, **When** the user refreshes or re-pins it from the source page,
   **Then** the saved content updates to the latest captured version.
2. **Given** the original page has changed and the saved source can no longer be matched cleanly, **When** the user
   tries to refresh the pin, **Then** the system clearly reports that the pin needs to be captured again.
3. **Given** a pin has not been updated recently, **When** the user views it, **Then** they can see when it was last
   refreshed or confirmed.

### Edge Cases

- The user tries to create a pin from a page with no meaningful selectable content: the system explains why capture
  failed and leaves existing pins unchanged.
- The user attempts to pin duplicate information intentionally or accidentally: duplicate pins are allowed, but each pin
  remains independently editable and removable.
- The source page requires authentication and later becomes unavailable: the saved pin remains visible as stored content,
  while refresh attempts fail with a clear explanation.
- The captured information is very long: the pinboard keeps the list scannable by showing a compact preview while still
  allowing access to the full saved content.
- The user has many saved pins: the extension remains usable through scrolling and clear labeling without losing pins or
  mixing their order.
- The original page URL becomes invalid or redirects elsewhere: the pin keeps its saved snapshot and source metadata,
  and the user is informed if reopening or refreshing no longer behaves as expected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the user to create a pin from information visible in the currently active browser
  tab.
- **FR-002**: The pin creation flow MUST work for arbitrary `http` and `https` pages, rather than being limited to a
  predefined list of supported domains.
- **FR-003**: Each saved pin MUST preserve the captured information as stored content so it remains accessible after the
  user leaves the source tab.
- **FR-004**: Each pin MUST include enough identifying context for the user to recognize it later, including a display
  title and the originating page reference.
- **FR-005**: The system MUST let the user accept an automatic title or provide a custom title during or after pin
  creation.
- **FR-006**: The system MUST show all saved pins from any browser tab through the extension surface, without requiring
  the user to reopen the original source tab first.
- **FR-007**: The system MUST present saved pins in a scannable list where each item includes a compact preview of the
  pinned content.
- **FR-008**: The system MUST persist saved pins, including their order and user-edited labels, across browser sessions
  until the user changes or removes them.
- **FR-009**: The user MUST be able to remove an existing pin without affecting unrelated pins.
- **FR-010**: The user MUST be able to reorder saved pins to match personal workflow, and that order MUST persist.
- **FR-011**: The user MUST be able to reopen the original source page from a saved pin.
- **FR-012**: The system MUST record when a pin was last captured or refreshed and show that information to the user.
- **FR-013**: The system MUST allow the user to refresh or re-capture a pin from its source when the source page is
  available again.
- **FR-014**: If a saved pin can no longer be refreshed from its source, the system MUST preserve the last saved content
  and clearly explain that the pin needs manual recapture.
- **FR-015**: The system MUST support multiple independent pins originating from the same page.
- **FR-016**: The system MUST give clear feedback when pin creation, refresh, or source reopening cannot be completed.
- **FR-017**: The extension UI MUST be visually reworked so it no longer presents itself as AI-specific and instead
  communicates a general-purpose pinboard product for arbitrary web content.
- **FR-018**: The extension UI copy, labels, and empty states MUST avoid AI-specific terminology unless the user is
  pinning content that happens to come from an AI-related page.
- **FR-019**: The extension surface MUST keep the existing lightweight popup-based interaction model while updating the
  visual hierarchy and styling to support a more generalist product identity.
- **FR-020**: The visual redesign MUST be implemented as part of this feature scope and MUST NOT be deferred to a later
  cleanup, polish, or branding-only pass.

### Key Entities *(include if feature involves data)*

- **Pin**: A saved piece of information captured from a browser page. Attributes include title, saved content, compact
  preview, source page reference, user-defined order, and timestamps for creation and most recent refresh.
- **Source reference**: The origin details for a pin, used to identify where the information came from and how to reopen
  or refresh it later. Attributes include page URL, page title, and optional page-level metadata useful for
  recognition.

### Assumptions

- The primary value is saving information for later reuse across tabs, so each pin behaves as a stored snapshot even if
  refresh from the source is also possible.
- Pinned information is organized for one person's browsing workflow and is stored locally for that person unless a
  future feature says otherwise.
- The browser extension remains the main access point for viewing and managing pins from any tab.
- The feature is intended for general web content, not just AI dashboards or usage metrics.
- The current AI-focused visual framing is considered part of the legacy implementation and should be replaced during
  this rework.
- The user handles access to authenticated pages themselves; the extension does not manage third-party credentials.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can create a new pin from a page and confirm it is saved in under 90 seconds without
  external instructions.
- **SC-002**: After saving a pin in one tab, the user can find and read that pin from a different tab in under 10
  seconds.
- **SC-003**: In a manual test with 20 saved pins, 100% of pins remain available after closing and reopening the
  browser.
- **SC-004**: In a usability check, at least 90% of users can identify the correct pin they need from the list without
  reopening multiple source pages.
- **SC-005**: When a source page can no longer be refreshed, 100% of tested failure cases preserve the last saved pin
  content and present an understandable next step to the user.
- **SC-006**: In review of the implemented popup, no primary product copy, labels, or empty states still frame the
  extension as an AI-only tracker rather than a general-purpose pinboard.
