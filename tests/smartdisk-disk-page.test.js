/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mockElement = ({ children }) => <div>{children}</div>;
for (const [name, keys] of Object.entries({
  box: ["Box"],
  text: ["Text"],
  heading: ["Heading"],
  hstack: ["HStack"],
  vstack: ["VStack"],
  skeleton: ["Skeleton"],
  spinner: ["Spinner"],
})) {
  jest.doMock(`../components/ui/${name}`, () => Object.fromEntries(keys.map((key) => [key, mockElement])));
}
jest.mock("react-native", () => ({
  Platform: { OS: "web" },
  RefreshControl: () => null,
  ScrollView: mockElement,
  useColorScheme: () => "dark",
}));
jest.mock("victory-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("../components/ui/button", () => ({
  Button: ({ children, onPress }) => <button onClick={onPress}>{children}</button>,
  ButtonIcon: () => null,
  ButtonSpinner: () => null,
  ButtonText: mockElement,
}));
jest.mock("../components/ui/pressable", () => ({
  Pressable: ({ children, onPress, "aria-pressed": pressed }) => (
    <button aria-pressed={pressed} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock("../components/ui/alert-dialog", () => ({
  AlertDialog: () => null,
  ...Object.fromEntries(["Backdrop", "Body", "CloseButton", "Content", "Footer", "Header"].map((key) => [`AlertDialog${key}`, mockElement])),
}));
const mockToast = { show: jest.fn() };
jest.mock("../components/ui/toast", () => ({ Toast: mockElement, ToastDescription: mockElement, ToastTitle: mockElement, useToast: () => mockToast }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ serial: "S1" }),
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("../hooks/useAuthGuard", () => ({ useAuthGuard: () => ({ token: "token", isChecking: false }) }));
jest.mock("../services/diskhealth", () => ({ getDiskHealthHistory: jest.fn(), purgeDiskHealth: jest.fn() }));

const { getDiskHealthHistory } = require("../services/diskhealth");
const DiskHealthScreen = require("../app/smartdisk/[serial]").default;

const point = (at, over = {}) => ({ at, resolution: "6h", score: 90, band: "good", temperatureC: 40, percentageUsed: 0, ...over });
const sample = { capturedAt: "2026-11-03T12:00:00Z", temperatureC: 40, powerOnHours: 100, pendingSectors: 0, smartPassed: true, healthStatus: "PASSED" };
const history = (over = {}, points = [point("2026-11-01T00:00:00Z"), point("2026-11-02T00:00:00Z")]) => ({
  disk: {
    serial: "S1",
    model: "Test disk",
    machineName: "worker-1",
    device: "/dev/sda",
    transport: "sata",
    rotational: true,
    capacityBytes: 4e12,
    retiredAt: null,
    smartAvailable: true,
    score: 90,
    band: "good",
    wearOutAt: null,
    reasons: ["No problems found"],
    pastRatedEndurance: false,
    latest: sample,
    ...over,
  },
  points,
});

let root, container;
beforeEach(() => {
  jest.clearAllMocks();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});

const render = () => act(async () => root.render(<DiskHealthScreen />));
const button = (label) => [...container.querySelectorAll("button")].find((el) => el.textContent === label);

it("leads with the score, its band and the counters", async () => {
  getDiskHealthHistory.mockResolvedValue(history({ score: 12, band: "critical", reasons: ["22 pending sectors"], latest: { ...sample, pendingSectors: 22 } }));
  await render();
  expect(getDiskHealthHistory).toHaveBeenCalledWith("S1", 30);
  expect(container.textContent).toContain("Why this score");
  expect(container.textContent).toContain("Critical");
  expect(container.textContent).toContain("22 pending sectors");
  expect(container.textContent).toContain("Pending22");
  expect(container.textContent).not.toContain("All at zero");
});

it("says so when every counter is zero, and keeps them listed without a trend", async () => {
  getDiskHealthHistory.mockResolvedValue(history({}, [point("2026-11-03T12:00:00Z")]));
  await render();
  expect(container.textContent).toContain("History is building");
  expect(container.textContent).toContain("All at zero");
  expect(container.textContent).toContain("Reallocated0");
});

it("does not call older stored history a disk with no samples yet", async () => {
  getDiskHealthHistory.mockResolvedValue(history({ retiredAt: "2026-10-01T00:00:00Z" }, []));
  await render();
  expect(container.textContent).toContain("No samples in the last 30 days");
  expect(container.textContent).not.toContain("History is building");
  expect(button("Show all history")).toBeDefined();
});

it("does not invent a score or range for a disk without SMART", async () => {
  getDiskHealthHistory.mockResolvedValue(history({ smartAvailable: false, score: null, band: "", reasons: [], latest: undefined }, []));
  await render();
  expect(container.textContent).toContain("This disk does not report SMART health");
  expect(container.textContent).not.toContain("/ 100");
  expect(button("30d")).toBeUndefined();
});

it("ignores a slow response for a range the user already left", async () => {
  getDiskHealthHistory.mockResolvedValueOnce(history());
  await render();

  let finishSlow;
  getDiskHealthHistory.mockImplementationOnce(() => new Promise((resolve) => (finishSlow = resolve)));
  await act(async () => button("90d").click());
  getDiskHealthHistory.mockResolvedValueOnce(history({ model: "Seven day response" }));
  await act(async () => button("7d").click());
  await act(async () => finishSlow(history({ model: "Stale 90 day response" })));

  expect(container.textContent).toContain("Seven day response");
  expect(container.textContent).not.toContain("Stale 90 day response");
  expect(container.textContent).toContain("in the last 7 days");
  expect(button("7d").getAttribute("aria-pressed")).toBe("true");
});

it("keeps the shown history and its range label when a reload fails", async () => {
  getDiskHealthHistory.mockResolvedValueOnce(history());
  await render();
  getDiskHealthHistory.mockRejectedValueOnce(new Error("offline"));
  await act(async () => button("7d").click());
  expect(mockToast.show).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Test disk");
  expect(container.textContent).toContain("in the last 30 days");
});
