# CellD operations workspace — 2026-10-18

Local production export, served on 127.0.0.1:8085, against the synthetic API on
127.0.0.1:8096. No server access, rollout or live-data qualification.

## Design and behavior

- Expanded fleet workspace with persistent desktop resource rail, header close
  control, and scrollable tab navigation at narrow widths. Historical fleets use
  the same workspace without deployment actions.
- Overview: reporting coverage, attention states, reported memory/cells, searchable
  node table, expandable node inspection, direct node-scoped logs/metrics, runtime
  workload tables, distinct configuration bindings, capabilities and history quota.
- Metrics: observed requests/errors/rate/duration and resource plots with axes,
  per-node colors, latest/peak values, legend toggles and sample inspection.
- Logs/events: compact chronological rows, severity markers, search, exact filters,
  UTC custom windows, immediate quick ranges, live follow/pause, message wrapping,
  expandable metadata, pagination and bounded NDJSON download.
- Trace: original log interval retained, filters from the log search cleared,
  correlated logs, parent/span identifiers, durations and proportional timing bars.
- All omitted values stay unknown; explicit zero remains visible. Partial coverage,
  stale/error states, collection timestamps and export bounds remain explicit.

## Validation

- TypeScript noEmit passes; 63 Jest tests pass including five new UI interaction
  regressions. Production Expo web export succeeds.
- Desktop browser: overview layout, node inspection, log expansion, trace navigation
  and stable parent/child spans, chart sample inspection, events search/empty state.
- Historical ID loads the read-only workspace and excludes the deployment tab;
  local fixture termination/restart also exercised the readable connection-error state.
- Mobile 390×844: header close control, horizontal navigation, wrapping query controls,
  vertical content scroll and internal table scroll. Document width equals viewport.
- Synthetic fixture timestamps stay fixed for logs/spans/events so clicking a trace
  later does not move its records beyond the source query window.

The initial shell used a consistent dark operations palette; the follow-up below
replaces it with the application light/dark palette. No dependencies or backend
contracts changed.

## Follow-up polish (2026-10-18)

Implemented app light/dark colors with an explicit context bridge through the
Gluestack modal portal. Filters now support Enter, strict UTC validation, coherent
clear/reset behavior, pending draft feedback and persisted applied searches per
tab without hidden polling. Live follow retains history and displays the latest
buffer page; reload retains successful results on failure. Empty traces wait for
an ID. Filter changes cancel exports without false timeout errors.

Resource charts now use measured geometry (readable labels on mobile), distinct
series, gaps for missing values/process generations, in-window samples and nearest
per-node sample inspection. Trace bars handle sub-millisecond spans; memory units
and small nonzero rates remain accurate. Late storage/deployment errors open their
previously collapsed disclosures.

The follow-up initially exposed lost app-theme context in the browser's modal.
The explicit bridge was added afterward. Fresh light/dark desktop/mobile visual
QA for this final polish remains pending: the previous browser error tab was
refused by browser URL policy, and the user was asked to close it and reopen
http://127.0.0.1:8085/celld-fleet. Earlier browser checks above apply to the previous
build, not to unverified polish. No server deployment was performed.

Final automated polish checks: TypeScript noEmit, all 77 Jest tests, and the
production web export pass. Added regressions include buffered follow pagination,
pending-draft preservation, export cancellation and waiting for future end times.
The local preview and synthetic API were left running for the requested fresh tab.

## Dense graphs, workloads and readable logs (2026-10-18)

Implemented after the browser checks above; these changes have automated coverage
and production-build verification, but fresh browser visual QA remains pending.

- Dense resource plots use bounded per-node SVG paths, min/max envelopes and
  preserved missing-data boundaries. Statistics and inspection use original data.
- Workloads have their own navigation page: separate runtime/configuration scopes,
  search, node/type filters, resource sorting, pagination, inspection and scoped
  logs/metrics. Overview now shows a compact workload inventory summary.
- Logs/events display full-width selectable messages with preserved newlines and
  wrapping for long URLs/IDs, exact clipboard copying, separate metadata/details
  and direct trace navigation. There is no message truncation or wrap toggle.
- TypeScript noEmit, all 84 Jest tests in 5 suites, production Expo web export and
  tracked diff whitespace check pass. Regressions include 100,000-point extrema
  preservation, bounded fragmented segments, a 10,000-point SVG chart, verbatim
  5,000-character multiline logs, and workload scope/filter/drilldown behavior.

Earlier preview service availability refers to the previous session; current
service availability is unverified. No deployment or live-data qualification.
