# Findings
- Repository: /home/marques/projects/HyperHiveFront/HyperHive; latest VM change 3672f1d.
- Existing unrelated modification: components/mount/MountUsageGauge.tsx; preserve.
- Canonical UI guidelines preserve VM status-colored borders and host-grouped cards. Prior VM refinement permits proceeding without questions.
- Current state filters omit blocked/crashed/unknown/suspended VMs except under All.
- Host summary allocations currently shrink when search/state filters hide cards, which can misrepresent total host allocation.
- Search lacks an inline clear action and there is no visible filtered result count.
- Knowledge retrieved: HyperHive project index, frontend index and ui-rework-guidelines; approximately 3,000 tokens. Further persistence will target the existing VM scope section only.

Browser preview initially showed login, then restored the existing authenticated session before fixture login. No credentials were entered or operations executed. Desktop and 390px phone views inspected; stopped filter retains host-wide allocation, clear search restores results, document width equals viewport width. Multiple IPs made cards too tall; revised cards to show the first address and an additional-address count, with all addresses remaining in details. TypeScript has existing shared Heading WebkitBoxOrient errors; no VM errors.

User rejected the richer host header as too busy. Simplified each host to its name and one muted line with VM/running counts and host CPU/RAM capacity; retain only the subtle surrounding section background and neutral border. Removed resource panels, icon tile, extra label and per-host allocation display.

Latest request: show CPU/RAM allocation versus total and remaining capacity simply. Implemented compact text, all configured VM allocations (including stopped VMs), unknown capacity as dash, and explicit overallocation. Backend slave/info/mem.go computes TotalMB using bytes /1024/1024, so capacity and allocation use the same binary MB conversion; removed the previous rounding/decimal heuristic. Fifteen VM/WebSocket tests passed.
