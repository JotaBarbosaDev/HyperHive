import React, { act } from "react";
import { createRoot } from "react-dom/client";
const mockBox = ({ children }) => <div>{children}</div>;
const mockMachines = [{ MachineName: "node-a" }];
jest.mock("react-native", () => ({ ScrollView: mockBox, RefreshControl: () => null, useColorScheme: () => "dark" }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../hooks/useAuthGuard", () => ({ useAuthGuard: () => ({ token: "fixture", isChecking: false }) }));
jest.mock("../hooks/useMachines", () => ({ useMachines: () => ({ machines: mockMachines, isLoading: false }) }));
jest.mock("../hooks/useSelectedMachine", () => ({ useSelectedMachine: () => ({ selectedMachine: "node-a", setSelectedMachine: jest.fn() }) }));
jest.mock("../components/ui/box", () => ({ Box: mockBox }));
jest.mock("../components/ui/text", () => ({ Text: ({ children, accessibilityLabel }) => <span aria-label={accessibilityLabel}>{children}</span> }));
jest.mock("../components/ui/heading", () => ({ Heading: mockBox }));
jest.mock("../components/ui/hstack", () => ({ HStack: mockBox }));
jest.mock("../components/ui/vstack", () => ({ VStack: mockBox }));
jest.mock("../components/ui/badge", () => ({ Badge: mockBox, BadgeText: mockBox }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, onPress }) => <button onClick={onPress}>{children}</button>, ButtonText: mockBox, ButtonIcon: () => null, ButtonSpinner: () => null }));
jest.mock("../components/ui/icon", () => ({ Icon: () => null }));
jest.mock("../components/ui/pressable", () => ({ Pressable: ({ children, onPress }) => <button onClick={onPress}>{children}</button> }));
jest.mock("../components/ui/modal", () => ({ Modal: () => null }));
jest.mock("../components/ui/toast", () => ({ useToast: () => ({ show: jest.fn() }), Toast: mockBox, ToastTitle: mockBox }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("../services/hyperhive", () => ({
  getMachineUptime: jest.fn(async () => ({})), getCpuInfo: jest.fn(async () => ({ cores: [] })),
  getMemInfo: jest.fn(async () => ({})), getDiskInfo: jest.fn(),
  getTunedAdmProfiles: jest.fn(async () => ({ profiles: [] })),
}));
const Screen = require("../app/dashboard").default;
const api = require("../services/hyperhive");
const gib = 1024 ** 3;
let root, container;
beforeEach(() => { jest.useFakeTimers(); global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); jest.clearAllMocks(); });
it("preserves filtering and Btrfs deduplication and refreshes volume data automatically", async () => {
  api.getDiskInfo.mockResolvedValueOnce({ disks: [
    { device: "/dev/a", fstype: "btrfs", mountPoint: "/data", total: 10*gib, free: 6*gib },
    { device: "/dev/b", fstype: "btrfs", mountPoint: "/data", total: 10*gib, free: 6*gib },
    { device: "/dev/c", fstype: "ext4", mountPoint: "/", total: 50*gib, free: 5*gib },
  ] }).mockResolvedValue({ disks: [{ device: "/dev/a", fstype: "btrfs", mountPoint: "/data", total: 10*gib, free: 3*gib }] });
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("4.00 GB used of 10.00 GB");
  expect(container.textContent).toContain("4.00 GB used · 6.00 GB free · 10.00 GB total");
  expect(container.querySelector(`[aria-label="${4*gib} bytes used, ${6*gib} bytes free, ${10*gib} bytes total"]`)).not.toBeNull();
  expect(container.textContent).not.toContain("Update");
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(api.getDiskInfo).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("7.00 GB used · 3.00 GB free");
});
it("shows empty storage when a node snapshot fails", async () => {
  api.getDiskInfo.mockRejectedValueOnce(new Error("offline"));
  jest.spyOn(console, "warn").mockImplementation(() => {});
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("No disk data yet.");
  console.warn.mockRestore();
});
