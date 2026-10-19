# Findings
- Working tree initially clean in HyperHiveFront/HyperHive.
- DNS UI only creates/deletes alias/IP; existence precheck blocks metadata-only saves.
- Shared apiFetch already accepts empty/text success bodies and preserves plain-text errors.
- Supplied contract requires both metadata values on every form save; omission clears previous values.
- SilverBullet infrastructure inventory and operational history consulted; no server access or deployment authorized/needed.

- Canonical DNS note: knowledge/projetos/HyperHive/features/networking/dns-dhcp/dns-alias-crud. It documents an older source review, so the supplied API handoff controls this change.
- DNS reloads on route focus (including when remounted after VM deletion) and subscribes to VM deletion API outcomes while mounted. VM screen refreshes its inventory in finally, preserving backend partial-failure text.
- Installed Gluestack Select supports an empty-value option; the trigger explicitly displays the selected exact name and unavailable links are preserved until the user changes them.
- TypeScript passed. Initial nine focused API/form tests passed; expanded validation includes unchanged saves and VM-inventory/save failures.
