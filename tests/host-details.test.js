import React, { act } from "react";
import { createRoot } from "react-dom/client";
const mockBox = (props) => mockStack(props);
let mockCoreLayout;
let mockChartLayout;
const mockStack = ({ children, onLayout, className = "" }) => {
  if (className.includes("justify-center") && onLayout) mockCoreLayout = onLayout;
  if (className === "gap-6" && onLayout) mockChartLayout = onLayout;
  return <div>{children}</div>;
};
jest.mock("react-native", () => ({ Platform: { OS: "web" }, ScrollView: mockBox, RefreshControl: () => null, useColorScheme: () => "dark" }));
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ machine: "fixture-host" }), useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../hooks/useAuthGuard", () => ({ useAuthGuard: () => ({ token: "fixture", isChecking: false }) }));
const mockMachines = [{ MachineName: "fixture-host" }];
jest.mock("../hooks/useMachines", () => ({ useMachines: () => ({ machines: mockMachines, isLoading: false }) }));
jest.mock("../components/ui/box", () => ({ Box: mockBox }));
jest.mock("../components/ui/text", () => ({ Text: ({ children }) => <span>{children}</span> }));
jest.mock("../components/ui/heading", () => ({ Heading: mockBox }));
jest.mock("../components/ui/hstack", () => ({ HStack: mockStack }));
jest.mock("../components/ui/vstack", () => ({ VStack: mockStack }));
jest.mock("../components/ui/badge", () => ({ Badge: mockBox, BadgeText: mockBox }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, onPress }) => <button onClick={onPress}>{children}</button>, ButtonText: mockBox, ButtonIcon: () => null }));
jest.mock("../components/ui/icon", () => ({ Icon: () => null }));
jest.mock("../components/ui/input", () => ({ Input: mockBox, InputField: () => null }));
jest.mock("../components/ui/pressable", () => ({ Pressable: ({ children, onPress, accessibilityLabel, accessibilityState }) => <button aria-label={accessibilityLabel} aria-expanded={accessibilityState?.expanded} onClick={onPress}>{children}</button> }));
jest.mock("../components/ui/modal", () => ({ Modal: () => null, ModalBackdrop: mockBox, ModalBody: mockBox, ModalContent: mockBox, ModalHeader: mockBox }));
jest.mock("../components/ui/select", () => new Proxy({}, { get: () => mockBox }));
jest.mock("../components/ui/spinner", () => ({ Spinner: () => null }));
jest.mock("../components/ui/switch", () => ({ Switch: () => null }));
jest.mock("../components/modals/CoreIsolationModal", () => () => null);
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("victory-native", () => ({ VictoryChart: ({ width }) => <div data-chart-width={width} />, VictoryAxis: () => null, VictoryLine: () => null, VictoryTheme: {}, VictoryTooltip: () => null, createContainer: () => () => null }));
jest.mock("../services/api-client", () => ({ ApiError: class extends Error {} }));
jest.mock("../services/vms-client", () => ({ getNodeIrqbalanceStatus: jest.fn(async () => ({})), getNodeHostHugepagesStatus: jest.fn(async () => ({})) }));
jest.mock("../services/hyperhive", () => ({
  getMachineUptime: jest.fn(async () => ({ uptime: "24h" })),
  getCpuInfo: jest.fn(async () => ({ cores: Array.from({ length: 16 }, () => ({ usage: 25, temp: 40 })) })),
  getMemInfo: jest.fn(async () => ({ usedPercent: 25, usedMb: 8000, totalMb: 32000 })),
  getDiskInfo: jest.fn(async () => ({ disks: [] })), getNetworkInfo: jest.fn(async () => ({ stats: [] })),
  getCpuHistory: jest.fn(async () => [{ captured_at: "2026-10-27T10:00:00Z", info: { cores: [{ usage: 25, temp: 40 }] } }]),
  getMemHistory: jest.fn(async () => []), getDiskHistory: jest.fn(async () => []), getNetworkHistory: jest.fn(async () => []),
}));
const Screen = require("../app/dashboard/[machine]").default;
let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); root = createRoot(container); });
afterEach(async () => act(async () => root.unmount()));
it("fits core disclosure to its measured container, preserves all cores and exposes expanded state", async () => {
  await act(async () => root.render(<Screen />));
  await act(async () => mockCoreLayout({ nativeEvent: { layout: { width: 240 } } }));
  expect(container.textContent).toContain("Core 1");
  expect(container.textContent).not.toContain("Core 2");
  const more = container.querySelector('[aria-label="Show all CPU cores"]');
  expect(more.getAttribute("aria-expanded")).toBe("false");
  await act(async () => more.click());
  expect(container.textContent).toContain("Core 16");
  const less = container.querySelector('[aria-label="Show fewer CPU cores"]');
  expect(less.getAttribute("aria-expanded")).toBe("true");
  await act(async () => less.click());
  expect(container.textContent).not.toContain("Core 2");
});
it("sizes history charts to the available container and ignores zero-width layout events", async () => {
  await act(async () => root.render(<Screen />));
  await act(async () => mockChartLayout({ nativeEvent: { layout: { width: 237 } } }));
  expect(container.querySelector('[data-chart-width]').getAttribute("data-chart-width")).toBe("237");
  await act(async () => mockChartLayout({ nativeEvent: { layout: { width: 0 } } }));
  expect(container.querySelector('[data-chart-width]').getAttribute("data-chart-width")).toBe("237");
});
it("keeps empty telemetry readable without an expansion control", async () => {
  const api = require("../services/hyperhive");
  api.getCpuInfo.mockResolvedValue({ cores: [] });
  api.getCpuHistory.mockResolvedValue([]);
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("No CPU data.");
  expect(container.textContent).toContain("No disks listed.");
  expect(container.textContent).toContain("No visible interfaces.");
  expect(container.querySelector('[aria-label="Show all CPU cores"]')).toBeNull();
});
it("preserves the load error and host controls when telemetry fails", async () => {
  const api = require("../services/hyperhive");
  api.getCpuInfo.mockRejectedValueOnce(new Error("Telemetry unavailable"));
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("Telemetry unavailable");
  expect(container.textContent).toContain("Host Controls");
});
