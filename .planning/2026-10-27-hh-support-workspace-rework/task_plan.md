# HH Support workspace rework

## Goal
Make tabs unmistakable and maximize widget area while keeping operational status scannable.

## Next Step
Implement the cascading App management menu and validate targeting.

## Current Phase
Cascading menu

### Phase 1: Discover and design
**Status:** complete
- Reviewed existing Support screen, modal/actions, tests and VM/SmartDisk reference pages.
- Consulted canonical Support widget behavior and UI guidelines in SilverBullet.

### Phase 2: Implement
**Status:** complete
- Preserve existing App replication changes and sidebar work.
- Replace permanent app sidebar with compact app selector.
- Move identity/configuration/instance details to existing modal system.
- Make tab selection and empty tabs consistent, including dirty-layout guards.

### Phase 3: Validate and deliver
**Status:** complete
- Focused Support tests, TypeScript and web export.
- Local synthetic desktop/mobile and light/dark browser checks.
- Update canonical Support knowledge with verified changes.

## Decisions
- Reuse existing Inter, monospace values, slate surfaces and teal accent. No new fonts or dependencies.
- Active tabs use shape, weight, underline and selected semantics; tab title identifies dashboard scope.
- Full-width widgets with 16/24px page gutters. Keep existing saved grid positions and native gesture controls.
- Use existing App forms and SupportDialog; keep health/connectivity visible and put verbose facts in details.

## Errors
- Frontend repository is nested at HyperHiveFront/HyperHive; initial parent-path read corrected.

### Phase 4: Simplify controls
**Status:** complete
- Remove Refresh and routine save text.
- Put dashboard controls in a three-dot menu; group registration with App selection and tab creation with tabs.
- Preserve visible error recovery and verify the updated flows.

### Phase 5: Sidebar hierarchy
**Status:** complete
- Promote HH Support out of Logs, render workspaces and Apps with status/tags.
- Share current Support inventory and selection through existing Zustand dependency; preserve unsaved guards.
- Remove in-page tabs/selector, keep + workspace management and empty-only deletion.
- Update tests, synthetic fixture and canonical knowledge.

### Phase 6: Cascading management menu
**Status:** in_progress
- Remove sidebar/page plus controls.
- Create an App first; Manage Apps side submenu for create/edit/delete and workspace management.
- Keep widget/layout/details actions below. Preserve tap/keyboard navigation and correct general-App mutation targets.
