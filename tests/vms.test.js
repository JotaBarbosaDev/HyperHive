/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
const mockElement = ({children}) => <div>{children}</div>;
jest.mock("../components/ui/box", () => ({Box: mockElement}));
jest.mock("../components/ui/text", () => ({Text: mockElement}));
jest.mock("../components/ui/vstack", () => ({VStack: mockElement}));
jest.mock("../components/ui/hstack", () => ({HStack: mockElement}));
jest.mock("../components/ui/badge", () => ({Badge: mockElement,BadgeText: mockElement}));
jest.mock("../components/ui/skeleton", () => ({Skeleton: mockElement,SkeletonText: mockElement}));
jest.mock("../components/ui/pressable", () => ({Pressable: ({children, onPress, accessibilityRole, accessibilityLabel, disabled}) => accessibilityRole === "button" ? <button aria-label={accessibilityLabel} onClick={onPress} disabled={disabled}>{children}</button> : <div>{children}</div>}));
jest.mock("../components/ui/modal", () => ({Modal: ({isOpen,children}) => isOpen ? <div role="dialog">{children}</div> : null,ModalBackdrop: mockElement,ModalContent: mockElement,ModalHeader: mockElement,ModalBody: mockElement,ModalFooter: mockElement,ModalCloseButton: mockElement}));
jest.mock("../components/ui/divider", () => ({Divider: mockElement}));
jest.mock("../components/ui/progress", () => ({Progress: mockElement,ProgressFilledTrack: mockElement}));
jest.mock("../components/ui/actionsheet", () => ({Actionsheet: ({isOpen,children}) => isOpen ? <div role="dialog">{children}</div> : null,ActionsheetBackdrop: mockElement,ActionsheetContent: mockElement,ActionsheetDragIndicator: mockElement,ActionsheetDragIndicatorWrapper: mockElement,ActionsheetItem: mockElement,ActionsheetItemText: mockElement,ActionsheetIcon: mockElement}));
jest.mock("../components/ui/alert-dialog", () => ({AlertDialog: ({isOpen,children}) => isOpen ? <div role="dialog">{children}</div> : null,AlertDialogBackdrop: mockElement,AlertDialogContent: mockElement,AlertDialogHeader: mockElement,AlertDialogBody: mockElement,AlertDialogFooter: mockElement,AlertDialogCloseButton: mockElement}));
jest.mock("../components/ui/textarea", () => ({Textarea: mockElement,TextareaInput: mockElement}));
jest.mock("../components/ui/select", () => ({Select: mockElement,SelectTrigger: mockElement,SelectInput: mockElement,SelectItem: mockElement,SelectIcon: mockElement,SelectPortal: mockElement,SelectContent: mockElement,SelectBackdrop: mockElement,SelectDragIndicator: mockElement,SelectDragIndicatorWrapper: mockElement}));
jest.mock("../components/ui/form-control", () => ({FormControl: mockElement,FormControlHelper: mockElement,FormControlHelperText: mockElement,FormControlLabel: mockElement,FormControlLabelText: mockElement}));
jest.mock("../components/ui/switch", () => ({Switch: mockElement}));
jest.mock("react-native", () => ({ScrollView: mockElement,RefreshControl: () => null,useColorScheme: () => "dark",Platform: {OS:"web"}}));
jest.mock("../components/ui/button", () => ({Button: ({children,onPress,disabled}) => <button onClick={onPress} disabled={disabled}>{children}</button>,ButtonText:mockElement,ButtonIcon:()=>null,ButtonSpinner:()=>null}));
jest.mock("../components/ui/input", () => ({Input:mockElement,InputField:({value,onChangeText}) => <input value={value} onChange={e => onChangeText(e.target.value)}/>}));
jest.mock("../components/ui/toast", () => ({useToast: () => mockToast,Toast:mockElement,ToastTitle:mockElement,ToastDescription:mockElement}));
jest.mock("../components/ui/heading", () => ({Heading:mockElement}));
const mockToast = {show:jest.fn()};
jest.mock("lucide-react-native", () => new Proxy({}, {get: () => () => null}));
jest.mock("../hooks/useAppTheme", () => ({useAppTheme: () => ({resolvedMode:"dark"})}));
jest.mock("expo-clipboard", () => ({setStringAsync:jest.fn(async()=>true)}));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-web-browser", () => ({}));
jest.mock("expo-haptics", () => ({selectionAsync:jest.fn()}));
jest.mock("../components/modals/CreateVmModal", () => () => null);
jest.mock("../components/modals/ImportVmModal", () => () => null);
jest.mock("../components/modals/CpuPinningModal", () => () => null);
jest.mock("../services/websocket-client", () => ({ensureHyperHiveWebsocket:jest.fn(async()=>{}),subscribeToHyperHiveWebsocket:jest.fn(()=>jest.fn())}));
jest.mock("../services/hyperhive", () => ({listMounts:jest.fn(async()=>[]),getCpuInfo:jest.fn(async()=>({cores:[]})),getMemInfo:jest.fn(async()=>({}))}));
jest.mock("../services/xml-templates-client", () => ({listXmlTemplates:jest.fn(async()=>[])}));
jest.mock("../services/backups", () => ({}));
jest.mock("../services/api-client", () => ({ApiError:class extends Error {}}));
jest.mock("../config/apiConfig", () => ({getApiBaseUrl:()=>"https://example.test"}));
jest.mock("../services/vms-client", () => ({
  VmState:{UNKNOWN:0,RUNNING:1,BLOCKED:2,PAUSED:3,SHUTDOWN:4,SHUTOFF:5,CRASHED:6,PMSUSPENDED:7,NOSTATE:8},
  getAllVMs:jest.fn(),listSlaves:jest.fn(async()=>[])
}));
const api = require("../services/vms-client");
const Screen = require("../app/vms").default;
const fixture = (name,machineName,state) => ({name,machineName,state,DefinedCPUS:2,DefinedRam:2048,ip:[],network:"default"});
let root,container;
beforeEach(() => {global.IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers();api.getAllVMs.mockReset().mockResolvedValue([fixture("alpha","slave-a",1),fixture("beta","slave-b",5)]);container=document.createElement("div");root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());jest.useRealTimers();});
const render = async()=>act(async()=>root.render(<Screen/>));
const click = async label => act(async()=>[...container.querySelectorAll("button")].find(el=>el.textContent===label).click());
it("registers and cleans up VM listeners during effect replay while connection is pending", async () => {
 const ws = require("../services/websocket-client");
 ws.subscribeToHyperHiveWebsocket.mockClear();
 ws.ensureHyperHiveWebsocket.mockImplementationOnce(() => new Promise(() => {}));
 await act(async()=>root.render(<React.StrictMode><Screen/></React.StrictMode>));
 expect(ws.subscribeToHyperHiveWebsocket).toHaveBeenCalledTimes(2);
 const [first, second] = ws.subscribeToHyperHiveWebsocket.mock.results.map(result=>result.value);
 expect(first).toHaveBeenCalledTimes(1);
 expect(second).not.toHaveBeenCalled();
 await act(async()=>root.render(null));
 expect(second).toHaveBeenCalledTimes(1);
});
it("filters cards and slave groups and restores them with clear filters",async()=>{
 await render();expect(container.textContent).toContain("slave-a");expect(container.textContent).toContain("slave-b");
 await click("Running");expect(container.textContent).toContain("alpha");expect(container.textContent).not.toContain("slave-b");
 await act(async()=>{const input=container.querySelector("input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"missing");input.dispatchEvent(new Event("input",{bubbles:true}));});
 expect(container.textContent).toContain("No VMs match your filters");await click("Clear filters");expect(container.textContent).toContain("beta");
});
it("shows a load failure without claiming the fleet is empty and supports retry",async()=>{
 api.getAllVMs.mockRejectedValueOnce(new Error("Unavailable"));await render();expect(container.textContent).toContain("Unable to load VMs");expect(container.textContent).not.toContain("No VMs found");await click("Retry");expect(container.textContent).toContain("alpha");expect(container.textContent).not.toContain("Unable to load VMs");
});
it("keeps cards visible and marks inventory stale when polling fails",async()=>{
 await render();api.getAllVMs.mockRejectedValueOnce(new Error("Offline"));await act(async()=>jest.advanceTimersByTime(10000));expect(container.textContent).toContain("Inventory may be stale");expect(container.textContent).toContain("alpha");
});

it("searches host names and IPs without changing fleet totals", async () => {
 api.getAllVMs.mockResolvedValueOnce([{...fixture("alpha","slave-a",1),ip:["192.0.2.7"]},fixture("beta","slave-b",5)]);
 await render();
 const search = async value => act(async()=>{
  const input=container.querySelector("input");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,value);
  input.dispatchEvent(new Event("input",{bubbles:true}));
 });
 await search(" SLAVE-B ");
 expect(container.textContent).toContain("beta");expect(container.textContent).not.toContain("alpha");
 await search("192.0.2.7");
 expect(container.textContent).toContain("alpha");expect(container.textContent).not.toContain("beta");
 expect(container.textContent).toContain("2 VMs");
});

it("keeps full host VM totals when only one VM matches", async () => {
 api.getAllVMs.mockResolvedValueOnce([fixture("alpha","slave-a",1),fixture("beta","slave-a",5)]);
 const hostApi = require("../services/hyperhive");
 hostApi.getCpuInfo.mockResolvedValueOnce({cores:Array(16).fill({})});
 hostApi.getMemInfo.mockResolvedValueOnce({totalMb:16384});
 await render();
 await click("Running");
 expect(container.textContent).toContain("Showing 1 of 2 VMs across 1 host");
 expect(container.textContent).toContain("2 VMs · 1 running · 1 shown");
 expect(container.textContent).toContain("vCPU allocated: 4 / 16 · 12 remaining");
 expect(container.textContent).toContain("RAM allocated: 4.0 GB / 16.0 GB · 12.0 GB remaining");
 expect(container.textContent).not.toContain("beta");
 await click("Clear filters");
 expect(container.textContent).toContain("Showing 2 of 2 VMs across 1 host");
 expect(container.textContent).toContain("beta");
});

it("makes exceptional states discoverable through Other", async () => {
 api.getAllVMs.mockResolvedValueOnce([
  fixture("alpha","slave-a",1), fixture("crashed-vm","slave-a",6),
  fixture("blocked-vm","slave-b",2), fixture("unrecognized-vm","slave-b",99),
 ]);
 await render();
 expect(container.textContent).toContain("3 other");
 await click("Other");
 expect(container.textContent).toContain("Showing 3 of 4 VMs across 2 hosts");
 expect(container.textContent).toContain("crashed-vm");
 expect(container.textContent).toContain("blocked-vm");
 expect(container.textContent).toContain("unrecognized-vm");
 expect(container.textContent).toContain("Unknown");
 expect(container.textContent).not.toContain("alpha");
});

it("displays reported addresses and distinguishes missing addresses", async () => {
 api.getAllVMs.mockResolvedValueOnce([
  {...fixture("alpha","slave-a",1),ip:["192.0.2.7","2001:db8::7"]},
  fixture("beta","slave-b",5),
 ]);
 await render();
 expect(container.textContent).toContain("192.0.2.7");
 expect(container.textContent).toContain("+1 more in details");
 expect(container.textContent).toContain("Not reported");
});

it("shows overallocated resources instead of claiming free capacity", async () => {
 api.getAllVMs.mockResolvedValueOnce([{...fixture("large-vm","slave-a",1),DefinedCPUS:20,DefinedRam:32768}]);
 const hostApi = require("../services/hyperhive");
 hostApi.getCpuInfo.mockResolvedValueOnce({cores:Array(16).fill({})});
 hostApi.getMemInfo.mockResolvedValueOnce({totalMb:16384});
 await render();
 expect(container.textContent).toContain("vCPU allocated: 20 / 16 · 4 overallocated");
 expect(container.textContent).toContain("RAM allocated: 32.0 GB / 16.0 GB · 16.0 GB overallocated");
});

it("keeps VM action labels and confirmations available across running, stopped and paused states", async () => {
 api.getAllVMs.mockResolvedValueOnce([fixture("alpha","slave-a",1),fixture("beta","slave-a",5),fixture("gamma","slave-a",3)]);
 await render();
 for (const [label, visible] of [["Pause alpha","Pause"],["Restart alpha","Restart"],["Shutdown alpha","Shutdown"],["View details for alpha","Details"],["View details for beta","Details"],["View details for gamma","Details"]]) {
  const button = container.querySelector(`[aria-label="${label}"]`);
  expect(button.textContent).toContain(visible);
 }
 expect(container.textContent).toContain("Start");
 expect(container.textContent).toContain("Resume");
 for (const [label, prompt] of [["Pause alpha","Pause alpha?"],["Restart alpha","Restart alpha?"],["Shutdown alpha","Shutdown alpha?"]]) {
  await act(async()=>container.querySelector(`[aria-label="${label}"]`).click());
  expect(container.querySelector('[role="dialog"]').textContent).toContain(prompt);
  await click("Cancel");
  expect(container.querySelector('[role="dialog"]')).toBeNull();
 }
 await act(async()=>container.querySelector('[aria-label="View details for beta"]').click());
 expect(container.querySelector('[role="dialog"]').textContent).toContain("beta · Details");
});

it("shows and copies the complete disk path and all reported addresses", async () => {
 const path = "/mnt/storage/long-folder-name/virtual-machines/alpha/system-disk.qcow2";
 api.getAllVMs.mockResolvedValueOnce([{...fixture("alpha","slave-a",1), diskPath:path, ip:["192.0.2.7", "2001:db8::7"]}]);
 await render();
 await act(async()=>container.querySelector('[aria-label="View details for alpha"]').click());
 const dialog = container.querySelector('[role="dialog"]');
 expect(dialog.textContent).toContain(path);
 expect(dialog.textContent).toContain("192.0.2.7");
 expect(dialog.textContent).toContain("2001:db8::7");
 expect(dialog.textContent).toContain("Open console");
 await click("Copy disk path");
 expect(require("expo-clipboard").setStringAsync).toHaveBeenCalledWith(path);
});
