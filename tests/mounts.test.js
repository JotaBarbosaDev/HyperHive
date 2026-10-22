/** @jest-environment jsdom */
import React, {act} from "react";
import {createRoot} from "react-dom/client";
const mockElement = ({children}) => <div>{children}</div>;
for (const [name, exports] of Object.entries({box:["Box"],text:["Text"],heading:["Heading"],vstack:["VStack"],hstack:["HStack"],badge:["Badge","BadgeText"],spinner:["Spinner"],icon:["Icon","ChevronDownIcon"],progress:["Progress","ProgressFilledTrack"],"form-control":["FormControl","FormControlLabel","FormControlLabelText","FormControlError","FormControlErrorText"],select:["Select","SelectBackdrop","SelectContent","SelectDragIndicator","SelectDragIndicatorWrapper","SelectIcon","SelectInput","SelectItem","SelectPortal","SelectTrigger"]})) {
  jest.doMock(`../components/ui/${name}`, () => Object.fromEntries(exports.map(key => [key,mockElement])));
}
jest.mock("react-native", () => ({ScrollView: mockElement, RefreshControl: () => null, useColorScheme: () => "dark"}));
jest.mock("../components/ui/button", () => ({Button: ({children,onPress,isDisabled}) => <button onClick={onPress} disabled={isDisabled}>{children}</button>, ButtonText: mockElement, ButtonIcon: () => null, ButtonSpinner: () => null}));
jest.mock("../components/ui/input", () => ({Input: mockElement,InputField: ({value,onChangeText}) => <input value={value} onChange={e => onChangeText(e.target.value)}/>,InputIcon: () => null,InputSlot: mockElement}));
jest.mock("../components/ui/modal", () => ({Modal: ({isOpen,children}) => isOpen ? <div role="dialog">{children}</div> : null,...Object.fromEntries(["Backdrop","Body","Content","Footer","Header"].map(key=>[`Modal${key}`,mockElement]))}));
jest.mock("lucide-react-native", () => new Proxy({}, {get: () => () => null}));
jest.mock("../hooks/useAuthGuard", () => ({useAuthGuard: () => ({token:"test",isChecking:false})}));
jest.mock("../hooks/useMounts", () => ({useMounts: () => mockInventory}));
jest.mock("../components/mount", () => ({__esModule:true, default: ({NfsShare}) => <div>{NfsShare.Name} {NfsShare.MachineName} {NfsShare.FolderPath}</div>,MountSkeletonGrid: () => <div>Loading rows</div>}));
jest.mock("../components/drawers/CreateMountDrawer", () => ({CreateMountDrawer: ({isOpen,onSuccess}) => isOpen ? <button onClick={onSuccess}>Mock success</button> : null}));
let mockInventory;
const fixture = (Id, Name, working, MachineName) => ({NfsShare:{Id,Name,MachineName,FolderPath:`/exports/${Name}`,Source:"",Target:""},Status:{working}});
const Screen = require("../app/mounts").default;
let root, container;
beforeEach(async () => {
  mockInventory = {mounts:[fixture(1,"zulu",true,"worker-1"),fixture(2,"archive",false,"worker-2")],isLoading:false,isRefreshing:false,error:null,refresh:jest.fn(),removeMount:jest.fn()};
  global.IS_REACT_ACT_ENVIRONMENT = true;container=document.createElement("div");root=createRoot(container);await act(async () => root.render(<Screen/>));
});
afterEach(async () => {await act(async () => root.unmount());});
const button = label => [...container.querySelectorAll("button")].find(el => el.textContent === label);
const click = async el => act(async () => el.click());
it("sorts, filters unhealthy exports and clears filters without mutations", async () => {
 expect(container.textContent.indexOf("archive worker")).toBeLessThan(container.textContent.indexOf("zulu worker"));
 await click(button("Name A–Z"));
 expect(container.textContent.indexOf("zulu worker")).toBeLessThan(container.textContent.indexOf("archive worker"));
 await click(button("Unhealthy"));expect(container.textContent).toContain("1 of 2 exports");expect(container.textContent).not.toContain("zulu worker");
 await click(button("Clear filters"));expect(container.textContent).toContain("2 of 2 exports");
 expect(mockInventory.removeMount).not.toHaveBeenCalled();expect(mockInventory.refresh).not.toHaveBeenCalled();
});
it("searches by host and handles no matches", async () => {
 const search = async value => act(async () => {const input=container.querySelector("input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));});
 await search(" WORKER-1 ");expect(container.textContent).toContain("1 of 2 exports");expect(container.textContent).not.toContain("archive worker");
 await search("missing");expect(container.textContent).toContain("No exports match your filters");
});
it("opens the existing creation drawer and refreshes only after success", async () => {
 await click(button("Create NFS"));expect(mockInventory.refresh).not.toHaveBeenCalled();
 await click(button("Mock success"));expect(mockInventory.refresh).toHaveBeenCalledTimes(1);expect(button("Mock success")).toBeUndefined();
});
it("shows loading, error, and empty states", async () => {
 mockInventory.mounts=[];mockInventory.isLoading=true;await act(async () => root.render(<Screen/>));expect(container.textContent).toContain("Loading rows");
 mockInventory.isLoading=false;mockInventory.error="Offline";await act(async () => root.render(<Screen/>));expect(container.textContent).toContain("Error loading mounts: Offline");
 mockInventory.error=null;await act(async () => root.render(<Screen/>));expect(container.textContent).toContain("No NFS exports configured");
});

jest.mock("../services/hyperhive", () => ({deleteMount: jest.fn(async () => {}),remountNfs:jest.fn(async () => {})}));
jest.mock("../components/ui/toast", () => ({Toast:mockElement,ToastTitle:mockElement,useToast: () => ({show:jest.fn()})}));
jest.mock("../components/ui/divider", () => ({Divider:mockElement}));
jest.mock("../components/modals/MountDeleteModal", () => ({MountDeleteModal: ({isOpen,onConfirm,onClose}) => isOpen ? <div role="dialog"><button onClick={onConfirm}>Confirm unmount</button><button onClick={onClose}>Cancel</button></div> : null}));
jest.mock("../components/modals/MountDetailsModal", () => ({MountDetailsModal: ({isOpen}) => isOpen ? <div>Mount details</div> : null}));
jest.mock("../components/modals/MountConnectModal", () => ({MountConnectModal: ({isOpen}) => isOpen ? <div>Mount connection</div> : null}));
it("keeps connection, details and confirmed unmount wiring with the original payload", async () => {
 const Card = jest.requireActual("../components/mount/MountCard").MountCard;
 const mount = {...fixture(1,"data",true,"worker-1"),Status:{working:true,spaceOccupiedGB:20,spaceTotalGB:100,spaceFreeGB:80}};
 const removed=jest.fn();const service=require("../services/hyperhive").deleteMount;
 await act(async () => root.render(<Card {...mount} onDelete={removed}/>));
 expect(container.textContent).toContain("Gauge 20%");
 await click(button("Connect"));expect(container.textContent).toContain("Mount connection");
 await click(button("Details"));expect(container.textContent).toContain("Mount details");
 await click(button("Unmount"));expect(service).not.toHaveBeenCalled();expect(container.querySelector('[role="dialog"]')).not.toBeNull();
 await click(button("Cancel"));expect(service).not.toHaveBeenCalled();
 await click(button("Unmount"));await click(button("Confirm unmount"));
 expect(service).toHaveBeenCalledWith({MachineName:"worker-1",FolderPath:"/exports/data"},{force:false});
 expect(removed).toHaveBeenCalledWith(mount.NfsShare);
});

jest.mock("../components/mount/MountUsageGauge", () => ({MountUsageGauge: ({usagePercent}) => <div>Gauge {usagePercent}%</div>}));

jest.mock("expo-router", () => ({useRouter: () => ({push:mockPush})}));
const mockPush=jest.fn();
it("renders complete details and preserves remount error handling", async () => {
 const Details=jest.requireActual("../components/modals/MountDetailsModal").MountDetailsModal;
 const mount={...fixture(7,"data",true,"worker-1"),Status:{working:true,spaceOccupiedGB:20,spaceFreeGB:80,spaceTotalGB:100}};
 const close=jest.fn();const remount=require("../services/hyperhive").remountNfs;
 await act(async () => root.render(<Details isOpen mount={mount} onClose={close}/>));
 expect(container.textContent).toContain("NFS export · ID 7");expect(container.textContent).toContain("/exports/data");expect(container.textContent).toContain("Not reported");
 expect(remount).not.toHaveBeenCalled();
 remount.mockRejectedValueOnce(new Error("Host unavailable"));await click(button("Remount"));
 expect(remount).toHaveBeenCalledWith(7);expect(container.textContent).toContain("Host unavailable");
 await click(button("Close"));expect(close).toHaveBeenCalledTimes(1);
});
it("shows full connection commands and preserves WireGuard navigation", async () => {
 const Connect=jest.requireActual("../components/modals/MountConnectModal").MountConnectModal;
 const mount=fixture(1,"data/share",true,"worker-1");mount.NfsShare.Source="storage:/exports/a-very-long-path-that-should-never-be-truncated";
 const close=jest.fn();await act(async () => root.render(<Connect isOpen mount={mount} onClose={close}/>));
 expect(container.textContent).toContain(mount.NfsShare.Source);
 expect(container.textContent).toContain('sudo mkdir -p "/mnt/hyperhive/data-share"');
 expect(container.textContent).toContain('/Volumes/HyperHive/data-share');expect(container.textContent).toContain(`mount -o anon ${mount.NfsShare.Source} Z:`);
 await click(button("Open WireGuard VPN"));expect(close).toHaveBeenCalledTimes(1);expect(mockPush).toHaveBeenCalledWith("/wireguard");
});
