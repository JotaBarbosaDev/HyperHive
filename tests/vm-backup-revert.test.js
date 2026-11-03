/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";

jest.mock("../config/apiConfig", () => ({ getApiBaseUrl: () => "https://hyperhive.test/api" }));
jest.mock("../services/auth-storage", () => ({ loadAuthToken: async () => "test-token" }));

// Minimal DOM stand-ins for the UI primitives the dialog uses.
const mockElement = ({ children }) => <div>{children}</div>;
for (const [name, exportName] of Object.entries({ box: "Box", text: "Text", heading: "Heading", vstack: "VStack", hstack: "HStack" })) {
  jest.doMock(`../components/ui/${name}`, () => ({ [exportName]: mockElement }));
}
jest.doMock("../components/ui/button", () => ({
  Button: ({ onPress, isDisabled, accessibilityLabel, children }) => <button onClick={onPress} disabled={isDisabled} aria-label={accessibilityLabel}>{children}</button>,
  ButtonText: mockElement, ButtonIcon: () => null, ButtonSpinner: () => null,
}));
jest.doMock("../components/ui/input", () => ({
  Input: ({ children }) => <fieldset>{children}</fieldset>,
  InputField: ({ onChangeText, ...props }) => <input value={props.value} aria-label={props.accessibilityLabel} onChange={(event) => onChangeText(event.target.value)} />,
}));
jest.doMock("../components/ui/checkbox", () => ({
  Checkbox: ({ isChecked, onChange, children }) => <label><input type="checkbox" aria-label="Start VM after revert" checked={isChecked} onChange={(event) => onChange(event.target.checked)} />{children}</label>,
  CheckboxIndicator: () => null, CheckboxIcon: () => null, CheckboxLabel: mockElement,
}));
jest.doMock("../components/ui/modal", () => ({
  Modal: ({ isOpen, children }) => isOpen ? <div role="dialog">{children}</div> : null,
  ...Object.fromEntries(["Backdrop", "Content", "Header", "Body", "Footer", "CloseButton"].map((name) => [`Modal${name}`, mockElement])),
}));
jest.mock("lucide-react-native", () => ({ AlertTriangle: () => null, Check: () => null }));

const { RevertBackupDialog } = require("../components/modals/RevertBackupDialog");
const { normalizeVmProgressMessage } = require("../utils/vmProgress");

const response = (data, status = 202) => ({
  ok: status >= 200 && status < 300, status, statusText: "fixture",
  headers: { get: () => "application/json" },
  json: async () => data, text: async () => JSON.stringify(data),
});
const backup = { id: "12", vmName: "mine-live", machineName: "", backupDate: new Date("2026-11-01T10:00:00Z"), size: 2, nfsShareId: 3, live: true };
const originalFetch = globalThis.fetch;
let fetchMock, root, container, onStarted;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fetchMock = jest.fn(async () => response({ status: "started", vm_name: "mine-live", backup_id: 12 }));
  globalThis.fetch = fetchMock;
  onStarted = jest.fn();
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  globalThis.fetch = originalFetch;
});

const mount = async (vmRunning) => {
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(
    <RevertBackupDialog backup={backup} vmName="mine-live" vmRunning={vmRunning} safetyShareLabel="backups-nfs" onClose={() => {}} onStarted={onStarted} />
  ));
};
const revertButton = () => container.querySelector('button[aria-label="Revert VM"]');
const typeName = async (value) => act(async () => {
  const input = container.querySelector('input[aria-label="Confirm VM name"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});

it("enables Revert only after the exact VM name and posts start_after", async () => {
  await mount(true);
  expect(container.textContent).toContain("backups-nfs");
  expect(container.textContent).toContain("graceful, up to 5 min");
  expect(container.querySelector('input[aria-label="Start VM after revert"]').checked).toBe(true);
  expect(revertButton().disabled).toBe(true);
  await typeName("mine");
  expect(revertButton().disabled).toBe(true);
  await typeName("mine-live");
  expect(revertButton().disabled).toBe(false);
  await act(async () => revertButton().click());
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://hyperhive.test/api/virsh/revertBackup/12");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual({ start_after: true });
  expect(onStarted).toHaveBeenCalledWith(backup);
});

it("defaults start-after off and hides the shutdown warning for a stopped VM", async () => {
  await mount(false);
  expect(container.querySelector('input[aria-label="Start VM after revert"]').checked).toBe(false);
  expect(container.textContent).not.toContain("graceful, up to 5 min");
});

it("shows the server error and does not report a start", async () => {
  fetchMock.mockResolvedValueOnce(response("revert conflict: revert in progress for mine-live", 409));
  await mount(false);
  await typeName("mine-live");
  await act(async () => revertButton().click());
  expect(onStarted).not.toHaveBeenCalled();
  expect(container.textContent).toContain("revert in progress");
});

it("splits progress ids on the last hyphen so hyphenated VM names keep their name", () => {
  expect(normalizeVmProgressMessage({ type: "RevertVM", data: "Revert progress for mine-live: 50.00%", extra: "mine-live-1762164000" }))
    .toMatchObject({ id: "mine-live-1762164000", vmName: "mine-live", title: "mine-live — Revert VM" });
  expect(normalizeVmProgressMessage({ type: "BackUpVM", data: "x", extra: "web-1762164000" }))
    .toMatchObject({ vmName: "web", title: "web — Copy VM" });
  expect(normalizeVmProgressMessage({ type: "MigrateVm", data: "x", extra: "no-timestamp" }).vmName).toBeUndefined();
});
