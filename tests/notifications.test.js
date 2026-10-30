import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { normalizeNotificationToast } from "../utils/notificationToast";
import { validateQuietHours } from "../services/notification-rules";
import { setAuthToken } from "../services/api-client";
import { setApiBaseUrl } from "../config/apiConfig";

const mockStatus = { projectId: "example-project", enabled: true, restartRequired: false, permissionGranted: true };
const mockNative = { getStatus: jest.fn(() => ({ ...mockStatus })), getToken: jest.fn(async () => "device-one") };
jest.mock("../services/firebase-notifications.android", () => ({ firebaseNotifications: mockNative }));
const mockElement = ({ children }) => <div>{children}</div>;
jest.mock("../components/ui/box", () => ({ Box: ({ children }) => <div>{children}</div> }));
jest.mock("../components/ui/text", () => ({ Text: ({ children }) => <span>{children}</span> }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, onPress, isDisabled, accessibilityLabel }) => <button aria-label={accessibilityLabel} disabled={isDisabled} onClick={onPress}>{children}</button>, ButtonText: ({ children }) => children }));
jest.mock("../components/ui/input", () => ({ Input: ({ children }) => <div>{children}</div>, InputField: ({ value, onChangeText, accessibilityLabel }) => <input aria-label={accessibilityLabel} value={value} onChange={(e) => onChangeText(e.target.value)} /> }));
jest.mock("../components/ui/switch", () => ({ Switch: ({ value, onValueChange, accessibilityLabel }) => <input type="checkbox" aria-label={accessibilityLabel} checked={value} onChange={(e) => onValueChange(e.target.checked)} /> }));

const json = (body) => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body });

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  setAuthToken("session-one");
  setApiBaseUrl("https://hyperhive.test/api");
});

describe("websocket toasts", () => {
  it("parses NotificationToast messages and ignores others", () => {
    expect(normalizeNotificationToast({ type: "NotificationToast", data: JSON.stringify({ title: "node1 CPU 88°C", body: "hot", severity: "error" }) })).toEqual({ title: "node1 CPU 88°C", body: "hot", severity: "error" });
    expect(normalizeNotificationToast({ Type: "NotificationToast", Data: "plain text" })).toEqual({ title: "Notification", body: "plain text", severity: "info" });
    expect(normalizeNotificationToast({ type: "Notification", data: "modal" })).toBeNull();
    expect(normalizeNotificationToast({ type: "NotificationToast", data: JSON.stringify({ severity: "critical" }) }).severity).toBe("info");
  });
});

describe("quiet hours", () => {
  it("matches backend validation", () => {
    expect(validateQuietHours("", "")).toBeNull();
    expect(validateQuietHours("22:00", "07:00")).toBeNull();
    expect(validateQuietHours("22:00", "")).toMatch(/both/);
    expect(validateQuietHours("24:00", "07:00")).toMatch(/HH:MM/);
  });
});

describe("Android device registration", () => {
  const { registerFirebaseDevice, unregisterFirebaseDevice } = require("../services/firebase-device-registration.android");
  beforeEach(() => { global.fetch = jest.fn(async () => json({ status: "ok" })); Object.assign(mockStatus, { enabled: true }); });

  it("registers once per backend, session and token", async () => {
    await unregisterFirebaseDevice();
    fetch.mockClear();
    expect(await registerFirebaseDevice()).toBe(true);
    expect(await registerFirebaseDevice()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://hyperhive.test/api/notification/firebase/devices");
    expect(JSON.parse(init.body)).toEqual({ token: "device-one", projectId: "example-project" });
    mockNative.getToken.mockResolvedValueOnce("device-two");
    await registerFirebaseDevice();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("skips disabled Firebase and unregisters the current token", async () => {
    mockStatus.enabled = false;
    expect(await registerFirebaseDevice()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    mockStatus.enabled = true;
    await unregisterFirebaseDevice();
    expect(fetch.mock.calls[0][0]).toBe("https://hyperhive.test/api/notification/firebase/devices/unregister");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ token: "device-one" });
  });
});

describe("notification rules settings", () => {
  it("loads rules and saves one category", async () => {
    const rules = [{ category: "metrics", description: "Host alerts", enabled: true, minPushSeverity: "error", quietStart: "", quietEnd: "" }];
    global.fetch = jest.fn(async (url, init) => init?.method === "PUT" ? json({ ...rules[0], ...JSON.parse(init.body) }) : json(rules));
    const Settings = require("../components/navigation/NotificationRulesSettings").default;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<Settings />));
    expect(container.textContent).toContain("Host alerts");
    const save = () => [...container.querySelectorAll("button")].find((b) => b.textContent === "Save");
    expect(save().disabled).toBe(true);
    await act(async () => container.querySelector('[aria-label="Push metrics from Warning"]').click());
    const start = container.querySelector('[aria-label="metrics quiet hours start"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    await act(async () => { setValue.call(start, "22:00"); start.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(container.textContent).toContain("Set both quiet hours");
    expect(save().disabled).toBe(true);
    const end = container.querySelector('[aria-label="metrics quiet hours end"]');
    await act(async () => { setValue.call(end, "07:00"); end.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => save().click());
    const put = fetch.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(put[0]).toBe("https://hyperhive.test/api/notification/rules/metrics");
    expect(JSON.parse(put[1].body)).toEqual({ enabled: true, minPushSeverity: "warning", quietStart: "22:00", quietEnd: "07:00" });
    expect(container.textContent).toContain("Saved.");
    await act(async () => root.unmount());
  });
});
