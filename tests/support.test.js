import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { PanResponder, useWindowDimensions } from "react-native";
import { compatibleWidgets, getSupportHistory, mergeSamples, parseFrame, parseHistory, supportSocketUrl } from "../services/support-client";
import { useSupportLayout } from "../hooks/useSupportLayout";
import { useSupport } from "../hooks/useSupport";
import { alignWidget, availableWidgetPosition, movedWidget, sampleText, SupportWidget } from "../components/support/support-widget";
import { chartGeometry, WidgetChart } from "../components/support/widget-chart";
import { WidgetFeed, WidgetTable } from "../components/support/widget-feed";
import { defaultWidgetSize, eventSummary, measurementText, minimumWidgetHeight } from "../components/support/widget-format";
import { parseColumnWidths, snapshotRows, WidgetSnapshot } from "../components/support/widget-snapshot";
import SupportScreen from "../app/support";
import { resetSupportNavigation, selectSupportApp, useSupportNavigation } from "../hooks/useSupportNavigation";
import { AppForm, TabForm } from "../components/support/support-dialogs";
import { WidgetForm } from "../components/support/widget-form";
import { SupportSidePanel } from "../components/support/support-side-panel.web";
jest.mock("react-native", () => {
  const React = require("react");
  const View = jest.fn(({ children, accessibilityLabel, style, testID, onPointerMove, onPointerLeave, onFocus, onBlur, onKeyDown, tabIndex }) => React.createElement("div", { "aria-label": accessibilityLabel, style, "data-testid": testID, onPointerMove, onPointerLeave, onFocus, onBlur, onKeyDown, tabIndex }, children));
  const ScrollView = React.forwardRef(({ children }, ref) => { React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() })); return React.createElement("div", null, children); });
  const FlatList = React.forwardRef(({ data, renderItem, ListEmptyComponent, testID, onScroll }, ref) => { React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() })); return React.createElement("div", { "data-testid": testID, onScroll: (event) => onScroll?.({ nativeEvent: { contentOffset: { y: event.currentTarget.scrollTop }, contentSize: { height: event.currentTarget.scrollHeight }, layoutMeasurement: { height: event.currentTarget.clientHeight } } }) }, data.length ? data.map((item, index) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }))) : ListEmptyComponent); });
  return { View, ScrollView, FlatList, Platform: { OS: "web" }, TextInput: React.forwardRef(({ accessibilityLabel, placeholder, value, onChangeText, onSubmitEditing, editable }, ref) => React.createElement("input", { ref, "aria-label": accessibilityLabel, placeholder, value, disabled: editable === false, onChange: (event) => onChangeText(event.target.value), onKeyDown: (event) => { if (event.key === "Enter") onSubmitEditing?.(); } })), Pressable: React.forwardRef(({ children, onPress, onHoverIn, accessibilityLabel, accessibilityRole, accessibilityState, disabled, onKeyDown, tabIndex, nativeID, "aria-controls": controls, "aria-selected": selected, "aria-disabled": ariaDisabled, "aria-expanded": expanded }, ref) => React.createElement("button", { ref, onClick: onPress, onMouseOver: onHoverIn, "aria-label": accessibilityLabel, role: accessibilityRole, "aria-selected": selected ?? accessibilityState?.selected, "aria-disabled": ariaDisabled, "aria-expanded": expanded, disabled, onKeyDown, tabIndex, id: nativeID, "aria-controls": controls }, children)), ActivityIndicator: () => "Loading", useWindowDimensions: jest.fn(() => ({ width: 1400 })), PanResponder: { create: jest.fn((handlers) => ({ panHandlers: handlers })) } };
});
jest.mock("react-native-svg", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, viewBox }) => React.createElement("svg", { viewBox }, children), Polyline: () => null, Polygon: () => null, Rect: () => null, Circle: ({ cx, cy, r, testID }) => React.createElement("circle", { cx, cy, r, "data-testid": testID }), Line: () => null };
});
jest.mock("react-native-web/dist/exports/useWindowDimensions", () => jest.fn(() => ({ width: 1400 })));
jest.mock("lucide-react-native", () => ({ ChevronDown: () => null }));
jest.mock("../components/ui/box", () => ({ Box: ({ children, style, testID, nativeID, role, accessibilityRole, accessibilityLabel, "aria-labelledby": labelledBy }) => <div style={style} data-testid={testID} id={nativeID} role={role ?? accessibilityRole} aria-label={accessibilityLabel} aria-labelledby={labelledBy}>{children}</div> }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, accessibilityLabel, onPress, isDisabled }) => <button aria-label={accessibilityLabel} onClick={onPress} disabled={isDisabled}>{children}</button>, ButtonText: ({ children }) => children }));
jest.mock("../components/ui/text", () => ({ Text: ({ children }) => children }));
jest.mock("../components/ui/heading", () => ({ Heading: ({ children }) => children }));
jest.mock("../components/ui/modal", () => {
  const Child = ({ children }) => children;
  return { Modal: Child, ModalBackdrop: () => null, ModalBody: Child, ModalContent: Child, ModalFooter: Child, ModalHeader: Child };
});
jest.mock("../components/ui/select", () => {
  const React = require("react");
  const Context = React.createContext(null);
  return {
    Select: ({ children, selectedValue, onValueChange, isDisabled }) => { const portal = React.Children.toArray(children)[1]; const content = React.Children.toArray(portal.props.children)[1]; const options = React.Children.toArray(content.props.children).flat().map((item) => <option key={item.props.value} value={item.props.value}>{item.props.label}</option>); return <Context.Provider value={{ selectedValue, onValueChange, isDisabled, options }}>{children}</Context.Provider>; },
    SelectTrigger: ({ accessibilityLabel }) => { const value = React.useContext(Context); return <select aria-label={accessibilityLabel} value={value.selectedValue} disabled={value.isDisabled} onChange={(event) => value.onValueChange(event.target.value)}>{value.options}</select>; },
    SelectPortal: () => null, SelectBackdrop: () => null, SelectContent: () => null, SelectItem: () => null,
  };
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
  return { Action: ({ label, onPress, disabled }) => React.createElement("button", { onClick: onPress, disabled }, label), Failure: ({ message }) => message, Field: ({ label, value, onChange, error }) => React.createElement(React.Fragment, null, React.createElement("input", { "aria-label": label, value, onChange: (event) => onChange(event.target.value) }), error), State: ({ value }) => value };
});
describe("Support dashboard actions", () => {
  let root; let container;
  const click = async (label) => { await act(async () => [...container.querySelectorAll("button")].find((button) => (button.textContent === label || button.getAttribute("aria-label") === label)).click()); };
  test.each([["number", "Line chart", "68"], ["text", "Text", "v2.4.1"], ["boolean", "Status", "True"], ["log", "Log feed", "Retrying upstream connection"], ["event", "Event feed", "Deployment completed"]])("%s shows example input and the actual selected widget output without saving", async (type, display, expected) => {
    const onSave = jest.fn(); const onClose = jest.fn();
    await act(async () => root.render(<WidgetForm streams={[]} onSave={onSave} onClose={onClose} />));
    await click(type); await click(display); await input("Incoming stream name", "custom_stream");
    await click("See example");
    const body = JSON.parse(container.querySelector('[data-testid="widget-example-input"]').textContent);
    expect(body.streams[0]).toMatchObject({ name: "custom_stream", type });
    expect(body.samples.every((entry) => entry.stream === "custom_stream")).toBe(true);
    expect(container.querySelector('[data-testid="widget-example-output"]').textContent).toContain(expected);
    if (type === "event") { await click("Expand event 1"); expect(container.textContent).toContain("Versionv2.4.1"); }
    await click("Back to widget settings");
    expect(container.querySelector('[aria-label="Incoming stream name"]').value).toBe("custom_stream");
    expect(container.textContent).toContain(`Display this ${type} stream as`);
    expect(onSave).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
  test("received streams use a dropdown and snapshot streams show a real table preview", async () => {
    const streams = [{ name: "top_processes", label: "Top processes", type: "event", unit: "" }, ...Array.from({ length: 80 }, (_, index) => ({ name: `stream_${index}`, label: `Stream ${index}`, type: "number", unit: "%" }))];
    await act(async () => root.render(<WidgetForm streams={streams} onSave={jest.fn()} onClose={jest.fn()} />));
    const select = container.querySelector('select[aria-label="Received streams"]');
    expect(select.options).toHaveLength(82);
    expect([...container.querySelectorAll("button")].some((button) => button.textContent.includes("stream_79"))).toBe(false);
    await act(async () => { select.value = "top_processes"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await click("See example");
    expect(container.querySelector('[data-testid="snapshot-table"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="widget-example-output"]').textContent).toContain("24.5 %");
    const body = JSON.parse(container.querySelector('[data-testid="widget-example-input"]').textContent);
    expect(body.samples[0].value.fields.items[0]).toMatchObject({ pid: 1248, name: "worker" });
  });
  beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); });
  const input = async (label, value) => {
    const field = container.querySelector(`[aria-label="${label}"]`);
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const choose = async (label, value) => { await act(async () => { const select = container.querySelector(`select[aria-label="${label}"]`); select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); }); };
  test("creates chips with Enter, deduplicates tags and saves unfinished input", async () => {
    const onSave = jest.fn(async () => undefined);
    await act(async () => root.render(<AppForm tabs={[{ id: "tab", name: "General" }]} apps={[]} onClose={() => {}} onSave={onSave} />));
    await input("App name", "Tagged App"); await input("Add tag", " production ");
    await act(async () => container.querySelector('[aria-label="Add tag"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(container.querySelector('[aria-label="Remove tag production"]')).not.toBeNull();
    await input("Add tag", "production"); await click("Add tag");
    expect(container.querySelectorAll('[aria-label="Remove tag production"]')).toHaveLength(1);
    expect(container.textContent).toContain("A tag with this name already exists");
    await input("Add tag", "worker"); await click("Save App");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tags: ["production", "worker"] }), undefined);
  });
  test("prevents duplicate App and tab names", async () => {
    const onSave = jest.fn();
    await act(async () => root.render(<AppForm tabs={[{ id: "tab", name: "General" }]} apps={[app]} onClose={() => {}} onSave={onSave} />));
    await input("App name", ` ${app.name.toUpperCase()} `); await click("Save App");
    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("An App with this name already exists");
    await act(async () => root.render(<TabForm tabs={[{ id: "tab", name: "General" }]} onClose={() => {}} onSave={onSave} />));
    await input("Tab name", " general ");
    expect(container.textContent).toContain("A tab with this name already exists");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Save tab").disabled).toBe(true);
  });
  test("edits and removes tags locally, suggests tags across tabs, and persists only on Save", async () => {
    const onSave = jest.fn(async () => undefined);
    const tagged = { ...app, tags: ["api", "old"] };
    const other = { ...app, id: "other", name: "Other", tab_id: "other-tab", tags: ["production", "worker", "production"] };
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
    await choose("Start from", "app"); await input("App name", "Copy"); await click("Edit tag source"); await input("Edit tag", "discarded"); await click("Cancel tag edit");
    expect(container.querySelector('[aria-label="Remove tag source"]')).not.toBeNull();
    await click("Edit tag source"); await input("Edit tag", "renamed"); await click("Save App");
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["renamed"] }), "app");
    await input("Edit tag", "unsaved"); await choose("Start from", "blank");
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
    expect([...container.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual(["Create an App", "Manage Apps›", "Manage Tabs", "Add widget", "Edit layout", "App details"]);
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
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Delete App permanently").disabled).toBe(true);
    await input("Type Renamed worker to confirm", "wrong name");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Delete App permanently").disabled).toBe(true);
    await input("Type Renamed worker to confirm", "Renamed worker");
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
    await click("Dashboard actions"); await click("Manage Tabs"); await click("Edit General");
    expect(container.textContent).not.toContain("Delete empty tab");
    await click("Cancel"); await click("Dashboard actions"); await click("Manage Tabs"); await click("Edit Empty");
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
    await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(apps.find((entry) => entry.id === "created").name).toBe("Renamed queue");
    await click("Dashboard actions"); await click("App details"); await click("App settings"); await click("Delete App"); expect(apps).toHaveLength(2);
    await input("Type Renamed queue to confirm", "Renamed queue"); await click("Delete App permanently"); expect(apps).toHaveLength(1);
    await click("Dashboard actions"); await click("Manage Tabs"); await click("Create tab"); await input("Tab name", "Workers"); await click("Save tab");
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
    await click("Dashboard actions"); await click("Create an App"); await choose("Start from", app.id);
    expect(container.textContent).toContain("Telemetry and credentials are new");
    expect(container.querySelector('[aria-label="Heartbeat timeout (seconds)"]')).toBeNull();
    await input("App name", "Worker replica"); await input("Add tag", "production, worker"); await choose("Tab", "new-tab");
    await click("Save App");
    expect(saved).toEqual({ name: "Worker replica", tab_id: "new-tab", tags: ["production", "worker"] });
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith("/apps") && options.method === "POST")).toBe(false);
    expect(container.textContent).toContain("replica-secret");
    await click("I saved the credentials");
    expect(container.textContent).not.toContain("replica-secret");
  });
  test("offers built-in templates before the first App and clears them when choosing blank", async () => {
    const onSave = jest.fn(async () => undefined);
    await act(async () => root.render(<AppForm tabs={[{ id: "tab", name: "General" }]} apps={[]} onClose={() => {}} onSave={onSave} />));
    expect([...container.querySelectorAll('select[aria-label="Start from"] option')].map((option) => option.textContent)).toEqual(["Blank App", "Small Template", "Linux Machine"]);
    await choose("Start from", "template:small");
    expect(container.textContent).toContain("CPU value, CPU trend and log feed");
    await input("App name", "Small"); await click("Save App");
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ template_id: "small", tab_id: "tab" }), undefined);
    await choose("Start from", "blank"); await click("Save App");
    expect(onSave.mock.calls[1][0]).not.toHaveProperty("template_id");
  });
  test.each([["small", "Small monitor"], ["linux-machine", "Linux server"]])("creates built-in template %s through the normal App request with fresh credentials", async (templateId, name) => {
    const original = fetchMock.getMockImplementation();
    let saved;
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith("/apps") && options.method === "POST") {
        saved = JSON.parse(options.body);
        return response({ app: { ...app, ...saved, id: "small-app" }, secret: "small-secret" });
      }
      return original(url, options);
    });
    await act(async () => root.render(<SupportScreen />));
    await click("Dashboard actions"); await click("Create an App");
    await choose("Start from", app.id); await choose("Start from", "template:" + templateId);
    await input("App name", name); await input("Add tag", "example"); await click("Save App");
    expect(saved).toEqual({ name, tab_id: "tab", tags: ["example"], heartbeat_timeout_seconds: 120, retention_days: 7, template_id: templateId });
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/replicate") || url.endsWith("/layout"))).toBe(false);
    expect(container.textContent).toContain("small-secret");
    await click("I saved the credentials");
    expect(container.textContent).not.toContain("small-secret");
  });
  test("switches from a built-in template to an existing App without sending template settings", async () => {
    const onSave = jest.fn(async () => undefined);
    await act(async () => root.render(<AppForm tabs={[{ id: "tab", name: "General" }]} apps={[app]} onClose={() => {}} onSave={onSave} />));
    await choose("Start from", "template:small"); await choose("Start from", app.id);
    await input("App name", "Replica"); await click("Save App");
    expect(onSave).toHaveBeenCalledWith(expect.not.objectContaining({ template_id: expect.anything() }), app.id);
  });
  test("switches from a template back to a blank App without replicating", async () => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, options) => url.endsWith("/apps") && options.method === "POST"
      ? response({ app: { ...app, ...JSON.parse(options.body), id: "blank" }, secret: "blank-secret" })
      : original(url, options));
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Create an App"); await choose("Start from", app.id); await choose("Start from", "blank");
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
  test("layout preview can be cancelled, applied and undone", async () => {
    const original = fetchMock.getMockImplementation();
    let saved = { revision:0, widgets:[{id:"one", stream:"cpu", kind:"value", x:4, y:3, w:3, h:2}] };
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith("/layout") && options.method === "PUT") { saved = {...JSON.parse(options.body), revision:saved.revision + 1}; return response(saved); }
      if (url.endsWith("/apps/app")) { const result = await original(url, options); const value = await result.json(); return response({...value, layout:saved}); }
      return original(url, options);
    });
    await act(async () => root.render(React.createElement(SupportScreen)));
    await click("Dashboard actions"); await click("Edit layout"); await click("Preview tidy layout");
    expect(container.textContent).toContain("Preview only.");
    await click("Cancel preview"); expect(saved.widgets[0].x).toBe(4);
    await click("Preview tidy layout"); await click("Apply arrangement");
    expect(saved.widgets[0]).toMatchObject({x:0,y:0});
    await click("Undo arrangement"); expect(saved.widgets[0]).toMatchObject({x:4,y:3});
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
test.each([
  [0, "s", "0 s"], [59, "s", "59 s"], [60, "s", "1m 0s"], [3661, "s", "1h 1m"], [1250340, "s", "14d 11h"], [-90, "s", "-1m 30s"],
  [0, "bytes", "0 B"], [1023, "bytes", "1,023 B"], [1024, "bytes", "1 KiB"], [34359738368, "bytes", "32 GiB"],
  [1572864, "bytes/s", "1.5 MiB/s"], [-1073741824, "B", "-1 GiB"], [42, "requests", "42 requests"], [12.34567, undefined, "12.346"], [62.434, "%", "62.4 %"],
])("formats measurement %s %s readably", (value, unit, expected) => {
  expect(measurementText(value, unit)).toBe(expected);
});
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
test("text widgets keep a usable minimum width", () => {
  const widget = { kind: "text", x: 0, y: 0, w: 3, h: 1 };
  expect(movedWidget(widget, -900, 0, 60, true)).toMatchObject({ w: 3, h: 2 });
  expect(movedWidget(widget, -900, 0, 60, true, false)).toMatchObject({ w: 3, h: 2 });
  expect(movedWidget({ ...widget, w: 1 }, 900, 0, 60, false)).toMatchObject({ x: 11, w: 1 });
  expect(movedWidget({ ...widget, kind: "value" }, -900, 0, 60, true)).toMatchObject({ w: 3, h: 2 });
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
  let root; let latest; let renders;
  function Harness() { renders++; latest = useSupport("session", "app"); return null; }
  beforeEach(() => { renders = 0; jest.useFakeTimers(); global.IS_REACT_ACT_ENVIRONMENT = true; root = createRoot(document.createElement("div")); });
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
  test("batches 3000 live samples across 30 streams and preserves unrelated histories", async () => {
    await mount(); await act(async () => sockets[0].sendFrame({ type: "ready" }));
    const untouched = latest.history.cpu;
    const previous = latest.history;
    const previousRenders = renders;
    const requests = fetchMock.mock.calls.length;
    await act(async () => {
      for (let batch = 0; batch < 300; batch++) sockets[0].sendFrame({ type: "samples", app_id: "app", samples: Array.from({ length: 10 }, (_, i) => sample(10 + batch * 10 + i, `stream-${batch % 30}`)) });
    });
    expect(latest.history).toBe(previous);
    expect(renders).toBe(previousRenders);
    await act(async () => jest.advanceTimersByTime(100));
    expect(renders - previousRenders).toBe(1);
    expect(Object.keys(latest.history)).toHaveLength(31);
    expect(latest.history.cpu).toBe(untouched);
    expect(Object.values(latest.history).reduce((sum, page) => sum + page.samples.length, 0)).toBe(3001);
    expect(fetchMock).toHaveBeenCalledTimes(requests);
    const page = latest.history["stream-0"];
    expect(page.samples).toHaveLength(100);
    expect(page.samples.map((entry) => entry.id)).toEqual(page.samples.map((entry) => entry.id).sort((a, b) => a - b));
  });
  test("bounds burst buffers and discards queued samples on disconnect", async () => {
    await mount(); await act(async () => sockets[0].sendFrame({ type: "ready" }));
    await act(async () => {
      for (let batch = 0; batch < 3; batch++) sockets[0].sendFrame({ type: "samples", app_id: "app", samples: Array.from({ length: 1000 }, (_, i) => sample(10 + batch * 1000 + i)) });
      jest.advanceTimersByTime(100);
    });
    expect(latest.history.cpu.samples).toHaveLength(1000);
    expect(latest.history.cpu.samples[0].id).toBe(2010);
    expect(latest.history.cpu.next_before).toBe(2010);
    await act(async () => {
      for (let batch = 0; batch < 3; batch++) sockets[0].sendFrame({ type: "samples", app_id: "app", samples: Array.from({ length: 1000 }, (_, i) => sample(10 + batch * 1000 + i, "new-stream")) });
      jest.advanceTimersByTime(100);
    });
    expect(latest.history["new-stream"].samples).toHaveLength(1000);
    expect(latest.history["new-stream"].next_before).toBe(2010);
    await act(async () => { sockets[0].sendFrame({ type: "samples", app_id: "app", samples: [sample(9999)] }); sockets[0].close(); jest.advanceTimersByTime(100); });
    expect(latest.history.cpu.samples.at(-1).id).toBe(3009);
  });
  test("keeps receiving bursts during REST reconciliation without reconnecting or losing live samples", async () => {
    await mount(); await act(async () => sockets[0].sendFrame({ type: "ready" }));
    const originalFetch = fetchMock.getMockImplementation();
    let finish;
    fetchMock.mockImplementation((url, options) => url.includes("/samples?") ? new Promise((resolve) => { finish = () => resolve(response({ samples: [sample(1)], next_before: null })); }) : originalFetch(url, options));
    await act(async () => { latest.refresh(); jest.advanceTimersByTime(100); });
    await act(async () => {
      for (let id = 2; id < 302; id++) sockets[0].sendFrame({ type: "samples", app_id: "app", samples: [sample(id)] });
      jest.advanceTimersByTime(100);
    });
    expect(latest.connection).toBe("live");
    expect(latest.history.cpu.samples).toHaveLength(1);
    await act(async () => finish());
    expect(latest.history.cpu.samples).toHaveLength(301);
    expect(latest.history.cpu.samples.at(-1).id).toBe(301);
    expect(sockets).toHaveLength(1);
  });
  test("live updates preserve unrelated chart pages and timeframe filtering", async () => {
    const timeframe = { since: "2026-10-26T11:00:00Z", until: "2026-10-26T13:00:00Z" };
    const originalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, options) => url.endsWith("/apps/app") ? response({ app, streams: [stream, { ...stream, name: "memory" }], layout: { revision: 0, widgets: [{ stream: "cpu", kind: "line" }, { stream: "memory", kind: "line" }] } }) : originalFetch(url, options));
    function Charts() { latest = useSupport("session", "app", timeframe); return null; }
    await act(async () => root.render(<Charts />));
    const untouched = latest.chartHistory.memory;
    await act(async () => { sockets[0].sendFrame({ type: "samples", app_id: "app", samples: [sample(2), { ...sample(3), received_at: "2026-10-26T14:00:00Z" }] }); jest.advanceTimersByTime(100); });
    expect(latest.chartHistory.memory).toBe(untouched);
    expect(latest.chartHistory.cpu.samples.map((entry) => entry.id)).toEqual([1, 2]);
    expect(latest.history.cpu.samples.map((entry) => entry.id)).toEqual([1, 2]);
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
    await act(async () => { sockets[0].sendFrame({ type: "samples", app_id: "app", samples: [sample(2, "constructor"), sample(3, "__proto__")] }); jest.advanceTimersByTime(100); });
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
  test("empty widgets distinguish waiting, loading, failure and no data", async () => {
    const props = { widget: { id:"empty", stream:"queue_depth", kind:"value", x:0, y:0, w:3, h:2 }, token:"session", appId:"app", retentionDays:7, cellWidth:60, editing:false, onChange:jest.fn(), onRemove:jest.fn() };
    const stream = {name:"queue_depth", label:"Queue depth", type:"number"};
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain("Waiting for queue_depth.");
    await render(<SupportWidget {...props} stream={stream} />);
    expect(container.textContent).toContain("Loading queue_depth");
    await render(<SupportWidget {...props} stream={stream} historyError="Offline" />);
    expect(container.textContent).toContain("Unable to load queue_depth.");
    await render(<SupportWidget {...props} stream={stream} page={{samples:[], next_before:null}} />);
    expect(container.textContent).toContain("No queue_depth data.");
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
  test("charts map to actual plot dimensions with readable axes and a fixed-radius value marker", async () => {
    const samples = [fresh(1, -12.3456789), fresh(2, 45.5)];
    const geometry = chartGeometry(samples, "line", 900, 80);
    expect(geometry.points).toEqual([{ x: 10, y: 70 }, { x: 890, y: 10 }]);
    await render(<WidgetChart samples={samples} kind="line" stream="cpu" unit="%" />);
    const chart = container.querySelector('[data-testid="chart-cpu-line"]');
    const viewProps = require("react-native").View.mock.calls.findLast(([props]) => props.testID === "chart-cpu-line")[0];
    await act(async () => viewProps.onLayout({ nativeEvent: { layout: { width: 900, height: 80 } } }));
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(chart.querySelector("svg").getAttribute("viewBox")).toBe("0 0 900 80");
    const marker = chart.querySelector('[data-testid="chart-marker"]');
    expect([marker.getAttribute("cx"), marker.getAttribute("cy"), marker.getAttribute("r")]).toEqual(["10", "70", "4"]);
    expect(chart.querySelector('[data-testid="chart-value-tooltip"]').textContent).toContain("-12.3456789 %");
    expect(container.querySelector('[data-testid="chart-y-axis"]').textContent).toContain("45.5 %");
    expect(container.querySelector('[data-testid="chart-x-axis"]')).not.toBeNull();
  });
  test("expanded sparklines expose full axes, summary statistics and sample details", async () => {
    await render(<WidgetChart detailed samples={[fresh(1, -5), fresh(2, 10)]} kind="sparkline" stream="cpu" unit="%" />);
    expect(container.textContent).toContain("Minimum-5 %"); expect(container.textContent).toContain("Maximum10 %");
    expect(container.textContent).toContain("Value (%)"); expect(container.textContent).toContain("Receipt time");
    expect(container.querySelector('[data-testid="chart-sample-details"]').textContent).toContain("worker-a");
    expect(container.querySelector('[data-testid="chart-y-axis"]')).not.toBeNull();
    const chart = container.querySelector('[data-testid="chart-cpu-sparkline"]');
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(container.querySelector('[data-testid="chart-sample-details"]').textContent).toContain("Selected sampleValue-5 %");
  });
  test("charts scale byte labels while inspection retains original units and precision", async () => {
    await render(<WidgetChart samples={[fresh(1, 1073741824), fresh(2, 2147483648)]} kind="line" stream="disk" unit="bytes" />);
    expect(container.textContent).toContain("2 GiB");
    expect(container.textContent).toContain("min 1 GiB · max 2 GiB");
    const chart = container.querySelector('[data-testid="chart-disk-line"]');
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Home" })));
    expect(container.textContent).toContain("1073741824 bytes");
  });
  test("metric values scale bytes and uptime without changing copied data", async () => {
    const props = { widget: { id: "readable", stream: "memory", kind: "value", x: 0, y: 0, w: 3, h: 1 }, stream: { name: "memory", label: "Available memory", type: "number", unit: "bytes" }, page: { samples: [fresh(1, 34359738368)], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain("32 GiB");
    await click("Widget controls"); await click("Copy latest value");
    expect(require("expo-clipboard").setStringAsync).toHaveBeenLastCalledWith("34359738368");
    await click("Close");
    await render(<SupportWidget {...props} stream={{ ...props.stream, unit: "s" }} page={{ samples: [fresh(2, 1250340)], next_before: null }} />);
    expect(container.textContent).toContain("14d 11h");
  });
  test("compact defaults and resize limits let text, values and status fit a single row", async () => {
    for (const kind of ["text", "value", "boolean"]) {
      expect(minimumWidgetHeight(kind)).toBe(2);
      expect(movedWidget({ kind, x: 0, y: 0, w: 3, h: 4 }, 0, -900, 60, true).h).toBe(2);
    }
    expect(defaultWidgetSize("text")).toEqual({ w: 3, h: 2 });
    expect(defaultWidgetSize("logs").h).toBeGreaterThan(defaultWidgetSize("text").h);
    const props = { widget: { id: "tiny", stream: "version", kind: "text", x: 0, y: 0, w: 3, h: 1 }, stream: { name: "version", label: "Version", type: "text", unit: "" }, page: { samples: [fresh(1, "2.4.1")], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: true, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain("2.4.1"); expect(container.textContent).not.toContain("Received");
    expect(container.querySelector('[data-testid="support-widget-tiny"]').style.height).toBe("52px");
    await click("Widget controls"); expect(container.textContent).toContain("Shorter");
    await click("Copy latest value"); expect(require("expo-clipboard").setStringAsync).toHaveBeenCalledWith("2.4.1");
  });
  test("log lines stay chronological and update live without pause controls", async () => {
    const first = fresh(1, { severity: "info", message: "first-line" });
    const second = fresh(2, { severity: "error", message: "second-line" });
    await render(<WidgetFeed samples={[first]} kind="logs" retentionMs={86400000} />);
    await render(<WidgetFeed samples={[first, second]} kind="logs" retentionMs={86400000} />);
    expect(container.textContent).toContain("first-line");
    expect([...container.querySelectorAll("button")].some((button) => /^(Pause|Resume)$/.test(button.textContent))).toBe(false);
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
  test.each(["logs", "events"])("%s feeds have no pause controls and exclude expired entries", async (kind) => {
    const value = kind === "logs" ? { severity: "info", message: "expired-line" } : { name: "expired-line", fields: {} };
    const expired = { ...fresh(1, value), received_at: new Date(Date.now() - 20000).toISOString() };
    await render(<WidgetFeed samples={[expired]} kind={kind} retentionMs={10000} />);
    expect(container.textContent).not.toContain("expired-line");
    expect([...container.querySelectorAll("button")].some((button) => /^(Pause|Resume)$/.test(button.textContent))).toBe(false);
  });
  test("event feeds expand structured fields without turning each event into a large card", async () => {
    await render(<WidgetFeed samples={[fresh(1, { name: "release", fields: { version: "2.4.1", nested: { passed: true } } })]} kind="events" retentionMs={86400000} />);
    expect(container.textContent).toContain("release"); expect(container.textContent).not.toContain("Nested");
    await click("Expand event 1"); expect(container.textContent).toContain("Nested"); expect(container.textContent).toContain("Passedtrue");
    await click("Collapse event 1"); expect(container.textContent).not.toContain("Nested");
  });
  test.each([
    [{ name: "Network link changed", fields: { interface: "eth0", previous: "up", state: "down" } }, "eth0: up → down"],
    [{ name: "Network link changed", fields: { interface: "veth0", previous: null, state: "up" } }, "veth0: not present → up"],
    [{ name: "Network link changed", fields: { interface: "veth0", previous: "up", state: null } }, "veth0: up → not present"],
    [{ name: "Mounts changed", fields: { added: [["/dev/sdb1", "/data", "ext4"]], removed: [["/dev/sdc1", "/backup", "xfs"]] } }, "Mounted /data (/dev/sdb1, ext4) · Unmounted /backup (/dev/sdc1, xfs)"],
    [{ name: "Mounts changed", fields: {} }, "Filesystem mounts changed"],
    [{ name: "Network link changed", fields: {} }, "Unknown interface: not reported → not reported"],
    [{ name: "Machine rebooted", fields: { boot_id: "boot-123" } }, "New boot detected · boot-123. Reboot cause was not reported."],
    [{ name: "custom", fields: { result: false, count: 0, nested: {} } }, "result: false · count: 0"],
    ["plain event", "plain event"],
  ])("event summaries explain reported changes without guessing missing data", (value, expected) => {
    expect(eventSummary(value)).toBe(expected);
  });
  test("machine event details label mount tuples, include provenance, and copy the original event", async () => {
    const event = { ...fresh(7, { name: "Mounts changed", fields: { added: [["/dev/sdb1", "/data", "ext4"]], removed: [] } }), stream: "machine_events", instance_id: "host-a" };
    await render(<WidgetFeed samples={[event]} kind="events" retentionMs={86400000} />);
    expect(container.textContent).toContain("Mounted /data (/dev/sdb1, ext4)");
    await click("Expand event 7");
    expect(container.textContent).toContain("Device/dev/sdb1");
    expect(container.textContent).toContain("Mount point/data");
    expect(container.textContent).toContain("Source time");
    expect(container.textContent).toContain("Senderhost-a");
    expect(container.textContent).toContain("Streammachine_events");
    await click("Copy event JSON");
    expect(require("expo-clipboard").setStringAsync).toHaveBeenLastCalledWith(JSON.stringify(event, null, 2));
    require("expo-clipboard").setStringAsync.mockRejectedValueOnce(new Error("blocked"));
    await click("Event JSON copied");
    expect(container.textContent).toContain("Unable to copy");
  });
  test("event explorer retains the selected event during incoming updates and closes details when filtered out", async () => {
    const event = fresh(8, { name: "Network link changed", fields: { interface: "eth0", previous: "up", state: "down" } });
    await render(<WidgetFeed samples={[event]} kind="events" detailed retentionMs={86400000} />);
    await click("Inspect event 8");
    expect(container.querySelector('[data-testid="event-entry-details"]')).not.toBeNull();
    await render(<WidgetFeed samples={[event, fresh(9, { name: "Machine rebooted", fields: {} })]} kind="events" detailed retentionMs={86400000} />);
    expect(container.querySelector('[data-testid="event-entry-details"]').textContent).toContain("Interfaceeth0");
    await search("Search loaded events", "Machine rebooted");
    expect(container.querySelector('[data-testid="event-entry-details"]')).toBeNull();
  });
  test("machine event widgets open the existing side panel with event inspection", async () => {
    const props = { widget: { id: "machine-events", stream: "machine_events", kind: "events", x: 0, y: 0, w: 6, h: 4 }, stream: { name: "machine_events", label: "Machine Events", type: "event" }, page: { samples: [fresh(1, { name: "Machine rebooted", fields: { boot_id: "abc" } })], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn(), onExpand: jest.fn(), onClosePanel: jest.fn() };
    await render(<SupportWidget {...props} />);
    await click("Open in side panel"); expect(props.onExpand).toHaveBeenCalledWith(props.widget);
    await render(<SupportWidget {...props} expanded />);
    const panel = document.querySelector('[data-testid="support-side-panel"]');
    expect(panel.textContent).toContain("Event explorer");
    await act(async () => panel.querySelector('[aria-label="Inspect event 1"]').click());
    expect(panel.querySelector('[data-testid="event-entry-details"]').textContent).toContain("Boot idabc");
  });
  test("machine information and snapshot fields display readable data while preserving text fallback", async () => {
    const props = { widget: { id: "info", stream: "machine_info", kind: "text", x: 0, y: 0, w: 3, h: 2 }, stream: { name: "machine_info", label: "Machine information", type: "text" }, page: { samples: [fresh(1, JSON.stringify({ hostname: "host", ram_bytes: 1073741824 }))], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain("Hostnamehost"); expect(container.textContent).toContain("1 GiB");
    await render(<SupportWidget {...props} page={{ samples: [fresh(2, "plain text")], next_before: null }} />);
    expect(container.textContent).toContain("plain text");
    await render(<WidgetFeed samples={[fresh(3, { name: "1 filesystem", fields: { items: [{ mount_point: "/", capacity_bytes: 1073741824 }] } })]} kind="events" retentionMs={86400000} />);
    await click("Expand event 3"); expect(container.textContent).toContain("Mount point/"); expect(container.textContent).toContain("1 GiB");
  });
  test.each(["filesystems", "network_interfaces", "top_processes", "hardware", "services"])("%s shows only the latest snapshot and updates live", async (name) => {
    const props = { widget: { id: name, stream: name, kind: "events", x: 0, y: 0, w: 6, h: 4 }, stream: { name, label: name, type: "event" }, page: { samples: [fresh(1, { name: "old snapshot", fields: { items: [{ name: "old item" }] } }), fresh(2, { name: "current snapshot", fields: { items: [{ name: "current item" }] } })], next_before: 1 }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain("current item"); expect(container.textContent).not.toContain("old item"); expect(container.textContent).not.toContain("Older page");
    await render(<SupportWidget {...props} page={{ samples: [...props.page.samples, fresh(3, { name: "new snapshot", fields: { items: [{ name: "new item" }] } })], next_before: 1 }} />);
    expect(container.textContent).toContain("new item"); expect(container.textContent).not.toContain("current item");
  });
  test("snapshot tables sort, filter and follow the selected row across live updates and removal", async () => {
    const first = { pid: 12, name: "worker", cpu_percent: 25, resident_memory_bytes: 1073741824 };
    const second = { pid: 13, name: "server", cpu_percent: 50, resident_memory_bytes: 2048 };
    const view = (items, instance) => <WidgetSnapshot stream="top_processes" sample={fresh(1, { name: "processes", fields: { items } }, instance)} />;
    await render(view([first, second]));
    expect(container.textContent).toContain("PIDNameCPU % ↓Memory");
    const tableText = () => container.querySelector('[data-testid="snapshot-table"]').textContent;
    expect(tableText().indexOf("server")).toBeLessThan(tableText().indexOf("worker"));
    await click("Sort by CPU %");
    expect(tableText().indexOf("worker")).toBeLessThan(tableText().indexOf("server"));
    await search("Search top_processes", "worker");
    expect(container.textContent).not.toContain("server");
    await click("Details for worker (PID 12)");
    await render(view([second, { ...first, cpu_percent: 88, extra_field: "live detail" }]));
    expect(container.textContent).toContain("88 %"); expect(container.textContent).toContain("Extra fieldlive detail");
    await render(view([second]));
    expect(container.textContent).toContain("no longer present");
    await render(view([first], "different-sender"));
    expect(container.textContent).toContain("no longer present");
    await click("Close");
    expect(container.textContent).not.toContain("no longer present");
  });
  test("custom event tables infer columns and rows from the latest items array", async () => {
    const props = { widget: { id: "custom", stream: "jobs", kind: "table", x: 0, y: 0, w: 6, h: 4 }, stream: { name: "jobs", label: "Jobs", type: "event" }, page: { samples: [fresh(1, { name: "jobs", fields: { items: [{ name: "backup", duration: 12 }, { name: "sync", result: "complete" }] } })], next_before: 1 }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
    await render(<SupportWidget {...props} />);
    expect(container.textContent).toContain("NameDurationResult");
    expect(container.textContent).toContain("backup"); expect(container.textContent).toContain("sync");
    expect(container.textContent).not.toContain("Older page");
    await click("Details for sync"); expect(container.textContent).toContain("Resultcomplete");
  });
  test("snapshot column widths validate stored data", () => {
    expect(parseColumnWidths("invalid JSON")).toEqual({});
    expect(parseColumnWidths("[]")).toEqual({});
    expect(parseColumnWidths('{"name":240,"pid":0,"other":2000,"bad":"100","nil":null}')).toEqual({ name: 240, pid: 48, other: 1600 });
  });
  test("snapshot columns resize by drag and keyboard and restore per-widget local widths", async () => {
    jest.useFakeTimers();
    const key = "hyperhive.support.columns:resize-test";
    localStorage.setItem(key, '{"name":210}');
    const props = { stream: "top_processes", storageKey: "resize-test", sample: fresh(1, { name: "processes", fields: { items: [{ pid: 12, name: "worker", cpu_percent: 20, resident_memory_bytes: 1024 }] } }) };
    const nameWidth = () => container.querySelector('[aria-label="Sort by Name"]').parentElement.style.width;
    try {
      await render(<WidgetSnapshot {...props} />);
      expect(nameWidth()).toBe("210px");
      const drag = PanResponder.create.mock.calls.slice(-4)[1][0];
      await act(async () => { drag.onPanResponderGrant(); drag.onPanResponderMove(null, { dx: 80 }); });
      expect(nameWidth()).toBe("290px");
      expect(container.querySelector('[data-testid="snapshot-table"]').querySelector('button').children[1].style.width).toBe("290px");
      await act(async () => drag.onPanResponderRelease(null, { dx: 80 }));
      await act(async () => container.querySelector('[aria-label="Resize Name column"]').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
      expect(nameWidth()).toBe("306px");
      await act(async () => jest.advanceTimersByTime(200));
      expect(JSON.parse(localStorage.getItem(key)).name).toBe(306);
      await render(<WidgetSnapshot key="remount" {...props} />);
      expect(nameWidth()).toBe("306px");
      await render(<WidgetSnapshot key="other" {...props} storageKey="resize-other-widget" />);
      expect(nameWidth()).toBe("115px");
      await render(<WidgetSnapshot key="restored" {...props} />);
      await act(async () => container.querySelector('[aria-label="Resize Name column"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
      expect(nameWidth()).toBe("48px");
      expect(container.textContent).toContain("CPU % ↓");
    } finally { jest.useRealTimers(); localStorage.removeItem(key); localStorage.removeItem("hyperhive.support.columns:resize-other-widget"); }
  });
  test("snapshot resizing remains usable when browser storage is blocked", async () => {
    const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    jest.useFakeTimers();
    try {
      await render(<WidgetSnapshot stream="services" storageKey="blocked" sample={fresh(1, { name: "services", fields: { items: [{ unit: "worker.service" }] } })} />);
      await act(async () => container.querySelector('[aria-label="Resize Unit column"]').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
      expect(container.querySelector('[aria-label="Sort by Unit"]').parentElement.style.width).toBe("216px");
      await act(async () => jest.advanceTimersByTime(200));
      expect(write).toHaveBeenCalled();
    } finally { read.mockRestore(); write.mockRestore(); jest.useRealTimers(); }
  });
  test("filesystem usage handles missing and zero capacities, and hardware rows include sensors and disks", async () => {
    const fs = { mount_point: "/", device: "/dev/sda1", capacity_bytes: 1073741824, free_bytes: 268435456, available_bytes: 134217728 };
    expect(snapshotRows("filesystems", { items: [fs] })[0].usage_percent).toBe(75);
    expect(snapshotRows("filesystems", { items: [{ ...fs, capacity_bytes: 0 }] })[0].usage_percent).toBeUndefined();
    expect(snapshotRows("filesystems", { items: [null, "bad", {}] })).toEqual([{}]);
    await render(<WidgetSnapshot stream="filesystems" sample={fresh(1, { name: "mounts", fields: { items: [fs] } })} />);
    expect(container.textContent).toContain("75 %"); expect(container.textContent).toContain("1 GiB");
    await click("Details for /"); expect(container.textContent).toContain("Free bytes256 MiB");
    const hw = { sensors: [{ sensor: "cpu-temp", value: 42000, unit: "millidegrees_celsius" }], disk_health: [{ device: "/dev/sda", passed: false, available: true }], smartctl: "available" };
    expect(snapshotRows("hardware", hw)).toHaveLength(2);
    await render(<WidgetSnapshot stream="hardware" sample={fresh(2, { name: "hardware", fields: hw })} />);
    expect(container.textContent).toContain("42 °C"); expect(container.textContent).toContain("SMART passed"); expect(container.textContent).toContain("No");
    await render(<WidgetSnapshot stream="hardware" sample={fresh(3, { name: "hardware", fields: { sensors: [], disk_health: [], smartctl: "unavailable" } })} />);
    expect(container.textContent).toContain("No items in the latest snapshot"); expect(container.textContent).toContain("unavailable");
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

describe("Page timeframe and dense chart data", () => {
  const { timeframeBounds, inTimeframe, SupportTimeframeControl } = require("../components/support/support-timeframe");
  const { chartSamples } = require("../components/support/widget-chart");
  test("custom date pickers apply a valid local range and cancel discards edits", async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onChange = jest.fn();
    const click = async (label) => act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === label).click());
    const input = async (label, value) => act(async () => {
      const field = container.querySelector(`[aria-label="${label}"]`);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const value = { since: new Date("2026-10-26T09:30").toISOString(), until: new Date("2026-10-27T10:45").toISOString() };
    try {
      await act(async () => root.render(<SupportTimeframeControl value={value} onChange={onChange} />));
      expect(container.querySelector("input")).toBeNull();
      await click("Custom timeframe");
      expect(container.querySelectorAll('input[type="datetime-local"]')).toHaveLength(2);
      expect(container.querySelector('[aria-label="Start time"]').value).toBe("2026-10-26T09:30");
      expect(container.querySelector('[aria-label="End time"]').value).toBe("2026-10-27T10:45");
      await input("Start time", "2026-10-28T09:30");
      await click("Apply timeframe");
      expect(container.textContent).toContain("end after start");
      expect(onChange).not.toHaveBeenCalled();
      await input("Start time", "");
      await click("Apply timeframe");
      expect(onChange).not.toHaveBeenCalled();
      await input("Start time", "2026-10-25T08:00");
      await click("Cancel");
      expect(container.querySelector("input")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      await click("Custom timeframe");
      expect(container.querySelector('[aria-label="Start time"]').value).toBe("2026-10-26T09:30");
      await input("Start time", "2026-10-25T08:00");
      await click("Apply timeframe");
      expect(onChange).toHaveBeenCalledWith({ since: new Date("2026-10-25T08:00").toISOString(), until: value.until });
      expect(container.querySelector("input")).toBeNull();
    } finally { await act(async () => root.unmount()); }
  });
  test("presets roll and custom receipt bounds include endpoints", () => {
    const now = Date.parse("2026-10-27T12:00:00Z");
    expect(timeframeBounds({ minutes: 30 }, now).since).toBe("2026-10-27T11:30:00.000Z");
    const range = { since: "2026-10-20T12:00:00Z", until: "2026-10-27T12:00:00Z" };
    expect(inTimeframe(range.since, range, now)).toBe(true);
    expect(inTimeframe(range.until, range, now)).toBe(true);
    expect(inTimeframe("2026-10-27T12:00:01Z", range, now)).toBe(false);
    expect(inTimeframe("2026-10-20T11:59:59Z", range, now)).toBe(false);
    expect(inTimeframe("invalid", range, now)).toBe(false);
  });
  test("dense charts retain extrema and endpoints in chronological order", () => {
    const samples = Array.from({ length: 1000 }, (_, id) => ({ id, value: id === 438 ? 9999 : id === 439 ? -999 : 5, received_at: new Date(1700000000000 + id * 1000).toISOString() }));
    const reduced = chartSamples(samples);
    expect(reduced.length).toBeLessThanOrEqual(122);
    expect(reduced[0]).toBe(samples[0]); expect(reduced.at(-1)).toBe(samples.at(-1));
    expect(reduced).toContain(samples[438]); expect(reduced).toContain(samples[439]);
    expect(reduced.map((sample) => sample.id)).toEqual(reduced.map((sample) => sample.id).sort((a, b) => a - b));
  });
});

test("history sends custom bounds, severity and chart bucket size to the API", async () => {
  await getSupportHistory("session", "app", "cpu", undefined, undefined, { since: "2026-10-20T12:00:00Z", until: "2026-10-27T12:00:00Z", buckets: 60 });
  const query = new URL(fetchMock.mock.calls[0][0]).searchParams;
  expect(query.get("since")).toBe("2026-10-20T12:00:00Z");
  expect(query.get("until")).toBe("2026-10-27T12:00:00Z");
  expect(query.get("buckets")).toBe("60"); expect(query.get("limit")).toBe("1000");
});
test("timeframe reconciliation keeps raw samples separate from chart summaries and excludes later live data", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const timeframe = { since: "2026-10-26T11:00:00Z", until: "2026-10-26T13:00:00Z" };
  const root = createRoot(document.createElement("div")); let latest;
  const originalFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation(async (url, options) => url.endsWith("/apps/app") ? response({ app, streams: [stream], layout: { revision: 0, widgets: [{ id: "chart", stream: "cpu", kind: "line" }] } }) : url.includes("buckets=") ? response({ samples: [sample(1), sample(3)], next_before: null }) : url.includes("/samples?") ? response({ samples: [sample(1), sample(2), sample(3)], next_before: null }) : originalFetch(url, options));
  function Harness() { latest = useSupport("session", "app", timeframe); return null; }
  try {
    await act(async () => root.render(<Harness />));
    expect(latest.history.cpu.samples.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(latest.chartHistory.cpu.samples.map((s) => s.id)).toEqual([1, 3]);
    await act(async () => sockets[0].sendFrame({ type: "samples", app_id: "app", samples: [{ ...sample(4), received_at: "2026-10-26T14:00:00Z" }] }));
    expect(latest.history.cpu.samples.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(latest.chartHistory.cpu.samples.map((s) => s.id)).toEqual([1, 3]);
  } finally { await act(async () => root.unmount()); }
});


test("snapshot widgets avoid formatting large hidden details and skip unchanged renders", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"); const root = createRoot(container);
  const format = jest.fn(() => ({ name: "services", fields: { items: [] } }));
  const value = { name: "services", fields: { items: Array.from({ length: 300 }, (_, id) => ({ unit: `service-${id}`, active_state: "active" })) }, toJSON: format };
  const props = { widget: { id: "large", stream: "services", kind: "events", x: 0, y: 0, w: 6, h: 6 }, stream: { name: "services", type: "event" }, page: { samples: [{ ...sample(1, "services"), received_at: new Date().toISOString(), value }], next_before: null }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
  const fields = value.fields;
  const readFields = jest.fn(() => fields);
  Object.defineProperty(value, "fields", { get: readFields });
  const render = () => <SupportWidget {...props} />;
  try {
    await act(async () => root.render(render()));
    expect(container.textContent).toContain("300/300 rows");
    expect(format).not.toHaveBeenCalled();
    const reads = readFields.mock.calls.length;
    await act(async () => root.render(render()));
    expect(readFields).toHaveBeenCalledTimes(reads);
    await act(async () => container.querySelector('[aria-label="Widget controls"]').click());
    expect(format).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); }
});


describe("Support side panel", () => {
  let root; let container;
  const click = async (scope, label) => { await act(async () => [...scope.querySelectorAll("button")].find((button) => button.textContent === label || button.getAttribute("aria-label") === label).click()); };
  const entry = (id, message) => ({ ...sample(id), stream: "logs", instance_id: "worker-a", timestamp: "2026-10-27T10:00:00Z", received_at: new Date().toISOString(), value: { severity: "error", message } });
  const props = { widget: { id: "logs-side", stream: "logs", kind: "logs", x: 0, y: 0, w: 4, h: 5 }, stream: { name: "logs", type: "log", label: "Application logs" }, token: "session", appId: "app", retentionDays: 7, cellWidth: 60, editing: false, onChange: jest.fn(), onRemove: jest.fn() };
  function Explorer({ samples, kind = "logs" }) {
    const [expanded, setExpanded] = React.useState(false);
    return <SupportWidget {...props} widget={{ ...props.widget, kind }} page={{ samples, next_before: null }} expanded={expanded} onExpand={() => setExpanded(true)} onClosePanel={() => setExpanded(false)} />;
  }
  beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); props.onChange.mockClear(); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  test("opens full-height logs, inspects and copies receipt details, follows updates and closes without saving layout", async () => {
    const first = entry(1, "Full multiline message\nwith receipt context");
    await act(async () => root.render(<Explorer samples={[first]} />));
    const trigger = container.querySelector('[aria-label="Open in side panel"]'); trigger.focus();
    await click(container, "Open in side panel");
    const panel = document.querySelector('[data-testid="support-side-panel"]');
    expect(panel.parentElement).toBe(document.body); expect(panel.style.top).toBe("0px"); expect(panel.style.bottom).toBe("0px");
    expect(document.activeElement.getAttribute("aria-label")).toBe("Close side panel");
    expect(container.querySelector('[data-testid="feed-logs"]')).not.toBeNull();
    await click(panel, "Inspect log 1");
    const details = panel.querySelector('[data-testid="log-entry-details"]');
    for (const text of [first.value.message, "error", "worker-a", first.timestamp, first.received_at, "logs"]) expect(details.textContent).toContain(text);
    await click(panel, "Copy message"); expect(require("expo-clipboard").setStringAsync).toHaveBeenLastCalledWith(first.value.message);
    await click(panel, "Copy JSON"); expect(JSON.parse(require("expo-clipboard").setStringAsync.mock.calls.at(-1)[0])).toEqual(first);
    await act(async () => root.render(<Explorer samples={[first, entry(2, "new incoming line")]} />));
    expect(panel.textContent).toContain("new incoming line");
    expect([...panel.querySelectorAll("button")].some((button) => /^(Pause|Resume)$/.test(button.textContent))).toBe(false);
    await click(panel, "Close side panel");
    expect(document.querySelector('[data-testid="support-side-panel"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(container.querySelector('[data-testid="feed-logs"]')).not.toBeNull(); expect(props.onChange).not.toHaveBeenCalled();
  });
  test("selected entry disappears when removed from the retained feed and reports clipboard failure", async () => {
    const first = entry(1, "expired receipt");
    await act(async () => root.render(<WidgetFeed detailed samples={[first]} kind="logs" retentionMs={86400000} />));
    await click(container, "Inspect log 1");
    require("expo-clipboard").setStringAsync.mockRejectedValueOnce(new Error("blocked"));
    await click(container, "Copy JSON"); expect(container.textContent).toContain("Unable to copy");
    await act(async () => root.render(<WidgetFeed detailed samples={[]} kind="logs" retentionMs={86400000} />));
    expect(container.querySelector('[data-testid="log-entry-details"]')).toBeNull();
  });
  test("charts share the side panel and retain keyboard value inspection", async () => {
    await act(async () => root.render(<Explorer samples={[{ ...entry(1, ""), value: 12.345 }]} kind="line" />));
    await click(container, "Open in side panel");
    const panel = document.querySelector('[data-testid="support-side-panel"]');
    const chart = panel.querySelector('[data-testid="chart-logs-line"]');
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(panel.textContent).toContain("12.345"); expect(panel.textContent).toContain("worker-a · sample 1");
    await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(document.querySelector('[data-testid="support-side-panel"]')).not.toBeNull();
    await act(async () => panel.querySelector("header button").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector('[data-testid="support-side-panel"]')).toBeNull();
  });
  test("resizes with keyboard and pointer, stops cancelled drags and clamps to the viewport", async () => {
    await act(async () => root.render(<SupportSidePanel title="Logs" subtitle="Explorer" onClose={() => {}}>Content</SupportSidePanel>));
    const panel = document.querySelector('[data-testid="support-side-panel"]');
    const handle = panel.querySelector('[role="separator"]');
    const key = async (key) => { await act(async () => handle.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))); };
    await key("Home"); expect(panel.style.width).toBe("360px");
    await key("ArrowLeft"); expect(panel.style.width).toBe("392px");
    await key("ArrowRight"); expect(panel.style.width).toBe("360px");
    handle.setPointerCapture = jest.fn();
    await act(async () => { handle.dispatchEvent(new MouseEvent("pointerdown", { clientX: 600, bubbles: true })); handle.dispatchEvent(new MouseEvent("pointermove", { clientX: 400, bubbles: true })); });
    expect(panel.style.width).toBe("560px");
    await act(async () => { handle.dispatchEvent(new Event("pointercancel", { bubbles: true })); handle.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, bubbles: true })); });
    expect(panel.style.width).toBe("560px");
    await key("End"); expect(panel.style.width).toBe(`${window.innerWidth}px`);
    const previous = window.innerWidth;
    try { Object.defineProperty(window, "innerWidth", { value: 320, configurable: true }); await act(async () => window.dispatchEvent(new Event("resize"))); expect(panel.style.width).toBe("320px"); }
    finally { Object.defineProperty(window, "innerWidth", { value: previous, configurable: true }); }
  });
});

test("restored widgets grow to their minimum without overlap", () => {
  const { normalizeWidgetLayout } = require("../components/support/widget-layout");
  const widgets = [{id:"a", kind:"text", x:11, y:0, w:1, h:1}, {id:"b", kind:"logs", x:9, y:0, w:2, h:1}];
  const result = normalizeWidgetLayout(widgets);
  expect(result[0]).toMatchObject({x:9, y:0, w:3, h:2});
  expect(result[1]).toMatchObject({x:8, y:2, w:4, h:4});
  expect(widgets[0]).toMatchObject({x:11, w:1, h:1});
});

test("dragging aligns to nearby widget edges and keeps free grid placement", () => {
  const widget = { id:"a", x:3.7, y:2.2, w:3, h:2 };
  const other = { id:"b", x:4, y:4, w:4, h:2 };
  expect(alignWidget(widget, [other])).toMatchObject({x:4, y:2});
  expect(alignWidget({...widget, x:8.49, y:7.49}, [other])).toMatchObject({x:8, y:7});
});
