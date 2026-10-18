# celld observability verification — 2026-10-18

Implementation is local source only, using docs/celld-observability-frontend.md
and the SilverBullet celld API/frontend note. No production hosts accessed.

## Behavior

Fleet details now open an overview, with Logs, Metrics, Events, Trace and
Deployment tabs. Existing lifecycle/CLI/credential controls remain available.
The separate history dialog accepts a fleet ID and has no mutation controls.

Overview polling runs every two seconds, skips in-flight requests, aborts on
close/tab change and retains the last successful response on errors. Node
states and observation times are explicit; absent numeric fields stay unavailable.
Resources and configured bindings are separate. CPU charts remain per node.

Logs/events/traces and metric samples support fixed-window cursor pagination.
Dates are entered as UTC ISO timestamps and sent as Unix milliseconds. Severity
is exact equality and text is case-sensitive. Changing applied filters resets
the cursor. Following uses overlapping windows, drains continuation cursors,
deduplicates opaque IDs and limits the buffer to 2,000 rows. Pause retains the
buffer. Records are presented in groups of 100 to bound rendered UI work.

Trace links preserve the observed interval and clear log-specific filters so
spans are not hidden by severity/source/workload filters. Empty spans are
explicitly explained. Request durations convert microseconds to milliseconds;
process CPU divides cpu_percent_x100 by 100, containers use cpu_percent.

The web NDJSON download uses the current filters, no cursor and limit=2000,
with explicit 2,000-line / 1 MiB limits. It is not a full-history export.

## Automated checks

Run:

    npx tsc --noEmit
    npx jest --config tests/jest.celld.config.cjs --runInBand
    EXPO_OFFLINE=1 CI=1 npm run build

Tests cover partial 200 data, missing/zero values and unit conversion, nested
schema errors, encoded IDs and filters, opaque pagination, trace validation,
metric samples, plain-text 401/session expiry, 400/404/503, bounded NDJSON,
follow cursor draining/window advancement/deduplication, pause, error retention,
filter reset, non-overlap, abort and suppression of late results.

## Browser evidence

Used only tests/fixtures/celld-api.cjs on loopback. Verified fleet detail tabs,
node CPU/memory and unavailable fields, capability limitations, logs, trace
spans plus correlated logs, per-node charts and request summary, exact severity
filter application, empty results, follow and pause, and read-only historical
fleet access. At 390×844 document width was 390 and the close button stayed
inside the viewport. Corrected the initial oversized modal and undefined filter
text found during browser checks. The UTC interval is retained when opening a
trace. Native-device behavior and live backend rollout are not claimed.

The fixture accepts observationState to exercise additional node states and
historical as a retained fleet ID. Unit tests separately qualify cursor behavior.

## Application / celld separation (2026-10-18)

- Normal Logs entry defaults to Application (`source=otlp`). Explicit saved
  searches retain their source, including All logs.
- Visible Application / celld / Containers / All logs choices commit server-side
  filtering and reset pagination. celld uses the master `source=process` group
  for stdout + stderr, requiring the matching master update.
- Switching origins clears workload scope; node/time/message filters remain.
  Clear filters retains the selected origin. Export uses the same source query.
- Message rows label Application, celld stdout/stderr and Container, with raw source
  retained in details. Backend tests exercise application retrieval past 205 noisy
  process records, grouped process pagination/export, and exact stderr compatibility.

## Terminal log view (2026-10-18)

- Compact 12px monospace rows: local time, severity, origin and full selectable
  message. Expand the gutter chevron for copy, trace and complete metadata.
- Logs/events render the bounded buffer in an independently scrolling viewport,
  replacing the 100-row display pages. The API continuation control remains.
- The viewport starts at the bottom and follows new rows. Scrolling up detaches
  auto-scroll while collection continues. Reaching the bottom or selecting Jump
  to latest reattaches it. Fresh Logs entry starts live follow; saved windows stay
  paused until explicitly followed.
- Automated scroll regression checks append, detach, preserved scroll, jump and
  reattachment. All 88 frontend tests and TypeScript pass. Production web export
  succeeds. Browser fixture verified 120 initial rows at bottom, scrolling up,
  arrival of five new rows without moving scrollTop, and jump to the new bottom.
- UI and browser evidence are local only; no frontend/server rollout performed.

## Live log streaming (2026-10-18)

- Follow for logs/events opens authenticated streaming fetch/SSE, with reconnect
  backoff, a receipt-time checkpoint and bounded replay. No interval log reads
  occur while the stream is supported. Old APIs/clients retain a visible polling
  fallback. Metrics/traces keep their existing read behavior.
- Source switching keeps live follow enabled and restarts the stream with the
  selected filters. Pause, close, query and token changes abort the old reader.
- Parser tests split frames/CRLF and multi-byte UTF-8 into one-byte chunks, test
  malformed pages, expiry, unsupported APIs, replay gaps and cancellation.
- Hook regressions verify that streaming does not poll, holds existing rows,
  resumes a receipt checkpoint and never advances it during incomplete replay.
- 94 frontend tests, TypeScript and production export pass. Browser against a
  synthetic API: one history GET plus one open SSE request; an injected message
  appears without another history GET. Closing the connection opens another SSE
  request using the previous receipt checkpoint, preserving displayed messages.
- Backend coverage separately verifies notification-based agent delivery,
  durable persistence before fanout, prompt acknowledgements, reconnects,
  assignment checks, source isolation and bounded slow-reader queues. Focused
  agent/master race checks pass. No real server rollout performed.
