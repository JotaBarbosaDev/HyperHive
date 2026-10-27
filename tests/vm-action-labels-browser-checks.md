# VM02 action labels — 2026-10-27

Running VM cards show Pause, Restart, Shutdown and Details beneath their icons. Stopped and paused cards retain the existing Start and Resume text, and their Details icon now has a label. Accessible names still include the VM name. The existing handlers, disabled states and confirmations are unchanged.

The action row wraps into two balanced rows at phone and intermediate widths and fits in one row on wide desktop. Every icon control keeps a minimum 52px target.

## Local validation

- `npx jest --config tests/jest.support.config.cjs --testMatch '<rootDir>/tests/vms.test.js' --runInBand`: ten tests pass, including a focused check of labels and confirmation dialogs.
- `npm run build`: passes.
- `git diff --check`: passes.
- Synthetic browser inventory included running, stopped and paused VMs. At desktop and 375px, labels and layouts were inspected; Enter on Pause, and pointer activation of Restart and Shutdown, each opened the named VM's existing confirmation. Each was cancelled. Details opened the selected VM. Light and dark appearances were inspected.
- The fixture refuses all non-GET requests. No lifecycle action was confirmed or sent; no real VM, native device or deployment was tested.

Evidence is in `/home/marques/projects/HyperHive/notes/ui-audit-2026-10-27/screenshots/milestone-01/vm02-{desktop,phone,tablet,light}.jpg`. User acceptance is pending.
