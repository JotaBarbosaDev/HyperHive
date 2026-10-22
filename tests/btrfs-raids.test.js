/** @jest-environment jsdom */
import React, {act} from "react";
import {createRoot} from "react-dom/client";
const mockElement = ({children}) => <div>{children}</div>;
for (const [name, exports] of Object.entries({"box": ["Box"], "text": ["Text"], "heading": ["Heading"], "vstack": ["VStack"], "hstack": ["HStack"], "button": ["Button", "ButtonIcon", "ButtonSpinner", "ButtonText"], "input": ["Input", "InputField"], "select": ["Select", "SelectTrigger", "SelectInput", "SelectItem", "SelectIcon", "SelectPortal", "SelectContent", "SelectDragIndicatorWrapper", "SelectDragIndicator", "SelectBackdrop"], "icon": ["ChevronDownIcon", "Icon"], "pressable": ["Pressable"], "divider": ["Divider"], "modal": ["Modal", "ModalBackdrop", "ModalContent", "ModalHeader", "ModalBody", "ModalFooter", "ModalCloseButton"], "alert-dialog": ["AlertDialog", "AlertDialogBackdrop", "AlertDialogContent", "AlertDialogHeader", "AlertDialogBody", "AlertDialogFooter", "AlertDialogCloseButton"], "form-control": ["FormControl", "FormControlLabel", "FormControlLabelText", "FormControlHelper", "FormControlHelperText"], "toast": ["Toast", "ToastDescription", "ToastTitle", "useToast"], "badge": ["Badge", "BadgeText"], "skeleton": ["Skeleton", "SkeletonText"], "progress": ["Progress", "ProgressFilledTrack"]})) {
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
const mockRouter = {push:jest.fn()};
jest.mock("expo-router", () => ({useRouter:() => mockRouter}));
jest.mock("../services/hyperhive", () => ({listMachines:jest.fn(async () => [{MachineName:"worker-1"}])}));
jest.mock("../services/btrfs", () => Object.fromEntries(["addDiskRaid", "balanceRaid", "cancelBalance", "changeRaidLevel", "createAutomaticMount", "createRaid", "defragmentRaid", "deleteAutomaticMount", "getRaidStatus", "getScrubStats", "listAllDisks", "listAutomaticMounts", "listFreeDisks", "listRaids", "mountRaid", "pauseBalance", "removeDiskRaid", "removeRaid", "replaceDiskRaid", "resumeBalance", "scrubRaid", "unmountRaid"].map(name => [name,jest.fn(async () => [])])));
const api = require("../services/btrfs");
const Screen = require("../app/btrfs-raids").default;
let root, container;
beforeEach(async () => {
  jest.clearAllMocks();
  api.listRaids.mockResolvedValue([{uuid:"array-1",name:"Archive",mounted:true,mount_point:"/mnt/archive",devices:[]},{uuid:"array-2",name:"Backup",mounted:false,devices:[]},{uuid:"array-3",name:"Unknown",devices:[]}]);
  api.listFreeDisks.mockResolvedValue([{device:"/dev/sdb",size:1024}]);
  global.IS_REACT_ACT_ENVIRONMENT=true;
  container=document.createElement("div");root=createRoot(container);
  await act(async () => root.render(<Screen/>));
});
afterEach(async () => {await act(async () => root.unmount());});
const button = label => [...container.querySelectorAll("button")].find(el => el.textContent === label);
it("prioritizes arrays and labels mounted, unmounted and unknown states", () => {
  expect(container.textContent.indexOf("RAID arrays")).toBeLessThan(container.textContent.lastIndexOf("Free disks"));
  expect(container.textContent).toContain("Mounted");expect(container.textContent).toContain("Unmounted");expect(container.textContent).toContain("Mount state unknown");
});
it("preserves filtering and opens the existing RAID controls without mutations", async () => {
  await act(async () => button("Inactive (1)").click());
  expect(container.textContent).not.toContain("Archive");expect(container.textContent).toContain("Backup");
  await act(async () => button("Manage RAID").click());
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(api.getRaidStatus).toHaveBeenCalledWith("worker-1","array-2");
  expect(api.mountRaid).not.toHaveBeenCalled();expect(api.removeRaid).not.toHaveBeenCalled();
});
it("preserves creation and refresh entry points", async () => {
  await act(async () => button("Refresh").click());
  expect(api.listRaids).toHaveBeenCalledTimes(2);
  await act(async () => button("Create RAID").click());
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();expect(api.createRaid).not.toHaveBeenCalled();
});
