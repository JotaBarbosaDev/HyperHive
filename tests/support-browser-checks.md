# HH Support local validation

The disposable fixture uses synthetic data and listens only on loopback. It does not contact HyperHive hosts. Start after exporting the web app:

```sh
npm run build
node tests/fixtures/support-api.cjs
```

Open `http://127.0.0.1:8097/`. Sign in with a synthetic email/password and API URL `http://127.0.0.1:8097/api`, then choose Logs → HH Support from the sidebar. The fixture contains all five stream types, all twelve widget kinds, an offline instance with independent unhealthy status, and more than one numeric history page. The fixture is a UI aid and deliberately does not reproduce production authentication or persistence.

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
- Edit the shared layout, drag widget headers and bottom-right corner grips, open Move / size controls for keyboard-accessible buttons, wait for “saved on server”, then reload and verify the positions. Telemetry remains visible while editing; movement/resizing previews continuously and snaps on release. New widgets fill the first available gap instead of always appending below. A stale revision must preserve the visible draft and report conflict rather than overwrite.
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
