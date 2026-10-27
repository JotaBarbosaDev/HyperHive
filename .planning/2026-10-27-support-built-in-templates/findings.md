# Findings

- Support permits widgets for streams not yet declared, with stream_type.
- Existing App creation stores the initial layout via the apps table default; extend the insert to set the chosen layout atomically.
- SilverBullet MCP tools are unavailable; knowledge retrieval and persistence cannot be performed.
- Frontend has pre-existing uncommitted changes in support.tsx, support-actions.tsx, support-dialogs.tsx and support.test.js.

## Linux Machine extension

- Canonical sender contract: HyperHive/docs/hh-support-linux-machine.md.
- 45 widgets remain below Support's 50-widget limit. No additional endpoint or storage change is needed.
- Identity is text; metrics are numeric; filesystem/interface/process/service/hardware snapshots are expandable events; system logs use log streams.
- SilverBullet tools remain unavailable; the knowledge update cannot be persisted there.
