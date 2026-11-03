/** @jest-environment jsdom */
import React, {act} from "react";
import {createRoot} from "react-dom/client";
const mockElement = ({children}) => <div>{children}</div>;
for (const [name, exports] of Object.entries({"box": ["Box"], "heading": ["Heading"], "text": ["Text"], "vstack": ["VStack"], "hstack": ["HStack"], "button": ["Button", "ButtonIcon", "ButtonSpinner", "ButtonText"], "select": ["Select", "SelectBackdrop", "SelectContent", "SelectDragIndicator", "SelectDragIndicatorWrapper", "SelectIcon", "SelectInput", "SelectItem", "SelectPortal", "SelectTrigger"], "input": ["Input", "InputField"], "divider": ["Divider"], "badge": ["Badge", "BadgeText"], "toast": ["Toast", "ToastDescription", "ToastTitle", "useToast"], "skeleton": ["Skeleton", "SkeletonText"], "icon": ["ChevronDownIcon"], "modal": ["Modal", "ModalBackdrop", "ModalBody", "ModalCloseButton", "ModalContent", "ModalFooter", "ModalHeader"], "pressable": ["Pressable"], "alert-dialog": ["AlertDialog", "AlertDialogBackdrop", "AlertDialogBody", "AlertDialogCloseButton", "AlertDialogContent", "AlertDialogFooter", "AlertDialogHeader"], "form-control": ["FormControl", "FormControlHelper", "FormControlHelperText", "FormControlLabel", "FormControlLabelText"], "switch": ["Switch"], "progress": ["Progress", "ProgressFilledTrack"]})) {
  if (["button","pressable","modal","alert-dialog","toast"].includes(name)) continue;
  jest.doMock(`../components/ui/${name}`, () => Object.fromEntries(exports.map(key => [key,mockElement])));
}
jest.mock("react-native", () => ({ScrollView:mockElement,RefreshControl:() => null,Switch:mockElement}));
jest.mock("../components/ui/button", () => ({Button:({children,onPress,isDisabled,accessibilityLabel}) => <button aria-label={accessibilityLabel} onClick={onPress} disabled={isDisabled}>{children}</button>,ButtonText:mockElement,ButtonIcon:() => null,ButtonSpinner:() => null}));
jest.mock("../components/ui/pressable", () => ({Pressable:({children,onPress}) => <button onClick={onPress}>{children}</button>}));
jest.mock("../components/ui/modal", () => ({Modal:({isOpen,children}) => isOpen ? <div role="dialog">{children}</div> : null,...Object.fromEntries(["Backdrop","Content","Header","Body","Footer","CloseButton"].map(key => [`Modal${key}`,mockElement]))}));
jest.mock("../components/ui/alert-dialog", () => ({AlertDialog:() => null,...Object.fromEntries(["Backdrop","Content","Header","Body","Footer","CloseButton"].map(key => [`AlertDialog${key}`,mockElement]))}));
const mockToast = {show:jest.fn()};
jest.mock("../components/ui/toast", () => ({Toast:mockElement,ToastDescription:mockElement,ToastTitle:mockElement,useToast:() => mockToast}));
jest.mock("lucide-react-native", () => new Proxy({}, {get:() => () => null}));
jest.mock("../services/hyperhive", () => ({listMachines:jest.fn(async () => [{MachineName:"worker-1"}])}));
jest.mock("../services/btrfs", () => Object.fromEntries(["createAutomaticMount", "deleteAutomaticMount", "listAllDisks", "listAutomaticMounts", "listRaids"].map(name => [name,jest.fn(async () => [])])));
jest.mock("../services/smartdisk", () => Object.fromEntries(["cancelSelfTest", "createSchedule", "deleteSchedule", "enableSchedule", "getRealloc", "getReallocStatus", "getSelfTestProgress", "listSchedules", "listSmartDisks", "reallocCancel", "reallocFullWipe", "reallocNonDestructive", "startSelfTest", "updateSchedule"].map(name => [name,jest.fn(async () => [])])));
const mockPush=jest.fn();
jest.mock("expo-router", () => ({useRouter:() => ({push:mockPush,replace:jest.fn()})}));
jest.mock("../services/diskhealth", () => ({listDiskHealth:jest.fn(async () => ({lastPollAt:null,disks:[]}))}));
const health=require("../services/diskhealth");
const btrfs=require("../services/btrfs");
const smart=require("../services/smartdisk");
const Smart=require("../app/smartdisk").default;
let root,container;
beforeEach(() => {
 jest.clearAllMocks();global.IS_REACT_ACT_ENVIRONMENT=true;
 container=document.createElement("div");root=createRoot(container);
 btrfs.listAllDisks.mockResolvedValue([{device:"/dev/sda",model:"Test disk"}]);
 smart.listSmartDisks.mockResolvedValue([{device:"/dev/sda",model:"Test disk"}]);
 smart.listSchedules.mockResolvedValue([{id:9,device:"/dev/sda",type:"short",week_day:1,hour:3,active:true}]);
});
afterEach(async () => {await act(async () => root.unmount());});
const button=label => [...container.querySelectorAll("button")].find(el => el.textContent===label);
it("shows unknown disk health and preserves self-test, schedule and refresh entry points",async () => {
 await act(async () => root.render(<Smart/>));
 expect(container.textContent).toContain("Unknown");expect(button("Disable")).toBeDefined();expect(button("Delete")).toBeDefined();
 await act(async () => button("Refresh").click());expect(smart.listSmartDisks).toHaveBeenCalledWith("worker-1","/dev/sda");
 await act(async () => button("Self-test").click());expect(container.querySelector('[role="dialog"]')).not.toBeNull();expect(smart.startSelfTest).not.toHaveBeenCalled();
 await act(async () => button("Create schedule").click());expect(smart.createSchedule).not.toHaveBeenCalled();
});

it("shows caution causes and recovers from missing SMART data", async () => {
 btrfs.listAllDisks.mockResolvedValue([{device:"/dev/sda"},{device:"/dev/sdb"}]);
 smart.listSmartDisks.mockImplementation(async (_, device) => device === "/dev/sda" ? [{device, healthStatus:"caution", raw:{crcErrorCount:"11"}}] : Promise.reject(new Error("unavailable")));
 await act(async () => root.render(<Smart/>));
 expect(container.textContent).toContain("Caution indicators: CRC errors: 11");
 expect(container.textContent).toContain("Next test time: unknown");
 expect(container.textContent).toContain("/dev/sdb");
 smart.listSmartDisks.mockImplementation(async (_, device) => [{device, healthStatus:"caution", raw:{}}]);
 await act(async () => button("Refresh").click());
 expect(container.textContent).toContain("the server did not provide an identifiable indicator");
});

it("shows inactive schedules without claiming a next run", async () => {
 smart.listSchedules.mockResolvedValue([{id:9,device:"/dev/sda",type:"short",week_day:1,hour:3,active:false}]);
 await act(async () => root.render(<Smart/>));
 expect(container.textContent).toContain("Next test: none while inactive.");
});

it("shows the health badge, reason and retired disks and opens the disk page", async () => {
 smart.listSmartDisks.mockResolvedValue([{device:"/dev/sda",model:"Test disk",serial:"S1"}]);
 health.listDiskHealth.mockResolvedValue({lastPollAt:new Date(Date.now()-3*3600_000).toISOString(),disks:[
  {serial:"S1",model:"Test disk",machineName:"worker-1",device:"/dev/sda",smartAvailable:true,score:60,band:"watch",reasons:["3 pending sectors (+2 in 7 days)"],retiredAt:null,rotational:true},
  {serial:"OLD",model:"Old disk",machineName:"worker-1",device:"/dev/sdz",smartAvailable:true,score:90,band:"good",reasons:["No problems found"],retiredAt:"2026-10-01T00:00:00Z",lastSeen:"2026-07-01T00:00:00Z",rotational:true},
 ]});
 await act(async () => root.render(<Smart/>));
 expect(container.textContent).toContain("Watch · 60");
 expect(container.textContent).toContain("Health: 3 pending sectors (+2 in 7 days)");
 expect(container.textContent).toContain("Last health poll 3 h ago");
 expect(container.textContent).toContain("Retired disks");
 expect(container.textContent).not.toContain("Old disk · OLD");
 await act(async () => button("Retired disks1 not seen for 90 days").click());
 expect(container.textContent).toContain("Old disk · OLD");
 await act(async () => button("Watch · 60").click());
 expect(mockPush).toHaveBeenCalledWith("/smartdisk/S1");
});

it("shows No SMART data when disk health is unavailable", async () => {
 health.listDiskHealth.mockRejectedValue(new Error("503"));
 await act(async () => root.render(<Smart/>));
 expect(container.textContent).toContain("No SMART data");
 expect(container.textContent).toContain("No health poll yet");
});
