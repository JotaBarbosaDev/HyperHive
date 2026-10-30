import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useSidebarLayout, parseSidebarLayout, SIDEBAR_STORAGE_KEY } from "../hooks/useSidebarLayout";
import { AppSidebar } from "../components/navigation/AppSidebar";
import { resetSupportNavigation, useSupportNavigation } from "../hooks/useSupportNavigation";
let mockPathname = "/vms";
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }), usePathname: () => mockPathname }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(async () => {}) }));
jest.mock("../components/useColorScheme", () => ({ useColorScheme: () => "dark" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock("../services/auth-storage", () => ({ clearAuthToken: jest.fn() }));
jest.mock("../services/firebase-device-registration", () => ({ unregisterFirebaseDevice: jest.fn(async () => {}) }));
jest.mock("../components/navigation/NotificationRulesSettings", () => ({ __esModule: true, default: () => <div>Notification rules editor</div> }));
jest.mock("../services/api-client", () => ({ setAuthToken: jest.fn(), getAuthToken: () => null, apiFetch: jest.fn() }));
jest.mock("../assets/images/android-chrome-192x192.png", () => 1);
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_, name) => Object.assign(() => null, { displayName: name }) }));
jest.mock("react-native", () => ({
  Platform: { OS: "web" }, useWindowDimensions: () => ({ width: 390 }),
  View: ({ children, className, ...props }) => <div {...props}>{children}</div>,
  ScrollView: ({ children }) => <div>{children}</div>,
}));
jest.mock("../components/ui/box", () => ({ Box: ({ children, style }) => <div style={style}>{children}</div> }));
jest.mock("../components/ui/text", () => ({ Text: ({ children }) => <span>{children}</span> }));
jest.mock("../components/ui/heading", () => ({ Heading: ({ children }) => <span>{children}</span> }));
jest.mock("../components/ui/image", () => ({ Image: () => <img alt="HyperHive" /> }));
jest.mock("../components/ui/icon", () => ({ Icon: ({ as: Glyph, size }) => <span data-icon={Glyph.displayName} data-icon-size={size} /> }));
jest.mock("../components/ui/pressable", () => ({ Pressable: require("react").forwardRef(({ children, onPress, accessibilityLabel, accessibilityState, title }, ref) => <button ref={ref} onClick={onPress} aria-label={accessibilityLabel} aria-expanded={accessibilityState?.expanded} title={title}>{children}</button>) }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, onPress }) => <button onClick={onPress}>{children}</button>, ButtonText: ({ children }) => children }));
jest.mock("../components/ui/modal", () => { const Context = require("react").createContext(); return { Modal: ({ children, isOpen, onClose }) => isOpen ? <Context.Provider value={onClose}>{children}</Context.Provider> : null, ModalBackdrop: () => null, ModalBody: ({ children }) => children, ModalContent: ({ children }) => children, ModalFooter: ({ children }) => children, ModalHeader: ({ children }) => children, ModalCloseButton: () => <button aria-label="Close settings" onClick={require("react").useContext(Context)} /> }; });
jest.mock("../components/ui/radio", () => ({ Radio: ({ children }) => children, RadioGroup: ({ children }) => children, RadioIndicator: ({ children }) => children, RadioLabel: ({ children }) => children }));
let root, container;
beforeEach(() => { resetSupportNavigation(); mockPathname = "/vms"; global.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); jest.clearAllMocks(); container = document.createElement("div"); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
const click = async (name) => act(async () => container.querySelector(`[aria-label="${name}"]`).click());
const props = { isOpen: true, width: 280, compact: false, connected: true, onClose: jest.fn(), onToggle: jest.fn(), onResize: jest.fn(), themePreference: "dark", onChangeThemePreference: jest.fn() };
test("validates persisted data and clamps unreasonable widths", () => {
  expect(parseSidebarLayout('{"open":false,"width":900}')).toEqual({ open: false, width: 400 });
  expect(parseSidebarLayout('{"width":-8}').width).toBe(240);
  for (const raw of [null, "invalid", "null", '{"open":"false","width":"320"}']) expect(parseSidebarLayout(raw)).toEqual({ open: true, width: 280 });
});
test("restores device preferences and saves toggles and resized width", async () => {
  jest.useFakeTimers();
  localStorage.setItem(SIDEBAR_STORAGE_KEY, '{"open":false,"width":320}');
  let state;
  function Harness() { state = useSidebarLayout(); return null; }
  await act(async () => root.render(<Harness />));
  expect(state.open).toBe(false); expect(state.width).toBe(320);
  await act(async () => { state.setOpen(true); state.setWidth(360); });
  await act(async () => jest.advanceTimersByTime(150));
  expect(JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY))).toEqual({ open: true, width: 360 });
  await act(async () => root.unmount()); root = createRoot(container);
  await act(async () => root.render(<Harness />));
  expect(state.open).toBe(true); expect(state.width).toBe(360);
});
test("storage failures leave the sidebar usable", async () => {
  const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("disabled"); });
  let state; function Harness() { state = useSidebarLayout(); return null; }
  await act(async () => root.render(<Harness />));
  await act(async () => state.setOpen(false)); expect(state.open).toBe(false); read.mockRestore();
});
test("collapsed groups expand, active routes are visible and desktop navigation stays open", async () => {
  await act(async () => root.render(<AppSidebar {...props} isOpen={false} />));
  expect(container.textContent).not.toContain("HyperHive");
  expect(container.querySelector('[aria-label="Settings"]')).not.toBeNull();
  await click("Storage"); expect(props.onToggle).toHaveBeenCalled();
  await act(async () => root.render(<AppSidebar {...props} />));
  expect(container.textContent).toContain("BTRFS / RAIDs");
  expect(container.textContent).toContain("Virtual Machines");
  await click("ISOs"); expect(mockReplace).toHaveBeenCalledWith("/isos"); expect(props.onClose).not.toHaveBeenCalled();
});
test("phone navigation closes the overlay; Escape and backdrop dismiss it", async () => {
  props.onClose.mockClear();
  await act(async () => root.render(<AppSidebar {...props} compact />));
  expect(container.querySelector('[role="separator"]')).toBeNull();
  await click("ISOs"); expect(props.onClose).toHaveBeenCalledTimes(1);
  await click("Close navigation");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(props.onClose).toHaveBeenCalledTimes(3);
});
test("resize handle supports pointer dragging and keyboard increments", async () => {
  await act(async () => root.render(<AppSidebar {...props} />));
  const handle = container.querySelector('[role="separator"]');
  await act(async () => handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(props.onResize).toHaveBeenCalledWith(296);
  const pointer = (type, x) => { const event = new Event(type, { bubbles: true }); Object.defineProperty(event, "clientX", { value: x }); return event; };
  await act(async () => { handle.dispatchEvent(pointer("pointerdown", 280)); window.dispatchEvent(pointer("pointermove", 350)); window.dispatchEvent(pointer("pointerup", 350)); });
  expect(props.onResize).toHaveBeenCalledWith(350);
});

test("VM group uses stable chevron glyphs when expanded and collapsed", async () => {
  await act(async () => root.render(<AppSidebar {...props} />));
  const vm = () => container.querySelector('[aria-label="VMs"]');
  expect(vm().querySelector('[data-icon="Monitor"]').getAttribute("data-icon-size")).toBe("20");
  expect(vm().querySelector('[data-icon="ChevronDown"]')).not.toBeNull();
  await click("VMs");
  expect(vm().querySelector('[data-icon="ChevronRight"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Virtual Machines"]')).toBeNull();
  await click("VMs");
  expect(vm().querySelector('[data-icon="ChevronDown"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Virtual Machines"]')).not.toBeNull();
});

const supportApp = { id: "app-a", name: "Worker A", tab_id: "vms", tags: ["production", "api"], connectivity: "online", health: "healthy" };
const seedSupport = () => useSupportNavigation.setState({ tabs: [{ id: "vms", name: "VM telemetry" }, { id: "docker", name: "Docker PC" }, { id: "empty", name: "Empty" }], apps: [supportApp, { ...supportApp, id: "app-b", name: "Worker B", tab_id: "docker", connectivity: "offline", health: "unhealthy" }], connection: "live" });
test("HH Support is top-level and expands workspaces and Apps with status and tags", async () => {
  seedSupport();
  await act(async () => root.render(<AppSidebar {...props} />));
  await click("Logs"); expect(mockReplace).toHaveBeenLastCalledWith("/logs");
  expect(container.querySelector('[aria-label="HH Support"]')).not.toBeNull();
  await click("HH Support"); expect(mockReplace).toHaveBeenLastCalledWith("/support");
  expect(container.textContent).toContain("VM telemetry"); expect(container.textContent).toContain("Docker PC");
  await click("VM telemetry");
  const app = container.querySelector('[aria-label="Worker A: online, healthy. Tags: production, api"]');
  expect(app).not.toBeNull(); expect(app.textContent).toContain("production");
  expect(app.querySelector('[style*="background-color: rgb(45, 212, 191)"]')).not.toBeNull();
  await act(async () => app.click());
  expect(useSupportNavigation.getState()).toMatchObject({ tabId: "vms", selectedId: "app-a" });
  await click("Docker PC"); expect(container.querySelector('[aria-label="Worker B: offline, unhealthy. Tags: production, api"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Worker A: online, healthy. Tags: production, api"]')).not.toBeNull();
  await click("Empty"); expect(container.textContent).toContain("No Apps in this workspace");
});
test("Support App selection closes the phone overlay while expanding parents keeps it open", async () => {
  seedSupport();
  await act(async () => root.render(<AppSidebar {...props} compact />));
  await click("HH Support"); await click("VM telemetry"); expect(props.onClose).not.toHaveBeenCalled();
  await click("Worker A: online, healthy. Tags: production, api"); expect(props.onClose).toHaveBeenCalledTimes(1);
});
test("Support navigation preserves unsaved layouts and has no management plus", async () => {
  seedSupport(); mockPathname = "/support";
  useSupportNavigation.setState({ tabId: "vms", selectedId: "app-a", dirty: true });
  await act(async () => root.render(<AppSidebar {...props} />));
  await click("Docker PC"); await click("ISOs");
  expect(mockReplace).not.toHaveBeenCalled(); expect(useSupportNavigation.getState().selectedId).toBe("app-a");
  await act(async () => useSupportNavigation.setState({ dirty: false, connection: "disconnected" }));
  expect(container.querySelector('[aria-label="Worker A: status unavailable. Tags: production, api"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Manage Support workspaces"]')).toBeNull();
});

test("keeps expanded Support branches open when the active workspace changes", async () => {
  seedSupport(); mockPathname = "/support";
  useSupportNavigation.setState({ tabId: "vms", selectedId: "app-a" });
  await act(async () => root.render(<AppSidebar {...props} />));
  await click("Docker PC");
  expect(container.querySelector('[aria-label="Worker A: online, healthy. Tags: production, api"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Worker B: offline, unhealthy. Tags: production, api"]')).not.toBeNull();
});

test("settings dismissal returns focus and leaves phone navigation open", async () => {
  jest.useFakeTimers();
  document.body.appendChild(container);
  await act(async () => root.render(<AppSidebar {...props} compact />));
  await click("Settings");
  props.onClose.mockClear();
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(props.onClose).not.toHaveBeenCalled();
  const close = container.querySelector('[aria-label="Close settings"]');
  await act(async () => close.click());
  await act(async () => jest.runAllTimers());
  expect(document.activeElement.getAttribute("aria-label")).toBe("Settings");
  container.remove();
});

test("compact closed navigation leaves no persistent rail", async () => {
  await act(async () => root.render(<AppSidebar {...props} compact isOpen={false} />));
  expect(container.querySelector('[aria-label="Settings"]')).toBeNull();
  expect(container.querySelector('[aria-label="Expand sidebar"]')).toBeNull();
});
