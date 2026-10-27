# HH Support local validation

The disposable fixture uses synthetic data and listens only on loopback. It does not contact HyperHive hosts. Start after exporting the web app:

```sh
npm run build
node tests/fixtures/support-api.cjs
```

Open `http://127.0.0.1:8097/`. Sign in with a synthetic email/password and API URL `http://127.0.0.1:8097/api`, then open HH Support from the sidebar. The fixture contains all five stream types, all twelve widget kinds, an offline instance with independent unhealthy status, and more than one numeric history page. The fixture is a UI aid and deliberately does not reproduce production authentication or persistence.

Focused automated validation:

```sh
npx jest --config tests/jest.support.config.cjs --runInBand
npx tsc --noEmit --pretty false
npm run build
```

Local results on 2026-10-26: forty-six focused tests pass; web export passes. TypeScript reports seven existing `TS2322` errors in `components/ui/heading/index.web.tsx` at lines 53, 72, 91, 110, 129, 149 and 168, all concerning `WebkitBoxOrient`. No Support source diagnostics were reported. Those unrelated heading errors are unchanged.

Tests cover bounded/deduplicated sample merging, widget compatibility, ticket URLs and authentication, malformed history/frames, maximum-instance Unicode state frames, right-edge gesture boundaries, readable value/log/event formatting, rendered older-page/return-to-live behavior, server-filtered severity search beyond 200 newer logs and matching live updates, REST bootstrap independent of WebSocket availability, buffered reconciliation, no periodic polling, reconnect refresh, independent health/connectivity, notification coalescing, and prototype-property stream names. Page-level tests exercise App registration/edit/delete and tab creation through the actual forms, rotation confirmation and one-time credentials, compatible widget addition, future-stream chart creation and settings edits, automatic removal persistence, revision-conflict draft preservation, serialized rapid edits, acknowledged revisions despite stale snapshots, failed-save retry, saved-layout restoration, and isolation across App/session changes, and rendering every numeric display with negative, zero and positive measurements.

Manual checks to perform in the local preview:

- Open Payments API and inspect connectivity, explicit health, named instances and all widget types.
- Edit the shared layout, drag widget headers and bottom-right corner grips, open Move / size controls for keyboard-accessible buttons, finish positioning, then reload and verify the positions. Telemetry remains visible while editing; movement/resizing previews continuously and snaps on release. New widgets fill the first available gap instead of always appending below. A stale revision must preserve the visible draft and report conflict rather than overwrite.
- Add a widget before samples arrive by typing `number_cpu`, choosing number and Area chart, and setting a time window. Verify it remains after reload and starts displaying once a sender declares/sends that stream.
- Open Widget settings from Edit layout and change display/range/window. Verify automatic saves, including removal.
- Select log severity, chart window and older history; return to live. The bounded history label remains visible.
- Register an App, copy the one-time credentials and explicitly acknowledge saving them. Escape/backdrop must not discard the secret.
- Create/rename an empty tab, edit App tags/tab/retention/heartbeat, and verify nonempty-tab deletion errors.
- Inspect desktop and narrow layouts; dashboard canvas scrolls horizontally on narrow screens.
- Interrupt the synthetic server and restart it; connection state becomes stale/reconnecting, then snapshots reconcile.

Browser verification on 2026-10-26 used the local synthetic fixture: mouse resizing reduced the first value widget from four to three columns, then header dragging moved it one column right into the available gap. Both changes saved (revision 2) and survived a full page reload. Desktop and 390px layouts were inspected; the narrow canvas retains horizontal scrolling. Automated tests additionally cover continuous previews without intermediate saves, snapped release, cancellation, click-only gestures, locked widgets and gap-aware insertion. Real service/authentication integration and native-device gestures are outside this fixture's evidence.


## Widget behavior rework — 2026-10-26

- Line, area, bar and sparkline charts resize with their tile. Hover/tap or keyboard arrows inspect the exact value, receipt time and sender; Home/End jump to edges and Escape clears inspection. Line/area/sparkline use receipt-time spacing; bars compare individual samples. Constant and negative measurements remain valid.
- Text/value/status tiles can shrink to one row. New text and status tiles start small; existing saved dimensions are preserved. Text remains selectable, and Widget controls offers copying and full receipt details. Numeric values show change from the previous sample when space permits.
- Gauges scale their ring to available space. Progress is a thin meter; both retain actual values outside configured bounds and flag the range excursion.
- Log feeds are 12px monospace terminal lines with 18px line height, chronological order, horizontal scrolling by default on web and optional wrapping. Pause freezes the visible records while ingestion continues; Resume catches up. Scrolling up stops following, and Follow live resumes it. Search explicitly filters loaded entries; severity controls still search server-retained history.
- Event feeds use compact rows with expandable JSON fields, plus pause and loaded-entry search. Tables have received/sender/value columns, ordering, loaded-sample search and horizontal scrolling. Feed/table lists virtualize bounded records.
- Widget controls replaces the old large edit footer, preserving movement/size buttons, settings and removal without taking space from tiny tiles. Chart windows and log severity controls live in this menu.

Automated coverage adds pointer/keyboard chart inspection, geometry edge cases, single-row dimensions, full-precision clipboard action, pause/resume and retention expiry, follow behavior, log search, event expansion, table ordering/search and out-of-range progress values. Local browser checks verify single-row text visibility, real chart hover, continuously arriving log samples, frozen pause/catch-up and no-match search.

Implementation note: the house web Text component renders HTML spans. New widget code uses explicit pixel line-height classes rather than numeric style lineHeight, which CSS interprets as a multiplier. The shared Text component was not changed.

## Workspace layout rework — 2026-10-27

- Workspace tabs use a persistent active background, underline, bold label, selected ARIA state and a linked panel. Arrow keys, Home and End select workspaces; empty workspaces show a scoped empty state. Unsaved layouts disable workspace and App changes.
- The widget canvas takes the full content width. Switch App opens a workspace-scoped searchable selector; searching does not change the dashboard until an App is chosen.
- App details contains ID, health message, exact heartbeat times, retention, heartbeat timeout, streams/revision, tags and named-instance state. App settings and secret rotation are reached from this modal. Connectivity/health remain in the compact dashboard toolbar.
- New App registration defaults to the active workspace. Existing replication and widget persistence flows remain available.
- Check long workspace names, tab overflow, App selector no-match state, modal closing/focus return and light/dark themes. Phone controls wrap within the page; only the existing saved widget canvas scrolls horizontally.

Local results: 53 focused Support tests and web export pass. Browser verified desktop light/dark, 375/390px portrait and 844px landscape, real tab keyboard navigation, selector no-match state and App details modal. Toolbar content remains within the viewport. TypeScript reports 11 pre-existing diagnostics in `components/ui/heading/index.web.tsx` and `components/navigation/AppSidebar.tsx`; no Support diagnostics. Native-device testing and production deployment were not performed.

Action cleanup: the header has no Refresh or routine save-status text. Add widget, Edit layout, App details and Edit tab are in Dashboard actions (three dots). Done positioning and save-error recovery remain visible when relevant. Register App is in the App selector footer and empty-workspace state; the plus beside workspace tabs creates a tab. The house dropdown was verified on desktop and 390px phone, including opening/cancelling widget and registration forms and entering/exiting positioning.

Final action-cleanup validation: the current focused Support suite passes all 58 tests. The web export passes; existing shared TypeScript diagnostics remain.

## App tag editor — 2026-10-27

Registration, settings and replication share editable tag chips. Enter/Add creates a chip, selecting its name edits it, and × removes it. Save App includes unfinished tag input; Cancel does not persist changes. Suggestions reuse unselected tags across all Apps/tabs, filter without case sensitivity and show at most eight. Existing case-sensitive deduplication and 32-tag/64-character limits remain.

Validation: 58 focused Support tests and web export pass. A disposable browser fixture verified Enter, suggestion selection/filtering, chip editing/removal and tags surviving Save/reopening settings. TypeScript reports only the existing sidebar/heading errors. Native devices and production deployment were not checked.

## Sidebar workspaces — current navigation

HH Support is a top-level sidebar item; Logs opens system logs directly. Expand HH Support, then a workspace, then select an App. The synthetic fixture has VMs and Docker PC with three Apps each. App rows include all tag chips and a green status dot for online/healthy; offline/unhealthy is red, degraded is amber and unknown or disconnected data is gray. Open branches stay expanded independently. On phones, expand/collapse keeps the menu open and selecting an App closes it.

The page has no tab strip or App switcher. The plus beside HH Support in the sidebar or page header opens workspace management. Create a tab or edit an existing one; only empty tabs expose deletion. The API still rejects deletion when populated. Register App remains in Dashboard actions and the empty-workspace state. Check that unsaved dashboard layouts prevent App/workspace and sidebar route changes until saved/discarded. Status uses the existing Support connection; outside this page the cached tree remains available with unavailable status.

Sidebar hierarchy validation: 58 Support and 11 sidebar tests pass, web export passes, and TypeScript reports only seven existing shared-heading errors. Local browser checks verified both branches with three Apps each, App/dashboard selection, phone overlay dismissal, nonempty deletion omission, and dark/light status/tag rendering.

## Page timeframe and dense widgets — 2026-10-27

The header applies 30 minutes, 1 day, 7 days or an inclusive custom local interval to every widget by receipt time; health/connectivity badges remain current. Rolling ranges reconcile once per minute. Charts request a separate 60-bucket min/max summary with endpoints; raw table/metric/feed data stays separate. Key columns appear initially in machine snapshot tables; All columns reveals extras. Event details use a dialog to keep the feed compact.

Local checks: 105 Support tests and web export pass; 37 Support backend tests pass. Tests cover receipt boundaries, live samples outside a fixed range, separate raw/chart histories, preserved spikes/endpoints, and invalid bucket/cursor combinations. The browser verified seven-day selection, invalid custom-range feedback and applying a custom interval at localhost:8081/support. Existing seven shared-heading TypeScript errors remain; no Support diagnostics. The running preview's backend was not rebuilt/redeployed for this check, so its handling of new query parameters is covered by local backend tests rather than the browser. Native devices and a full responsive/theme sweep were not checked.

## Widget side inspector — 2026-10-27

Log and chart headers expose an Open in side panel arrow. One full-height right-side explorer opens at a time; the dashboard tile stays visible. Drag the left edge horizontally; keyboard users can use Left/Right (32px), Home (minimum 360px, bounded by viewport) or End (viewport width). Escape closes with focus return, while a chart first consumes Escape to clear value inspection. A narrow viewport bounds the inspector to screen width. Native uses a full-screen modal fallback.

Logs start wrapped and retain search, pause/resume, following, existing shared severity filtering and history paging. Select an entry to inspect its full message, severity, sender, source/receipt timestamps, stream and App ID; copy message or JSON. Entries removed from the displayed feed no longer show details. Opening/resizing does not save layout geometry; severity changes keep existing shared-widget persistence.

Validation: 114 Support tests and web export passed. Browser checked desktop log details, actual pointer resizing from 800px to 620px, chart expansion, and a 375×812 viewport with no panel horizontal overflow. Existing seven shared-heading TypeScript errors remain; no Support errors. Native devices, light theme and production deployment were not checked. Knowledge K6 size exception: retained the existing broad `support-widget-layout` topic for this focused inspector addition; splitting unrelated widget documentation is outside this change.

## Chart axes, marker and expanded layout — 2026-10-27

Line/area/bar charts show value ticks and receipt-time ticks. Compact sparklines retain their small footprint and show full axes when expanded. Measured plot dimensions now drive SVG coordinates, preventing stretched markers. Selection adds an exact-value/time tooltip beside the round dot. Expanded charts have a bounded plot, minimum/maximum/sample-count summaries, and selected/latest value, sender, receipt and sample details in a scrolling panel.

Validation: 116 Support tests and web export passed. Regression tests cover geometry at 900×80, a fixed four-pixel marker radius, exact tooltip precision and expanded sparkline axes/details. Browser verified a circular 8×8-pixel marker at narrow and desktop sizes, keyboard inspection, labeled axes and a 375×812 panel without horizontal overflow. TypeScript retains only the seven pre-existing shared-heading errors. Native devices, light theme and production deployment were not checked.

## Continuous feeds — 2026-10-27

Removed Pause/Resume controls and frozen sample state from Support log/event feeds, including the side inspector. Incoming samples always update the current feed; scrolling upward still stops automatic scrolling and Follow live returns to the bottom. Wrap fits long lines to the available width; No wrap retains horizontal scrolling. These are display settings and do not modify received messages.

Validation: 117 Support tests pass, including continuous dashboard/inspector updates, no Pause/Resume controls for either feed type, retained-entry filtering and scroll-follow behavior. Browser verified zero Pause/Resume buttons with the log inspector open. Native-device checks and a production deployment were not performed.
