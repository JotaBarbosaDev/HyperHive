# WebSocket session startup race

## Scope
Fix shared WebSocket startup before session hydration and VM listener lifecycle. All ensureHyperHiveWebsocket callers inspected; none consume its return value. No configuration, exports or fixtures need changes. Preserve genuine constructor and URL failures.

## Phases
- Investigation: complete. Layout restores credentials asynchronously; VM subscribes only after ensure succeeds.
- Implementation and regression test: complete.
- Verification and canonical knowledge update: complete.

## Next Step
Complete. Local fix and targeted tests are ready for review; no deployment performed.

## Errors Encountered
Initial frontend root was a parent folder; actual repository is HyperHiveFront/HyperHive. No source changed at the wrong path.
