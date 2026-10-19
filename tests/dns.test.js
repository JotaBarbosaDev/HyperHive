/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { addDnsAlias, listDnsAliases, checkDnsAliasExists, removeDnsAlias } from "../services/dnsmasq";
import { deleteVM } from "../services/vms-client";

jest.mock("../config/apiConfig", () => ({ getApiBaseUrl: () => "https://hyperhive.test/api" }));
jest.mock("../services/auth-storage", () => ({ loadAuthToken: async () => "test-token" }));
jest.mock("../hooks/useAuthGuard", () => ({ useAuthGuard: () => ({ token: "test-token", isChecking: false }) }));
jest.mock("expo-router", () => ({ useFocusEffect: (callback) => require("react").useEffect(callback, [callback]) }));

// Exercise the screen's form and API flow with minimal DOM UI primitives.
const mockToast = { show: jest.fn() };
const mockElement = ({ children }) => <div>{children}</div>;
for (const name of ["box", "text", "heading", "vstack", "hstack"]) {
  const exportName = { box: "Box", text: "Text", heading: "Heading", vstack: "VStack", hstack: "HStack" }[name];
  jest.doMock(`../components/ui/${name}`, () => ({ [exportName]: mockElement }));
}
jest.doMock("react-native", () => ({ Platform: { OS: "web" }, ScrollView: mockElement, RefreshControl: () => null }));
jest.doMock("../components/ui/button", () => ({
  Button: ({ onPress, isDisabled, accessibilityLabel, children }) => <button onClick={onPress} disabled={isDisabled} aria-label={accessibilityLabel}>{children}</button>,
  ButtonText: mockElement, ButtonIcon: () => null, ButtonSpinner: () => null,
}));
jest.doMock("../components/ui/input", () => ({
  Input: ({ children, isDisabled }) => <fieldset disabled={isDisabled}>{children}</fieldset>,
  InputField: ({ onChangeText, ...props }) => <input value={props.value} placeholder={props.placeholder} aria-label={props.accessibilityLabel} onChange={(event) => onChangeText(event.target.value)} />,
}));
jest.doMock("../components/ui/modal", () => ({
  Modal: ({ isOpen, children }) => isOpen ? <div role="dialog">{children}</div> : null,
  ...Object.fromEntries(["Backdrop", "Content", "Header", "Body", "Footer", "CloseButton"].map((name) => [`Modal${name}`, mockElement])),
}));
jest.doMock("../components/ui/alert-dialog", () => ({
  AlertDialog: () => null,
  ...Object.fromEntries(["Backdrop", "Content", "Header", "Body", "Footer", "CloseButton"].map((name) => [`AlertDialog${name}`, mockElement])),
}));
jest.doMock("../components/ui/toast", () => ({ Toast: mockElement, ToastDescription: mockElement, ToastTitle: mockElement, useToast: () => mockToast }));
jest.doMock("../components/ui/select", () => ({
  Select: ({ selectedValue, onValueChange, isDisabled, children }) => <div><select aria-label="Related VM" value={selectedValue} disabled={isDisabled} onChange={(event) => onValueChange(event.target.value)}>{children}</select></div>,
  SelectItem: ({ label, value, isDisabled }) => <option value={value} disabled={isDisabled}>{label}</option>,
  SelectPortal: ({ children }) => children,
  SelectContent: ({ children }) => children,
  SelectScrollView: ({ children }) => children,
  SelectBackdrop: () => null, SelectTrigger: () => null, SelectInput: () => null, SelectIcon: () => null,
}));
jest.mock("lucide-react-native", () => ({ ChevronDown: () => null, Pencil: () => null, Plus: () => null, Trash2: () => null }));
const DnsScreen = require("../app/dns").default;

const entry = { alias: "app.home", ip: "192.0.2.10", ssh_username: "ubuntu", related_vm: "App VM" };
const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300, status, statusText: "fixture",
  headers: { get: () => typeof data === "string" ? "text/plain" : "application/json" },
  json: async () => data, text: async () => typeof data === "string" ? data : JSON.stringify(data),
});
const originalFetch = globalThis.fetch;
let fetchMock, root, container;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockToast.show.mockReset();
  fetchMock = jest.fn(async (url) => {
    if (url.endsWith("/dnsmasq/alias/all")) return response({ aliases: [entry] });
    if (url.endsWith("/virsh/getallvms")) return response([{ name: "App VM" }, { name: "other-vm" }]);
    if (url.includes("/dnsmasq/alias/get?")) return response({ exists: false });
    return response("");
  });
  globalThis.fetch = fetchMock;
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});
const callsTo = (path) => fetchMock.mock.calls.filter(([url]) => url.includes(path));
const button = (text) => [...container.querySelectorAll("button")].find((element) => element.textContent === text);
const click = async (element) => act(async () => element.click());
const change = async (element, value) => act(async () => {
  const proto = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const mount = async () => {
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<DnsScreen />));
};

it("lists metadata and tolerates older records before backend deployment", async () => {
  fetchMock.mockResolvedValueOnce(response({ aliases: [entry, { alias: "old.home", ip: "192.0.2.11" }] }));
  expect(await listDnsAliases()).toEqual([entry, { alias: "old.home", ip: "192.0.2.11", ssh_username: "", related_vm: "" }]);
});
it("saves populated and cleared metadata with an empty HTTP 200 body", async () => {
  await expect(addDnsAlias(entry)).resolves.toBeUndefined();
  await addDnsAlias({ ...entry, ssh_username: "", related_vm: "" });
  expect(callsTo("/alias/add").map(([, options]) => JSON.parse(options.body))).toEqual([entry, { ...entry, ssh_username: "", related_vm: "" }]);
});
it.each([400, 500])("preserves plain-text DNS errors (HTTP %s)", async (status) => {
  fetchMock.mockResolvedValueOnce(response("Unknown VM or DNS reload failed", status));
  await expect(addDnsAlias(entry)).rejects.toMatchObject({ status, message: "Unknown VM or DNS reload failed" });
});
it("keeps existence and removal requests limited to alias/IP", async () => {
  await expect(checkDnsAliasExists(entry)).resolves.toBe(false);
  await removeDnsAlias(entry);
  const [url] = callsTo("/alias/get?")[0];
  expect(url).toBe("https://hyperhive.test/api/dnsmasq/alias/get?alias=app.home&ip=192.0.2.10");
  expect(JSON.parse(callsTo("/alias/remove")[0][1].body)).toEqual({ alias: entry.alias, ip: entry.ip });
});
it("edits existing metadata without an existence check and clears both fields", async () => {
  await mount();
  await click(container.querySelector('[aria-label="Edit app.home"]'));
  expect(container.querySelector('input[aria-label="SSH username"]').value).toBe("ubuntu");
  expect(container.querySelector("select").value).toBe("App VM");
  await change(container.querySelector('input[aria-label="SSH username"]'), "");
  await change(container.querySelector("select"), "");
  await click(button("Save changes"));
  expect(callsTo("/alias/get?")).toHaveLength(0);
  expect(JSON.parse(callsTo("/alias/add")[0][1].body)).toEqual({ ...entry, ssh_username: "", related_vm: "" });
});
it("creates an alias with independently entered SSH text and the exact VM name", async () => {
  await mount();
  await click(button("Add Alias"));
  await change(container.querySelector('input[placeholder="nas.local"]'), "new.home");
  await change(container.querySelector('input[placeholder="192.168.1.10"]'), "192.0.2.20");
  await change(container.querySelector('input[aria-label="SSH username"]'), "manual-user");
  await change(container.querySelector("select"), "App VM");
  expect(container.querySelector('input[aria-label="SSH username"]').value).toBe("manual-user");
  await click([...container.querySelectorAll("button")].filter((element) => element.textContent === "Add Alias").at(-1));
  expect(JSON.parse(callsTo("/alias/add")[0][1].body)).toEqual({ alias: "new.home", ip: "192.0.2.20", ssh_username: "manual-user", related_vm: "App VM" });
});
it.each([200, 500])("refreshes DNS and VM options after a VM deletion response (HTTP %s)", async (status) => {
  await mount();
  const before = callsTo("/alias/all").length;
  fetchMock.mockImplementation(async (url) => {
    if (url.includes("/deletevm/")) return response(status === 200 ? "VM deleted successfully" : "VM deleted but DNS cleanup failed", status);
    if (url.endsWith("/alias/all")) return response({ aliases: [] });
    return response([]);
  });
  await act(async () => {
    if (status === 500) await expect(deleteVM("App VM")).rejects.toThrow("VM deleted but DNS cleanup failed");
    else await deleteVM("App VM");
  });
  expect(callsTo("/alias/all")).toHaveLength(before + 1);
  expect(callsTo("/virsh/getallvms")).toHaveLength(1);
  expect(container.textContent).toContain("No aliases configured");
});
it("preserves metadata on an unchanged edit save", async () => {
  await mount();
  await click(container.querySelector('[aria-label="Edit app.home"]'));
  await click(button("Save changes"));
  expect(JSON.parse(callsTo("/alias/add")[0][1].body)).toEqual(entry);
});
it("preserves a linked VM and permits SSH editing when VM inventory fails", async () => {
  const normal = fetchMock.getMockImplementation();
  fetchMock.mockImplementation(async (url, options) => url.endsWith("/virsh/getallvms") ? response("VM inventory unavailable", 500) : normal(url, options));
  await mount();
  await click(container.querySelector('[aria-label="Edit app.home"]'));
  expect(container.textContent).toContain("VM inventory unavailable");
  expect(container.querySelector("select").value).toBe("App VM");
  await change(container.querySelector('input[aria-label="SSH username"]'), "operator");
  await click(button("Save changes"));
  expect(JSON.parse(callsTo("/alias/add")[0][1].body)).toEqual({ ...entry, ssh_username: "operator" });
});
it("surfaces a plain-text save failure and keeps the form open", async () => {
  const normal = fetchMock.getMockImplementation();
  fetchMock.mockImplementation(async (url, options) => url.endsWith("/alias/add") ? response("DNS reload failed", 500) : normal(url, options));
  await mount();
  await click(container.querySelector('[aria-label="Edit app.home"]'));
  await click(button("Save changes"));
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  const renderedToast = document.createElement("div");
  const toastRoot = createRoot(renderedToast);
  await act(async () => toastRoot.render(mockToast.show.mock.calls.at(-1)[0].render({ id: "error" })));
  expect(renderedToast.textContent).toContain("DNS reload failed");
  await act(async () => toastRoot.unmount());
});
