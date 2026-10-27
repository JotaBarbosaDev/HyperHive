# Host details H03 validation — 2026-10-27

H03 replaces circular CPU/RAM/disk summary gauges with numeric readings, retains the visible per-core section and its Show more/less disclosure, and allows host-control cards to keep their own heights. IRQ, hugepage and isolation operations are unchanged.

Responsive rows explicitly override HStack's web no-wrap default. Core and history measurements use React Native Box containers, because the web HStack/VStack implementations render plain divs without onLayout. The measured core width takes precedence over a window-sized fallback; history charts use the available content width.

## Local checks

- `npx jest --config tests/jest.host-details.config.cjs --runInBand`: four tests pass, covering measured core disclosure, expansion/collapse state, history resizing and zero-width events, empty telemetry and load failure.
- `npm run build`: web export passes.
- `npx tsc --noEmit --pretty false`: seven existing TS2322 errors in `components/ui/heading/index.web.tsx` concerning WebkitBoxOrient. No host-details diagnostics.
- `git diff --check`: passes.

The browser used a disposable synthetic API at `http://127.0.0.1:8099/fixture-api`, rejecting mutations. Checked desktop (1280px), phone (375px) and intermediate (768px) wrapping; desktop light/dark readability; Enter-key core expansion/collapse; and actual `aria-expanded` false/true values. At 375px the history plot measured 229px and stayed inside its container. The shared setup banner still needs G01; it is outside H03.

Before evidence: `/home/marques/projects/HyperHive/notes/ui-audit-2026-10-27/screenshots/35-host-details.jpg`.
After evidence: `/home/marques/projects/HyperHive/notes/ui-audit-2026-10-27/screenshots/milestone-01/h03-{desktop,phone,phone-cores,tablet,light}.jpg`.

No native-device checks, production deployment or real host mutations were performed. H03 is ready for user review; acceptance is pending.
