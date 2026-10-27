import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { PanResponder, useWindowDimensions } from "react-native";
import { compatibleWidgets, getSupportHistory, mergeSamples, parseFrame, parseHistory, supportSocketUrl } from "../services/support-client";
import { useSupportLayout } from "../hooks/useSupportLayout";
import { useSupport } from "../hooks/useSupport";
import { availableWidgetPosition, movedWidget, sampleText, SupportWidget } from "../components/support/support-widget";
import { chartGeometry, WidgetChart } from "../components/support/widget-chart";
import { WidgetFeed, WidgetTable } from "../components/support/widget-feed";
import { defaultWidgetSize, minimumWidgetHeight } from "../components/support/widget-format";
import SupportScreen from "../app/support";
import { resetSupportNavigation, selectSupportApp, useSupportNavigation } from "../hooks/useSupportNavigation";
import { AppForm } from "../components/support/support-dialogs";
jest.mock("react-native", () => {
  const React = require("react");
  const View = ({ children, accessibilityLabel, style, testID, onPointerMove, onPointerLeave, onFocus, onBlur, onKeyDown, tabIndex }) => React.createElement("div", { "aria-label": accessibilityLabel, style, "data-testid": testID, onPointerMove, onPointerLeave, onFocus, onBlur, onKeyDown, tabIndex }, children);
  const ScrollView = React.forwardRef(({ children }, ref) => { React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() })); return React.createElement("div", null, children); });
  const FlatList = React.forwardRef(({ data, renderItem, ListEmptyComponent, testID, onScroll }, ref) => { React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() })); return React.createElement("div", { "data-testid": testID, onScroll: (event) => onScroll?.({ nativeEvent: { contentOffset: { y: event.currentTarget.scrollTop }, contentSize: { height: event.currentTarget.scrollHeight }, layoutMeasurement: { height: event.currentTarget.clientHeight } } }) }, data.length ? data.map((item, index) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }))) : ListEmptyComponent); });
  return { View, ScrollView, FlatList, Platform: { OS: "web" }, TextInput: React.forwardRef(({ accessibilityLabel, placeholder, value, onChangeText, onSubmitEditing, editable }, ref) => React.createElement("input", { ref, "aria-label": accessibilityLabel, placeholder, value, disabled: editable === false, onChange: (event) => onChangeText(event.target.value), onKeyDown: (event) => { if (event.key === "Enter") onSubmitEditing?.(); } })), Pressable: React.forwardRef(({ children, onPress, onHoverIn, accessibilityLabel, accessibilityRole, accessibilityState, disabled, onKeyDown, tabIndex, nativeID, "aria-controls": controls, "aria-selected": selected, "aria-disabled": ariaDisabled, "aria-expanded": expanded }, ref) => React.createElement("button", { ref, onClick: onPress, onMouseOver: onHoverIn, "aria-label": accessibilityLabel, role: accessibilityRole, "aria-selected": selected ?? accessibilityState?.selected, "aria-disabled": ariaDisabled, "aria-expanded": expanded, disabled, onKeyDown, tabIndex, id: nativeID, "aria-controls": controls }, children)), ActivityIndicator: () => "Loading", useWindowDimensions: jest.fn(() => ({ width: 1400 })), PanResponder: { create: jest.fn((handlers) => ({ panHandlers: handlers })) } };
});
jest.mock("react-native-svg", () => ({ __esModule: true, default: ({ children }) => children, Polyline: () => null, Polygon: () => null, Rect: () => null, Circle: () => null, Line: () => null }));
jest.mock("../components/ui/box", () => ({ Box: ({ children, style, testID, nativeID, role, accessibilityRole, accessibilityLabel, "aria-labelledby": labelledBy }) => <div style={style} data-testid={testID} id={nativeID} role={role ?? accessibilityRole} aria-label={accessibilityLabel} aria-labelledby={labelledBy}>{children}</div> }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, accessibilityLabel, onPress, isDisabled }) => <button aria-label={accessibilityLabel} onClick={onPress} disabled={isDisabled}>{children}</button>, ButtonText: ({ children }) => children }));
jest.mock("../components/ui/text", () => ({ Text: ({ children }) => children }));
jest.mock("../components/ui/heading", () => ({ Heading: ({ children }) => children }));
jest.mock("../components/ui/modal", () => {
  const Child = ({ children }) => children;
  return { Modal: Child, ModalBackdrop: () => null, ModalBody: Child, ModalContent: Child, ModalFooter: Child, ModalHeader: Child };
});
jest.mock("../components/ui/popover", () => ({
  Popover: ({ trigger, children, isOpen, onOpen, onClose }) => <>{trigger({ onPress: () => isOpen ? onClose() : onOpen() })}{isOpen ? children : null}</>,
  PopoverContent: ({ children }) => children,
  PopoverBackdrop: () => null,
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => undefined) }));
jest.mock("../hooks/useAuthGuard", () => ({ useAuthGuard: () => ({ token: "session", isChecking: false }) }));
jest.mock("../components/support/support-ui", () => {
  const React = require("react");
  return { Action: ({ label, onPress, disabled }) => React.createElement("button", { onClick: onPress, disabled }, label), Failure: ({ message }) => message, Field: ({ label, value, onChange }) => React.createElement("input", { "aria-label": label, value, onChange: (event) => onChange(event.target.value) }), State: ({ value }) => value };
});
describe("Support dashboard actions", () => {
  let root; let container;
  const click = async (label) => { await act(async () => [...container.querySelectorAll("button")].find((button) => (button.textContent === label || button.getAttribute("aria-label") === label)).click()); };
  beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); });
  const input = async (label, value) => {
    const field = container.querySelector(`[aria-label="${label}"]`);
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  test("creates chips with Enter, deduplicates tags and saves unfinished input", async () => {
    const onSave = jest.fn(async () => undefined);
    await act(async () => root.render(<AppForm tabs={[{ id: "tab", name: "General" }]} apps={[]} onClose={() => {}} onSave={onSave} />));
    await input("App name", "Tagged App"); await input("Add tag", " production ");
    await act(async () => container.querySelector('[aria-label="Add tag"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(container.querySelector('[aria-label="Remove tag production"]')).not.toBeNull();
    await input("Add tag", "production"); await click("Add tag");
    expect(container.querySelectorAll('[aria-label="Remove tag production"]')).toHaveLength(1);
    await input("Add tag", "worker"); await click("Save App");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tags: ["production", "worker"] }), undefined);
  });
  test("edits and removes tags locally, suggests tags across tabs, and persists only on Save", async () => {
    const onSave = jest.fn(async () => undefined);
    const tagged = { ...app, tags: ["api", "old"] };
    const other = { ...app, id: "other", tab_id: "other-tab", tags: ["production", "worker", "production"] };
    const render = () => root.render(<AppForm app={tagged} tabs={[{ id: "tab", name: "General" }]} apps={[tagged, other]} onClose={() => {}} onSave={onSave} />);
    await act(async () => render());
    expect(container.querySelectorAll('[aria-label="Use tag production"]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Use tag api"]')).toBeNull();
    await click("Remove tag old"); await click("Edit tag api"); await input("Edit tag", "backend"); await click("Update tag");
    expect(container.querySelector('[aria-label="Remove tag api"]')).toBeNull();
    expect(container.querySelector('[aria-label="Remove tag backend"]')).not.toBeNull();
    await input("Add tag", "PRO");
    expect(container.querySelector('[aria-label="Use tag production"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Use tag worker"]')).toBeNull();
    await click("Use tag production");
    expect(onSave).not.toHaveBeenCalled(); expect(tagged.tags).toEqual(["api", "old"]);
    await click("Save App");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tags: ["backend", "production"] }), undefined);
    await click("Remove tag backend"); await click("Remove tag production"); await click("Save App");
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ tags: [] }), undefined);
  });
  test("cancels tag edits, saves an active edit, and resets tag drafts when switching templates", async () => {
    const onSave = jest.fn(async () => undefined);
    await act(async () => root.render(<AppForm tabs={[{ id: "tab", name: "General" }]} apps={[{ ...app, tags: ["source"] }]} onClose={() => {}} onSave={onSave} />));
    await click("Replicate API"); await input("App name", "Copy"); await click("Edit tag source"); await input("Edit tag", "discarded"); await click("Cancel tag edit");
    expect(container.querySelector('[aria-label="Remove tag source"]')).not.toBeNull();
    await click("Edit tag source"); await input("Edit tag", "renamed"); await click("Save App");
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["renamed"] }), "app");
    await input("Edit tag", "unsaved"); await click("Blank App");
    expect(container.querySelector('[aria-label="Add tag"]').value).toBe("");
    expect(container.querySelector('[aria-label="Remove tag source"]')).toBeNull();
    await click("Save App"); expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ tags: [] }), undefined);
  });
  test("keeps invalid tags out of saved Apps and preserves draft on save failure", async () => {
    const onSave = jest.fn(async () => { throw new Error("Save failed"); });
    await act(async () => root.render(<AppForm app={app} tabs={[{ id: "tab", name: "General" }]} apps={[]} onClose={() => {}} onSave={onSave} />));
    await input("Add tag", "x".repeat(65)); await click("Add tag"); await click("Save App");
    expect(onSave).not.toHaveBeenCalled();
    await input("Add tag", Array.from({ length: 33 }, (_, index) => `tag${index}`).join(",")); await click("Save App");
    expect(onSave).not.toHaveBeenCalled();
    await input("Add tag", "valid"); await click("Add tag"); await click("Save App");
    expect(container.textContent).toContain("Save failed");
    expect(container.querySelector('[aria-label="Remove tag valid"]')).not.toBeNull();
  });
  test("keeps dashboard controls and registration in the overflow menu", async () => {
    await act(async () => root.render(React.createElement(SupportScreen)));
    for (const label of ["Refresh", "Create an App", "Add widget", "Edit layout", "App details"]) expect([...container.querySelectorAll("button")].some((button) => button.textContent === label)).toBe(false);
    expect(container.textContent).not.toContain("saved on server");
    await click("Dashboard actions");
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    expect([...container.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual(["Create an App", "Manage Apps›", "Add widget", "Edit layout", "App details"]);
    await click("Edit layout");
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(container.textContent).toContain("Done positioning");
    await click("Done positioning"); await click("Dashboard actions");
    expect(container.textContent).toContain("Create an App");
    await click("Create an App");
    expect(container.querySelector('[aria-label="App name"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Search Apps or tags"]')).toBeNull();
  });
  test("Manage Apps opens on hover and supports right, left and Escape keys", async () => {
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions");
    const manage = () => container.querySelector('[aria-label="Manage Apps"][role="menuitem"]');
    await act(async () => manage().dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(container.querySelector('[role="menu"][aria-label="Manage Apps"]')).not.toBeNull();
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit Apps").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(container.querySelector('[role="menu"][aria-label="Manage Apps"]')).toBeNull();
    await act(async () => manage().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(container.querySelector('[role="menu"][aria-label="Manage Apps"]')).not.toBeNull();
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit Apps").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
  test("phone Manage Apps opens on tap without hover replacing the pressed item", async () => {
    useWindowDimensions.mockReturnValue({ width: 390 });
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions");
    await act(async () => container.querySelector('[aria-label="Manage Apps"][role="menuitem"]').dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(container.querySelector('[role="menu"][aria-label="Manage Apps"]')).toBeNull();
    await click("Manage Apps");
    expect(container.querySelector('[role="menu"][aria-label="Manage Apps"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="App name"]')).toBeNull();
    await click("Back to dashboard actions");
    expect(container.querySelector('[role="menu"][aria-label="Dashboard actions"]')).not.toBeNull();
  });
  test("general App management edits and deletes its chosen App without changing the open dashboard", async () => {
    const original = fetchMock.getMockImplementation();
    let apps = [app, { ...app, id: "other", name: "Worker", tab_id: "workers", tags: ["jobs"] }];
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith("/tabs")) return response([{ id: "tab", name: "General" }, { id: "workers", name: "Workers" }]);
      if (url.endsWith("/apps")) return response(apps);
      if (url.endsWith("/apps/other") && options.method === "PUT") { apps[1] = { ...apps[1], ...JSON.parse(options.body) }; return response(apps[1]); }
      if (url.endsWith("/apps/other") && options.method === "DELETE") { apps = apps.filter((entry) => entry.id !== "other"); return { ...response(null), status: 204 }; }
      return original(url, options);
    });
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Manage Apps"); await click("Edit Apps");
    await input("Search Apps or tags", "jobs");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Edit API")).toBe(false);
    await click("Edit Worker"); await input("App name", "Renamed worker"); await click("Save App");
    expect(apps[1].name).toBe("Renamed worker");
    expect(useSupportNavigation.getState()).toMatchObject({ selectedId: "app", tabId: "tab" });
    await click("Dashboard actions"); await click("Manage Apps"); await click("Delete Apps"); await click("Delete Renamed worker");
    expect(container.textContent).toContain("This deletes Renamed worker");
    expect(fetchMock.mock.calls.some(([url, options]) => options.method === "DELETE")).toBe(false);
    await click("Delete App permanently");
    expect(apps).toHaveLength(1);
    expect(useSupportNavigation.getState()).toMatchObject({ selectedId: "app", tabId: "tab" });
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith("/apps/other") && options.method === "DELETE")).toBe(true);
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith("/apps/app") && options.method === "DELETE")).toBe(false);
  });
  test("keeps verbose App metadata in details while health remains visible", async () => {
    const original = fetchMock.getMockImplementation();
    const detailed = { ...app, id: "private-app-id", health: "unhealthy", health_message: "Database unavailable", last_heartbeat_at: "2026-10-27T12:00:00Z", instances: [{ instance_id: "worker-instance", connectivity: "offline", health: "unhealthy", health_message: "Sender timed out", last_heartbeat_at: null }] };
    fetchMock.mockImplementation(async (url, options) => url.endsWith("/apps") ? response([detailed]) : url.endsWith("/apps/private-app-id") ? response({ app: detailed, streams: [stream], layout: { revision: 0, widgets: [] } }) : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    expect(container.textContent).toContain("unhealthy");
    for (const text of ["private-app-id", "Last heartbeat:", "worker-instance", "day retention", "Database unavailable"]) expect(container.textContent).not.toContain(text);
    await click("Dashboard actions"); await click("App details");
    for (const text of ["private-app-id", "Last heartbeat:", "worker-instance", "7 day retention", "Database unavailable", "Sender timed out"]) expect(container.textContent).toContain(text);
    await click("Close");
    expect(container.textContent).not.toContain("private-app-id");
    expect(container.textContent).not.toContain("worker-instance");
  });
  test("sidebar selection changes the dashboard without page tabs or a switcher", async () => {
    const original = fetchMock.getMockImplementation();
    const worker = { ...app, id: "worker", name: "Queue", tab_id: "workers", tags: ["jobs"] };
    fetchMock.mockImplementation(async (url, options) => url.endsWith("/tabs") ? response([{ id: "tab", name: "General" }, { id: "workers", name: "Workers" }, { id: "empty", name: "Empty" }]) : url.endsWith("/apps") ? response([app, worker]) : url.endsWith("/apps/worker") ? response({ app: worker, streams: [], layout: { revision: 0, widgets: [] } }) : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.textContent).not.toContain("Switch App");
    expect(useSupportNavigation.getState().apps).toHaveLength(2);
    await act(async () => selectSupportApp("workers", "worker"));
    expect(container.textContent).toContain("Workers /Queue");
    await act(async () => selectSupportApp("empty", null));
    expect(container.textContent).toContain("No Apps in Empty");
    await act(async () => selectSupportApp("tab", "app"));
    expect(container.textContent).toContain("General /API");
  });
  test("workspace manager permits deletion only for empty workspaces", async () => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, options) => url.endsWith("/tabs") ? response([{ id: "tab", name: "General" }, { id: "empty", name: "Empty" }]) : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Manage Apps"); await click("Manage workspaces"); await click("Edit General");
    expect(container.textContent).not.toContain("Delete empty tab");
    await click("Cancel"); await click("Dashboard actions"); await click("Manage Apps"); await click("Manage workspaces"); await click("Edit Empty");
    expect(container.textContent).toContain("Delete empty tab");
    await click("Delete empty tab");
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith("/tabs/empty") && options.method === "DELETE")).toBe(true);
  });
  test("registration starts in the current workspace", async () => {
    const original = fetchMock.getMockImplementation();
    let saved;
    fetchMock.mockImplementation(async (url, options) => url.endsWith("/tabs") ? response([{ id: "tab", name: "General" }, { id: "workers", name: "Workers" }]) : url.endsWith("/apps") && options.method === "POST" ? (saved = JSON.parse(options.body), response({ app: { ...app, ...saved, id: "new-worker" }, secret: "worker-secret" })) : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    await act(async () => selectSupportApp("workers", null)); await click("Create an App"); await input("App name", "New worker"); await click("Save App");
    expect(saved.tab_id).toBe("workers");
  });
  test("registers, edits and deletes an App and creates a tab through their real form actions", async () => {
    let apps = [app];
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith("ws-ticket")) return response({ ticket: "ticket" });
      if (url.endsWith("/tabs")) return response(options.method === "POST" ? { id: "new-tab", ...JSON.parse(options.body) } : [{ id: "tab", name: "General" }]);
      if (url.endsWith("/apps") && options.method === "POST") { const created = { ...app, ...JSON.parse(options.body), id: "created" }; apps.push(created); return response({ app: created, secret: "registration-secret" }); }
      if (url.endsWith("/apps")) return response(apps);
      if (url.endsWith("/apps/created") && options.method === "PUT") { apps = apps.map((entry) => entry.id === "created" ? { ...entry, ...JSON.parse(options.body) } : entry); return response(apps[1]); }
      if (url.endsWith("/apps/created") && options.method === "DELETE") { apps = apps.filter((entry) => entry.id !== "created"); return { ...response(null), status: 204 }; }
      if (url.includes("/samples?")) return response({ samples: [], next_before: null });
      return response({ app: apps.find((entry) => url.endsWith(entry.id)) ?? app, streams: [], layout: { revision: 0, widgets: [] } });
    });
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Create an App"); await input("App name", "Worker queue"); await click("Save App");
    expect(container.textContent).toContain("registration-secret");
    await click("I saved the credentials");
    await click("Dashboard actions"); await click("App details"); await click("App settings"); await input("App name", "Renamed queue"); await click("Save App");
    expect(apps.find((entry) => entry.id === "created").name).toBe("Renamed queue");
    await click("Dashboard actions"); await click("App details"); await click("App settings"); await click("Delete App"); expect(apps).toHaveLength(2);
    await click("Delete App permanently"); expect(apps).toHaveLength(1);
    await click("Dashboard actions"); await click("Manage Apps"); await click("Manage workspaces"); await click("Create tab"); await input("Tab name", "Workers"); await click("Save tab");
    expect(fetchMock.mock.calls).toContainEqual(["https://hh.test/api/support/tabs", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Workers" }) })]);
  });
  test("replicates an existing App through registration with new tags and a destination tab", async () => {
    const original = fetchMock.getMockImplementation();
    let saved;
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith("/tabs")) return response([{ id: "tab", name: "General" }, { id: "new-tab", name: "Workers" }]);
      if (url.endsWith(`/apps/${app.id}/replicate`)) {
        saved = JSON.parse(options.body);
        return response({ app: { ...app, ...saved, id: "replica" }, secret: "replica-secret" });
      }
      return original(url, options);
    });
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Create an App"); await click(`Replicate ${app.name}`);
    expect(container.textContent).toContain("Starts with fresh telemetry and new credentials");
    expect(container.querySelector('[aria-label="Heartbeat timeout (seconds)"]')).toBeNull();
    await input("App name", "Worker replica"); await input("Add tag", "production, worker"); await click("Workers");
    await click("Save App");
    expect(saved).toEqual({ name: "Worker replica", tab_id: "new-tab", tags: ["production", "worker"] });
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith("/apps") && options.method === "POST")).toBe(false);
    expect(container.textContent).toContain("replica-secret");
    await click("I saved the credentials");
    expect(container.textContent).not.toContain("replica-secret");
  });
  test("switches from a template back to a blank App without replicating", async () => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, options) => url.endsWith("/apps") && options.method === "POST"
      ? response({ app: { ...app, ...JSON.parse(options.body), id: "blank" }, secret: "blank-secret" })
      : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Create an App"); await click(`Replicate ${app.name}`); await click("Blank App");
    expect(container.querySelector('[aria-label="Heartbeat timeout (seconds)"]')).not.toBeNull();
    await input("App name", "Blank"); await click("Save App");
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/replicate"))).toBe(false);
    expect(container.textContent).toContain("blank-secret");
  });
  test("rotation requires confirmation and presents the new credentials once", async () => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, options) => url.endsWith("rotate-secret") ? response({ secret: "new-one-time-secret" }) : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("App details"); await click("Rotate secret");
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("rotate-secret"))).toBe(false);
    expect(container.textContent).toContain("Existing senders stop authenticating immediately");
    await click("Replace secret");
    expect(container.textContent).toContain("new-one-time-secret");
    expect(container.textContent).toContain("https://hh.test/api/support/ingest");
    await click("I saved the credentials");
    expect(container.textContent).not.toContain("new-one-time-secret");
  });
  test("adds a compatible widget and preserves a conflicting draft until explicitly reloaded", async () => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, options) => url.endsWith("/layout") && options.method === "PUT" ? { ...response({ error: "Layout changed" }), ok: false, status: 409 } : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Add widget"); await input("Incoming stream name", "cpu"); await click("Add to dashboard");
    expect(container.textContent).toContain("Your draft is preserved");
    expect(selectSupportApp("other", "other-app")).toBe(false);
    expect(useSupportNavigation.getState().selectedId).toBe("app");
    await click("Dashboard actions");
    for (const label of ["Add widget", "Edit layout"]) expect([...container.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === label).disabled).toBe(true);
    await click("Dashboard actions");
    const request = fetchMock.mock.calls.find(([url, options]) => url.endsWith("/layout") && options.method === "PUT");
    expect(JSON.parse(request[1].body)).toMatchObject({ revision: 0, widgets: [expect.objectContaining({ kind: "value", stream: "cpu", w: 3 })] });
    await click("Reload saved layout");
    expect(container.textContent).not.toContain("Your draft is preserved");
  });
  test("configures a future numeric stream before samples, and saves its chart settings automatically", async () => {
    const original = fetchMock.getMockImplementation();
    let saved = { revision: 0, widgets: [] };
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith("/layout") && options.method === "PUT") { saved = { ...JSON.parse(options.body), revision: saved.revision + 1 }; return response(saved); }
      return original(url, options);
    });
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Add widget"); await input("Incoming stream name", "number_cpu"); await click("Area chart");
    await input("Time window (minutes)", "15"); await click("Add to dashboard");
    expect(saved.widgets[0]).toMatchObject({ stream: "number_cpu", stream_type: "number", kind: "area", window_minutes: 15 });
    expect(container.textContent).not.toContain("saved on server");
    expect(container.textContent).toContain("Waiting for number_cpu");
    await click("Dashboard actions"); await click("Edit layout"); await click("Widget controls"); await click("Widget settings"); await click("Progress");
    await input("Minimum", "10"); await input("Maximum", "90"); await click("Save widget");
    expect(saved.widgets[0]).toMatchObject({ kind: "progress", min: 10, max: 90 });
    expect(saved.widgets[0].window_minutes).toBeUndefined();
    await click("Widget controls"); await click("Remove"); expect(saved.widgets).toHaveLength(0);
  });

});
jest.mock("../config/apiConfig", () => ({ getApiBaseUrl: () => "https://hh.test/api" }));
const sample = (id, stream = "cpu") => ({ id, app_id: "app", stream, instance_id: null, received_at: "2026-10-26T12:00:00Z", timestamp: "2026-10-26T12:00:00Z", value: id });
const app = { id: "app", name: "API", tab_id: "tab", heartbeat_timeout_seconds: 120, retention_days: 7, instances: [], tags: [], connectivity: "online", health: "healthy" };
const stream = { name: "cpu", type: "number", label: "CPU", unit: "%" };
const response = (data) => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => data, text: async () => JSON.stringify(data) });
let fetchMock;
let sockets;
class Socket {
  constructor(url) { this.url = url; sockets.push(this); }
  sendFrame(frame) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  close() { this.onclose?.(); }
}
beforeEach(() => {
  resetSupportNavigation();
  useWindowDimensions.mockReturnValue({ width: 1400 });
  fetchMock = jest.fn(async (url) => response(url.endsWith("ws-ticket") ? { ticket: "one-time" } : url.endsWith("/tabs") ? [{ id: "tab", name: "General" }] : url.endsWith("/apps") ? [app] : url.includes("/samples?") ? { samples: [sample(1)], next_before: null } : { app, streams: [stream], layout: { revision: 0, widgets: [] } }));
  global.fetch = fetchMock;
  sockets = []; global.WebSocket = Socket;
  jest.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });
test("bounded sample merging deduplicates persistent IDs and keeps received order", () => {
  expect(mergeSamples([sample(3), sample(1)], [sample(2), sample(3)], 2).map((entry) => entry.id)).toEqual([2, 3]);
  expect(mergeSamples([], Array.from({ length: 1500 }, (_, index) => sample(index)))).toHaveLength(1000);
});
test("all five streams only offer compatible widgets", () => {
  expect(compatibleWidgets.number).toEqual(["value", "line", "area", "bar", "sparkline", "gauge", "progress", "table"]);
  expect(compatibleWidgets.text).toEqual(["value", "text", "table"]);
  expect(compatibleWidgets.boolean).toEqual(["value", "boolean", "table"]);
  expect(compatibleWidgets.log).toEqual(["logs", "table"]);
  expect(compatibleWidgets.event).toEqual(["events", "table"]);
});
test("socket URL uses only a one-time ticket and preserves the API prefix", () => {
  expect(supportSocketUrl("one time")).toBe("wss://hh.test/api/support/ws?ticket=one+time");
});
test("history uses bounded, escaped cursors and bearer authentication", async () => {
  await getSupportHistory("session", "a/b", "cpu load", 50);
  expect(fetchMock).toHaveBeenCalledWith("https://hh.test/api/support/apps/a%2Fb/samples?stream=cpu+load&limit=200&before=50", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer session" }) }));
});
test("rejects malformed history and oversized or invalid live frames", () => {
  expect(() => parseHistory({ samples: [], next_before: "bad" })).toThrow();
  expect(() => parseHistory({ samples: [sample("bad")], next_before: null })).toThrow();
  expect(() => parseFrame(JSON.stringify({ type: "samples", app_id: "app", samples: [{}] }))).toThrow();
  expect(() => parseFrame(" ".repeat(8 * 1024 * 1024 + 1))).toThrow();
  expect(() => parseFrame('{"type":"bogus"}')).toThrow();
});
test("accepts a valid maximum-instance state with Unicode health messages", () => {
  const participant = { connectivity: "online", health: "unhealthy", health_message: "😀".repeat(1024), last_heartbeat_at: "2026-10-26T12:00:00Z" };
  const frame = { type: "state", app: { ...app, ...participant, instances: Array.from({ length: 1024 }, (_, index) => ({ ...participant, instance_id: String(index).padStart(128, "i") })) } };
  const raw = JSON.stringify(frame);
  expect(raw.length).toBeGreaterThan(2 * 1024 * 1024);
  expect(parseFrame(raw).app.instances).toHaveLength(1024);
});
test("widget gestures clamp position and size to the twelve-column grid", () => {
  const widget = { kind: "line", x: 0, y: 0, w: 6, h: 7 };
  expect(movedWidget(widget, -900, -900, 60, false)).toEqual(widget);
  expect(movedWidget(widget, 900, 120, 60, false)).toMatchObject({ x: 6, y: 2 });
  expect(movedWidget(widget, 900, -900, 60, true)).toMatchObject({ w: 12, h: 3 });
  expect(movedWidget({ ...widget, x: 11, w: 1 }, 900, 0, 60, true)).toMatchObject({ x: 11, w: 1 });
});
test("text widgets resize down to one column in both preview and saved geometry", () => {
  const widget = { kind: "text", x: 0, y: 0, w: 3, h: 1 };
  expect(movedWidget(widget, -900, 0, 60, true)).toMatchObject({ w: 1, h: 1 });
  expect(movedWidget(widget, -900, 0, 60, true, false)).toMatchObject({ w: 1, h: 1 });
  expect(movedWidget({ ...widget, w: 1 }, 900, 0, 60, false)).toMatchObject({ x: 11, w: 1 });
  expect(movedWidget({ ...widget, kind: "value" }, -900, 0, 60, true)).toMatchObject({ w: 2 });
});
test("new widgets fill available gaps before extending the dashboard", () => {
  expect(availableWidgetPosition([], 6, 6)).toEqual({ x: 0, y: 0 });
  expect(availableWidgetPosition([{ x: 0, y: 0, w: 6, h: 6 }], 6, 6)).toEqual({ x: 6, y: 0 });
  expect(availableWidgetPosition([{ x: 0, y: 0, w: 6, h: 12 }, { x: 6, y: 0, w: 6, h: 4 }], 6, 6)).toEqual({ x: 6, y: 4 });
  expect(availableWidgetPosition([{ x: 0, y: 0, w: 12, h: 6 }], 12, 6)).toEqual({ x: 0, y: 6 });
  expect(availableWidgetPosition([{ x: 0, y: 0, w: 6, h: 6 }, { x: 6, y: 3, w: 6, h: 6 }], 6, 6)).toEqual({ x: 0, y: 6 });
});
test.each([false, true])("widget %s resize gesture previews continuously and only saves a snapped result on release", async (resize) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); const root = createRoot(container);
  const onChange = jest.fn(); const onInteraction = jest.fn();
  const widget = { id: "drag", stream: "cpu", kind: "value", x: 0, y: 0, w: 6, h: 6 };
  const props = { widget, stream, page: { samples: [{ ...sample(1), received_at: new Date().toISOString() }], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: true, onChange, onInteraction, onRemove: jest.fn() };
  try {
    await act(async () => root.render(<SupportWidget {...props} />));
    const [move, size] = PanResponder.create.mock.calls.slice(-2).map(([handlers]) => handlers);
    const handlers = resize ? size : move;
    expect(container.textContent).toContain("Received");
    await act(async () => handlers.onPanResponderGrant());
    await act(async () => handlers.onPanResponderMove(null, { dx: 75, dy: 95 }));
    const frame = container.querySelector('[data-testid="support-widget-drag"]');
    expect(resize ? frame.style.width : frame.style.left).toBe(resize ? "427px" : "75px");
    expect(resize ? frame.style.height : frame.style.top).toBe(resize ? "447px" : "95px");
    expect(onChange).not.toHaveBeenCalled();
    expect(onInteraction).toHaveBeenLastCalledWith(8);
    await act(async () => handlers.onPanResponderRelease(null, { dx: 75, dy: 95 }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining(resize ? { x: 0, y: 0, w: 7, h: 8 } : { x: 1, y: 2, w: 6, h: 6 }));
    expect(onInteraction).toHaveBeenLastCalledWith(null);
  } finally { await act(async () => root.unmount()); }
});
test("cancelled and click-only gestures do not save, and locked widgets cannot claim gestures", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  const onChange = jest.fn(); const onInteraction = jest.fn();
  const props = { widget: { id: "cancel", stream: "cpu", kind: "value", x: 0, y: 0, w: 6, h: 6 }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: true, onChange, onInteraction, onRemove: jest.fn() };
  try {
    await act(async () => root.render(<SupportWidget {...props} />));
    const handlers = PanResponder.create.mock.calls.at(-2)[0];
    await act(async () => { handlers.onPanResponderGrant(); handlers.onPanResponderMove(null, { dx: 120, dy: 60 }); handlers.onPanResponderTerminate(); });
    expect(onChange).not.toHaveBeenCalled();
    expect(onInteraction).toHaveBeenLastCalledWith(null);
    await act(async () => { handlers.onPanResponderGrant(); handlers.onPanResponderRelease(null, { dx: 0, dy: 0 }); });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => root.render(<SupportWidget {...props} editing={false} />));
    expect(handlers.onStartShouldSetPanResponder()).toBe(false);
  } finally { await act(async () => root.unmount()); }
});
test("telemetry labels format measurements and show readable log and event content", () => {
  expect(sampleText(17.484764536)).toBe("17.485");
  expect(sampleText(false)).toBe("False");
  expect(sampleText({ severity: "error", message: "Connection refused" })).toBe("Connection refused");
  expect(sampleText({ name: "deploy", fields: { version: "2.0", success: true } })).toBe("deploy · version: 2.0 · success: true");
});
test("history widget browses separate older pages and explicitly returns to live", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); const root = createRoot(container);
  fetchMock.mockResolvedValue(response({ samples: [{ ...sample(1, "logs"), value: { severity: "error", message: "old failure" } }], next_before: null }));
  const props = { widget: { id: "widget", stream: "logs", kind: "logs", x: 0, y: 0, w: 12, h: 7 }, stream: { name: "logs", type: "log", unit: "", label: "Logs" }, page: { samples: [{ ...sample(10, "logs"), value: { severity: "info", message: "new message" } }], next_before: 10 }, token: "session", appId: "app", retentionDays: 365, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
  try {
    await act(async () => root.render(React.createElement(SupportWidget, props)));
    expect(container.textContent).toContain("new message");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Older page").click());
    expect(container.textContent).toContain("old failure"); expect(container.textContent).not.toContain("new message");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Return to live").click());
    expect(container.textContent).toContain("new message");
  } finally { await act(async () => root.unmount()); }
});
test("severity searches retained history beyond 200 newer info logs, paginates matching records and follows live errors", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); const root = createRoot(container);
  const log = (id, severity, message) => ({ ...sample(id, "logs"), value: { severity, message } });
  const latestInfo = Array.from({ length: 200 }, (_, index) => log(index + 10, "info", "info " + index));
  const props = { widget: { id: "widget", stream: "logs", kind: "logs", severity: ["error"], x: 0, y: 0, w: 12, h: 7 }, stream: { name: "logs", type: "log", unit: "", label: "Logs" }, page: { samples: latestInfo, next_before: 10 }, token: "session", appId: "app", retentionDays: 365, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
  fetchMock.mockImplementation(async (url) => response(url.includes("before=") ? { samples: [log(1, "error", "older matching failure")], next_before: null } : { samples: [log(5, "error", "retained failure behind info")], next_before: 5 }));
  try {
    await act(async () => root.render(React.createElement(SupportWidget, props)));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("severity=error"), expect.any(Object));
    expect(container.textContent).toContain("retained failure behind info");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Older page").click());
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("before=5&severity=error"), expect.any(Object));
    expect(container.textContent).toContain("older matching failure");
    await act(async () => root.render(React.createElement(SupportWidget, { ...props, page: { ...props.page, samples: [...latestInfo.slice(1), log(210, "error", "live matching failure")] } })));
    expect(container.textContent).not.toContain("live matching failure");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Return to live").click());
    expect(container.textContent).toContain("live matching failure");
    expect(container.textContent).toContain("retained failure behind info");
  } finally { await act(async () => root.unmount()); }
});
describe("Support realtime reconciliation", () => {
  let root; let latest;
  function Harness() { latest = useSupport("session", "app"); return null; }
  beforeEach(() => { jest.useFakeTimers(); global.IS_REACT_ACT_ENVIRONMENT = true; root = createRoot(document.createElement("div")); });
  afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
  const mount = async () => { await act(async () => root.render(React.createElement(Harness))); };
  test("loads REST before ready, reconciles buffered live/history IDs, never polls and clears on reconnect", async () => {
    await mount(); expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(latest.detail.app.id).toBe("app"); expect(latest.hasSnapshot).toBe(true);
    await act(async () => { sockets[0].sendFrame({ type: "ready" }); sockets[0].sendFrame({ type: "samples", app_id: "app", samples: [sample(1), sample(2)] }); });
    expect(latest.connection).toBe("live"); expect(latest.history.cpu.samples.map((entry) => entry.id)).toEqual([1, 2]);
    const count = fetchMock.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(60000)); expect(fetchMock).toHaveBeenCalledTimes(count);
    await act(async () => sockets[0].close()); expect(latest.connection).toBe("reconnecting");
    await act(async () => jest.advanceTimersByTime(1000)); expect(sockets).toHaveLength(2);
    await act(async () => sockets[1].sendFrame({ type: "ready" }));
    expect(latest.history.cpu.samples.map((entry) => entry.id)).toEqual([1]);
  });
  test("saved dashboard remains usable when live tickets fail", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith("ws-ticket")) throw new Error("Live unavailable");
      return response(url.endsWith("/tabs") ? [{ id: "tab", name: "General" }] : url.endsWith("/apps") ? [app] : url.includes("/samples?") ? { samples: [sample(1)], next_before: null } : { app, streams: [stream], layout: { revision: 0, widgets: [] } });
    });
    await mount();
    expect(latest.detail.app.id).toBe("app"); expect(latest.error).toBe(null);
    expect(latest.liveError).toContain("Live unavailable"); expect(latest.isLoading).toBe(false);
  });
  test("blocked frontend Origin shows setup instructions without retrying sockets", async () => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, options) => url.endsWith("ws-ticket") ? { ...response({ error: "Configure SUPPORT_ALLOWED_ORIGINS on the master" }), ok: false, status: 403 } : original(url, options));
    await mount();
    expect(latest.liveError).toContain("SUPPORT_ALLOWED_ORIGINS");
    expect(latest.detail.app.id).toBe("app");
    expect(sockets).toHaveLength(0);
    const count = fetchMock.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(60000));
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });
  test("state updates connectivity separately from health and coalesces changed notifications", async () => {
    await mount(); await act(async () => sockets[0].sendFrame({ type: "ready" }));
    await act(async () => sockets[0].sendFrame({ type: "state", app: { ...app, connectivity: "online", health: "unhealthy" } }));
    expect(latest.detail.app.connectivity).toBe("online"); expect(latest.detail.app.health).toBe("unhealthy");
    const count = fetchMock.mock.calls.length;
    await act(async () => { sockets[0].sendFrame({ type: "changed" }); sockets[0].sendFrame({ type: "changed" }); jest.advanceTimersByTime(100); });
    expect(fetchMock.mock.calls.length - count).toBe(4);
  });
  test("accepts discovered stream names matching object prototype properties", async () => {
    await mount(); await act(async () => sockets[0].sendFrame({ type: "ready" }));
    await act(async () => sockets[0].sendFrame({ type: "samples", app_id: "app", samples: [sample(2, "constructor"), sample(3, "__proto__")] }));
    expect(latest.history.constructor.samples[0].id).toBe(2);
    expect(latest.history.__proto__.samples[0].id).toBe(3);
    expect(latest.connection).toBe("live");
  });
});

describe("Support automatic layout persistence", () => {
  let root; let latest;
  const empty = { revision: 3, widgets: [] };
  const widget = { id: "w", stream: "cpu", kind: "value", x: 0, y: 0, w: 6, h: 6 };
  function Harness({ id = "app", remote = empty, token = "session" }) { latest = useSupportLayout(token, id, remote); return null; }
  beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; root = createRoot(document.createElement("div")); });
  afterEach(async () => { await act(async () => root.unmount()); });
  const mount = async (props = {}) => { await act(async () => root.render(React.createElement(Harness, props))); };
  test("serializes rapid changes using acknowledged revisions and ignores older snapshots", async () => {
    let finish;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await mount();
    await act(async () => latest.change([widget]));
    await act(async () => latest.change([{ ...widget, x: 1 }]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockImplementationOnce(async (_url, options) => response({ ...JSON.parse(options.body), revision: 5 }));
    await act(async () => finish(response({ revision: 4, widgets: [widget] })));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ revision: 4, widgets: [{ ...widget, x: 1 }] });
    expect(latest.dirty).toBe(false);
    await mount({ remote: { revision: 4, widgets: [widget] } });
    expect(latest.layout.revision).toBe(5); expect(latest.layout.widgets[0].x).toBe(1);
  });
  test("preserves failed edits, requires retry, then restores saved layout on remount", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
    await mount(); await act(async () => latest.change([widget]));
    expect(latest.error).toContain("Your draft is preserved"); expect(latest.dirty).toBe(true);
    await act(async () => latest.change([{ ...widget, w: 7 }])); expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ revision: 4, widgets: [{ ...widget, w: 7 }] }));
    await act(async () => latest.retry()); expect(latest.dirty).toBe(false);
    await act(async () => root.unmount()); root = createRoot(document.createElement("div"));
    await mount({ remote: { revision: 4, widgets: [{ ...widget, w: 7 }] } }); expect(latest.layout.widgets[0].w).toBe(7);
  });
  test.each([{ id: "other" }, { token: "another-session" }])("never submits a draft into a changed app or session: %j", async (next) => {
    let finish;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await mount(); await act(async () => latest.change([widget]));
    await mount(next);
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(latest.layout.widgets).toHaveLength(0);
    await act(async () => finish(response({ revision: 4, widgets: [widget] })));
    expect(latest.layout.widgets).toHaveLength(0); expect(latest.saving).toBe(false);
  });
});

test.each(["value", "line", "area", "bar", "sparkline", "gauge", "progress", "table"])("renders numeric %s with negative, zero and positive measurements", async (kind) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); const root = createRoot(container);
  const props = { widget: { id: kind, stream: "cpu", kind, x: 0, y: 0, w: 6, h: 6, min: -10, max: 10 }, stream, page: { samples: [-5, 0, 5].map((value, index) => ({ ...sample(index + 1), received_at: new Date().toISOString(), value })), next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
  try {
    await act(async () => root.render(React.createElement(SupportWidget, props)));
    expect(container.textContent).toContain("CPU"); expect(container.textContent).toContain("5");
    expect(container.textContent).not.toContain("NaN");
  } finally { await act(async () => root.unmount()); }
});

describe("Widget behavior by data type", () => {
  let root; let container;
  const fresh = (id, value, instance = "worker-a") => ({ ...sample(id), value, instance_id: instance, received_at: new Date(Date.now() - (10 - id) * 1000).toISOString() });
  const render = async (element) => { await act(async () => root.render(element)); };
  const click = async (label) => { await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === label || button.getAttribute("aria-label") === label).click()); };
  const search = async (label, value) => { const field = container.querySelector(`[aria-label="${label}"]`); await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); }); };
  beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); });

  test("chart geometry handles constant, single, negative and unevenly timed samples", () => {
    for (const kind of ["line", "area", "bar", "sparkline"]) {
      for (const values of [[0], [-5, -5], [-5, 0, 5]]) {
        const result = chartGeometry(values.map((value, index) => fresh(index + 1, value)), kind);
        expect(result.max).toBeGreaterThan(result.min);
        expect(result.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.y >= 10 && point.y <= 120)).toBe(true);
        if (kind === "bar" || kind === "area") expect(result.baseline).toBeGreaterThanOrEqual(10);
      }
    }
    const timed = [0, 1000, 10000].map((time, index) => ({ ...fresh(index + 1, index), received_at: new Date(time).toISOString() }));
    expect(chartGeometry(timed, "line").points.map((point) => point.x)).toEqual([10, 40, 310]);
    expect(chartGeometry(timed, "bar").points.map((point) => point.x)).toEqual([60, 160, 260]);
  });
  test("charts inspect exact values and sender details with pointer and keyboard", async () => {
    await render(<WidgetChart samples={[fresh(1, 11.123456789, "first-worker"), fresh(2, 22.5)]} kind="line" stream="cpu" unit="%" />);
    const chart = container.querySelector('[data-testid="chart-cpu-line"]');
    chart.getBoundingClientRect = () => ({ left: 0, width: 320 });
    await act(async () => chart.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 10 })));
    expect(container.textContent).toContain("11.123456789"); expect(container.textContent).toContain("first-worker · sample 1");
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "End" })));
    expect(container.textContent).toContain("worker-a · sample 2");
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })));
    expect(container.textContent).toContain("first-worker · sample 1");
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    expect(container.textContent).not.toContain("sample 1");
  });
  test("compact defaults and resize limits let text, values and status fit a single row", async () => {
    for (const kind of ["text", "value", "boolean"]) {
      expect(minimumWidgetHeight(kind)).toBe(1);
      expect(movedWidget({ kind, x: 0, y: 0, w: 3, h: 4 }, 0, -900, 60, true).h).toBe(1);
    }
    expect(defaultWidgetSize("text")).toEqual({ w: 3, h: 1 });
    expect(defaultWidgetSize("logs").h).toBeGreaterThan(defaultWidgetSize("text").h);
    const props = { widget: { id: "tiny", stream: "version", kind: "text", x: 0, y: 0, w: 3, h: 1 }, stream: { name: "version", label: "Version", type: "text", unit: "" }, page: { samples: [fresh(1, "2.4.1")], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: true, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain("2.4.1"); expect(container.textContent).not.toContain("Received");
    expect(container.querySelector('[data-testid="support-widget-tiny"]').style.height).toBe("52px");
    await click("Widget controls"); expect(container.textContent).toContain("Shorter");
    await click("Copy latest value"); expect(require("expo-clipboard").setStringAsync).toHaveBeenCalledWith("2.4.1");
  });
  test("log lines are chronological, pause freezes the view while live samples arrive, resume catches up", async () => {
    const first = fresh(1, { severity: "info", message: "first-line" });
    const second = fresh(2, { severity: "error", message: "second-line" });
    await render(<WidgetFeed samples={[first]} kind="logs" retentionMs={86400000} />);
    await click("Pause");
    await render(<WidgetFeed samples={[first, second]} kind="logs" retentionMs={86400000} />);
    expect(container.textContent).toContain("first-line"); expect(container.textContent).not.toContain("second-line");
    await click("Resume");
    expect(container.textContent).toContain("second-line");
    expect(container.textContent.indexOf("first-line")).toBeLessThan(container.textContent.indexOf("second-line"));
    await search("Search loaded logs", "second-line");
    expect(container.textContent).not.toContain("first-line"); expect(container.textContent).toContain("second-line");
  });
  test("copying a measurement preserves its full numeric precision", async () => {
    const props = { widget: { id: "precise", stream: "cpu", kind: "value", x: 0, y: 0, w: 3, h: 2 }, stream, page: { samples: [fresh(1, 11.123456789)], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    await click("Widget controls"); await click("Copy latest value");
    expect(require("expo-clipboard").setStringAsync).toHaveBeenLastCalledWith("11.123456789");
  });
  test("scrolling up suspends following until the user explicitly follows live again", async () => {
    await render(<WidgetFeed samples={[fresh(1, { severity: "info", message: "line" })]} kind="logs" retentionMs={86400000} />);
    const feed = container.querySelector('[data-testid="feed-logs"]');
    Object.defineProperty(feed, "scrollHeight", { value: 1000 }); Object.defineProperty(feed, "clientHeight", { value: 100 });
    feed.scrollTop = 900;
    await act(async () => feed.dispatchEvent(new Event("scroll", { bubbles: true })));
    feed.scrollTop = 0;
    await act(async () => feed.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(container.textContent).toContain("Follow live");
    await click("Follow live"); expect(container.textContent).not.toContain("Follow live");
  });
  test("paused entries still expire at the retention boundary", async () => {
    jest.useFakeTimers();
    try {
      const entry = fresh(1, { severity: "info", message: "expired-line" });
      await render(<WidgetFeed samples={[entry]} kind="logs" retentionMs={10000} />);
      await click("Pause");
      await render(<WidgetFeed samples={[]} kind="logs" retentionMs={10000} />);
      expect(container.textContent).toContain("expired-line");
      await act(async () => jest.advanceTimersByTime(1001));
      expect(container.textContent).not.toContain("expired-line");
    } finally { jest.useRealTimers(); }
  });
  test("event feeds expand structured fields without turning each event into a large card", async () => {
    await render(<WidgetFeed samples={[fresh(1, { name: "release", fields: { version: "2.4.1", nested: { passed: true } } })]} kind="events" retentionMs={86400000} />);
    expect(container.textContent).toContain("release"); expect(container.textContent).not.toContain('"nested"');
    await click("Expand event 1"); expect(container.textContent).toContain('"nested"'); expect(container.textContent).toContain('"passed": true');
    await click("Collapse event 1"); expect(container.textContent).not.toContain('"nested"');
  });
  test("tables align received/sender/value fields and support ordering and loaded-sample search", async () => {
    await render(<WidgetTable samples={[fresh(1, "first-value"), fresh(2, "second-value")]} />);
    expect(container.textContent).toContain("ReceivedSenderValue");
    expect(container.textContent.indexOf("second-value")).toBeLessThan(container.textContent.indexOf("first-value"));
    await click("Newest first");
    expect(container.textContent.indexOf("first-value")).toBeLessThan(container.textContent.indexOf("second-value"));
    await search("Search loaded samples", "second-value"); expect(container.textContent).not.toContain("first-value");
  });
  test.each([[-20, "below range"], [125, "above range"]])("progress displays the actual %s value even outside its configured range", async (value, label) => {
    const props = { widget: { id: "progress", stream: "cpu", kind: "progress", x: 0, y: 0, w: 4, h: 2, min: 0, max: 100 }, stream, page: { samples: [fresh(1, value)], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain(String(value)); expect(container.textContent).toContain(label); expect(container.textContent).not.toContain("NaN");
  });
});
