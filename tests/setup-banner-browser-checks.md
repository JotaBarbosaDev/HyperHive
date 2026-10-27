# G01 setup banner spacing — 2026-10-27

The shared shell renders the setup banner in normal flex flow inside the same sidebar inset as route content. The banner's actual wrapped height reserves the required space. Removing the banner leaves no artificial header gap. GoAccess controls remain in the route region below it. The tutorial action and mismatch detection are unchanged.

Notes also explicitly wraps its header on web and keeps a readable minimum title width. The existing no-wrap header overlaid the title with action buttons at 375px; content and preview changes remain for NT01/NT02.

## Local validation

- `npm run build`: passes.
- `npx jest --config tests/jest.sidebar.config.cjs --runInBand`: 11 tests pass.
- `git diff --check`: passes.
- Synthetic browser: Notes at desktop, 375px and 768px; banner visible/hidden; collapsed sidebar; keyboard activation and dismissal of the tutorial; host-details shared offset; proxy GoAccess control clearance.
- At 375px the banner occupies x=64..375 and y=0..113. Notes starts at y=153, retaining its existing 40px page inset. Without the banner it starts at y=40.
- Proxy preview: banner bottom 45px, Open GoAccess top 109px; neither utility link was activated.
- The 768px Notes header fits its title and actions without overlap. Banner text is visible beside the sidebar instead of being hidden underneath it.

Evidence is in `/home/marques/projects/HyperHive/notes/ui-audit-2026-10-27/screenshots/milestone-01/g01-*.jpg`. The local fixture uses only synthetic API responses. No native device or production deployment checks were performed. Docker-specific verification remains deferred to milestone 11; no Docker page source was edited.
