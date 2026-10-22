# VM interface refinement

Preserve the existing host grouping, resource meters, teal palette, dialogs and API behavior. Refine the VM inventory and align the disk/template page shells with recent frontend work. Add local inventory search/state filters and explicit failed/stale inventory states, reusing existing components.

1. Inspect existing UI, pending changes and canonical design guidance (done).
2. Refine presentation and implement inventory controls (done).
3. Run focused tests/build and inspect desktop/mobile; save durable scope in SilverBullet (done).

Scope: app/vms.tsx, app/vms-disks.tsx, app/vms-xml-templates.tsx and VM tests. Preserve pending WebSocket/session changes. No infrastructure operations or new dependencies.
