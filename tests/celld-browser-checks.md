# celld fleet browser checks

Run the local frontend with a persistent terminal, then run the synthetic API:

    NODE_OPTIONS=--dns-result-order=ipv4first npm run web -- --port 8085 --host localhost
    node tests/fixtures/celld-api.cjs

Open http://127.0.0.1:8085/ in the browser. Sign in against
http://127.0.0.1:8096/api with a synthetic email/password. The fixture returns
a test token and never contacts real HyperHive servers.

The fixture simulates asynchronous API state; it does not qualify the actual
coordinator, SILO or agent processes. Backend module/race suites and the
disposable SILO/celld script cover those separately.

Verified through the browser on 2026-10-18:

- Authenticated fleet list: running, stopped and degraded fleets on overlapping servers.
- Create: name/server validation, duplicate-name conflict, reserved-port conflict,
  equal-port validation, automatic ports, durable 202/pending display.
- Edit: stable ID/bucket, membership change, running ports disabled, stopped ports
  editable and stopped state preserved.
- Machine checkboxes: pointer and Space key, checked state and field labels.
- Start, stop, rolling restart, one-node interruption notice and cancel.
- Delete: name confirmation, pending state, completion after refresh, offline
  deletion retained and credentials disabled while deleting.
- Detail: resolved IPs/ports/readiness/errors, URLs and CLI deployment command.
- Copy deploy command/environment; credentials are fetched only on reveal and
  disappear when details close/reopen.
- Storage: managed versus actual counts, bucket-name disclosure, unavailable
  counts stay unknown, reset-pending blocks creation.
- HTTP 503, old API 404 and malformed JSON: readable errors, last report retained,
  successful refresh recovers.
- Empty fleet list, session expiry redirects to login, successful sign-in restores
  fleet management.
- Responsive 390×844: page, form and detail remain usable without horizontal
  overflow; desktop and light/dark theme inspection.

The fixture supports POST /__test with JSON modes such as storageError,
legacyReset, listError, malformed, failNext, expireAuth, empty and reset.
These routes exist only in the local test fixture. GET /__test returns a
sanitized request history for verifying paths and submitted payloads.

Port regression (2026-10-18): HTTP-only 8080 sends 8080/8081; explicit
8082/9090 with surrounding spaces sends exact integer ports; blank fields
still omit ports for API automatic allocation. Verified in the browser fixture.
