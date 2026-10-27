# Support app tags

## Goal
Create, edit and replicate Apps with removable/editable tag chips and suggestions from existing Apps. Persist only on Save, preserve existing tag limits and API shape.

### Phase 1: Inspect
**Status:** complete
Shared AppForm already receives all Apps. Backend trims and deduplicates case-sensitively; limits 32 tags, 64 characters. Preserve concurrent edits in checkout.

### Phase 2: Implement
**Status:** complete
Update AppForm only; no backend, config or exports needed. Update affected replication test and add focused tag interaction tests.

### Phase 3: Validate and document
**Status:** complete
Run support tests, TypeScript/build as appropriate; persist small canonical knowledge update.
