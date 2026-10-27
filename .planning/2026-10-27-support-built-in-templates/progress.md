# Progress

- Implemented built-in Small Template in Start from, including before the first App.
- Backend accepts template_id=small and atomically stores three pending-stream widgets with the new App.
- Unknown templates and applying templates during edit are rejected.
- Support Go suite: 34 tests pass across 10 packages.
- Frontend Support suite: 64 tests pass. Existing rename/delete fixture now waits for the 100ms debounced refresh.
- TypeScript: seven existing WebkitBoxOrient errors in components/ui/heading/index.web.tsx; no Support diagnostics.
- Web export passes. Browser/native-device checks and deployment were not performed.
- SilverBullet tools unavailable; persistent knowledge update remains unsaved. Repository integration documentation updated instead.

## Linux Machine template completed

Added 45 saved widgets for 42 documented streams, frontend selection and creation coverage, and a backend ingestion/overlap regression test. All 36 backend tests, all 66 frontend Support tests and the web export pass. Live deployment and browser/native-device verification were not performed; no Linux collector was built. SilverBullet persistence remains unavailable.

## Compact, log-focused revision

User requested smaller identity/resource tiles and more journal/system error visibility. Reused one-row compact metrics, moved logs above charts, added journal_logs/kernel_logs/service_logs/service_failures and warn/error/fatal defaults for system_logs. Updated source contract and synthetic preview. Backend/frontend tests and web export pass; desktop browser preview verified.

## Operational hierarchy revision

Reduced default layout to 20 widgets, prioritizing machine status and service failures, full-width warnings/errors, journal, then diagnostic logs and activity. Four essential charts and inventory sit lower down. Identity fits in a narrow/tall card. Added readable duration/byte/rate formatting while preserving raw copy and inspection. Backend tests pass; browser preview reviewed.

Final validation: all 36 backend tests and 83 frontend tests pass; web export passes. Final in-app desktop screenshot saved to /tmp/hh-linux-preview/linux-machine-priorities.png. Synthetic data only; no production deployment or existing-dashboard migration performed.

## Service failure emphasis

Reduced identity width from four to three columns and increased service failures from 8×3 to 9×4 grid cells. Moved the compact metric strip below the top panels; shifted following widgets one row down. Updated the local synthetic preview through its layout API and visually verified the result. Backend regression checks cover the new proportions and non-overlap.

Removed the full-width metric strip: readings now occupy a two-by-two block below identity in the left third. Service failures fill the right two-thirds for the entire overview height. Updated the template, regression checks, sender documentation and synthetic preview; desktop layout verified.
