# Findings

- services/websocket-client.ts throws when in-memory token/base URL are missing.
- app/_layout.tsx restores session asynchronously and retries disconnected sockets every five seconds.
- app/vms.tsx only subscribes after ensure resolves, so initial rejection loses VM updates; asynchronous subscription can also outlive effect cleanup.
- Existing callers ignore ensure's socket return; API calls still validate credentials separately.
- Pasted stack omits Error.message; source supports the hydration race but does not prove it was the only failure encountered.
- Existing unrelated change: components/ui/heading/index.web.tsx; preserve it.
