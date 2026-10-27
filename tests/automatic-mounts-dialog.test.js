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
const mockRouter = {push:jest.fn()};
jest.mock("expo-router", () => ({useRouter:() => mockRouter}));
jest.mock("../services/hyperhive", () => ({listMachines:jest.fn(async () => [{MachineName:"worker-1"}])}));
jest.mock("../services/btrfs", () => Object.fromEntries(["createAutomaticMount", "deleteAutomaticMount", "listAllDisks", "listAutomaticMounts", "listRaids"].map(name => [name,jest.fn(async () => [])])));
jest.mock("../services/smartdisk", () => Object.fromEntries(["cancelSelfTest", "createSchedule", "deleteSchedule", "enableSchedule", "getRealloc", "getReallocStatus", "getSelfTestProgress", "listSchedules", "listSmartDisks", "reallocCancel", "reallocFullWipe", "reallocNonDestructive", "startSelfTest", "updateSchedule"].map(name => [name,jest.fn(async () => [])])));
jest.mock("../components/modals/DirectoryPickerModal", () => ({DirectoryPickerModal:() => null}));
const btrfs=require("../services/btrfs");
const smart=require("../services/smartdisk");
const Mounts=require("../app/btrfs-automatic-mounts").default;
const Smart=require("../app/smartdisk").default;
let root,container;
beforeEach(() => {
 jest.clearAllMocks();global.IS_REACT_ACT_ENVIRONMENT=true;
 container=document.createElement("div");root=createRoot(container);
 btrfs.listAutomaticMounts.mockResolvedValue([{id:7,uuid:"array-1",mount_point:"/mnt/archive",compression:"zstd:3"}]);
 btrfs.listRaids.mockResolvedValue([{uuid:"array-1",name:"Archive"}]);
 btrfs.listAllDisks.mockResolvedValue([{device:"/dev/sda",model:"Test disk"}]);
 smart.listSmartDisks.mockResolvedValue([{device:"/dev/sda",model:"Test disk"}]);
 smart.listSchedules.mockResolvedValue([{id:9,device:"/dev/sda",type:"short",week_day:1,hour:3,active:true}]);
});
afterEach(async () => {await act(async () => root.unmount());});
const button=label => [...container.querySelectorAll("button")].find(el => el.textContent===label);
it("confirms the selected startup rule and preserves its delete payload", async () => {
 await act(async () => root.render(<Mounts/>));
 expect(container.textContent).not.toContain("UUID: array-1");
 await act(async () => button("Details").click());
 expect(container.querySelector('[role="dialog"]').textContent).toContain("UUID: array-1");
 await act(async () => button("Close").click());
 await act(async () => button("Remove rule").click());
 const dialog = container.querySelector('[role="dialog"]');
 expect(dialog.textContent).toContain("/mnt/archive");
 expect(dialog.textContent).toContain("worker-1");
 expect(dialog.textContent).toContain("does not unmount");
 expect(btrfs.deleteAutomaticMount).not.toHaveBeenCalled();
 await act(async () => button("Cancel").click());
 expect(btrfs.deleteAutomaticMount).not.toHaveBeenCalled();
 await act(async () => button("Remove rule").click());
 await act(async () => [...container.querySelector('[role="dialog"]').querySelectorAll("button")].find(el => el.textContent === "Remove rule").click());
 expect(btrfs.deleteAutomaticMount).toHaveBeenCalledWith(7);
});
it("keeps the confirmation open on failure and supports retry", async () => {
 btrfs.deleteAutomaticMount.mockRejectedValueOnce(new Error("offline"));
 const log = jest.spyOn(console, "error").mockImplementation(() => {});
 await act(async () => root.render(<Mounts/>));
 await act(async () => button("Remove rule").click());
 const confirm = () => [...container.querySelector('[role="dialog"]').querySelectorAll("button")].find(el => el.textContent === "Remove rule");
 await act(async () => confirm().click());
 expect(container.querySelector('[role="dialog"]')).not.toBeNull();
 expect(mockToast.show).toHaveBeenCalled();
 await act(async () => confirm().click());
 expect(btrfs.deleteAutomaticMount).toHaveBeenCalledTimes(2);
 expect(container.querySelector('[role="dialog"]')).toBeNull();
 log.mockRestore();
});
it("shows loading and empty states", async () => {
 let resolveRules;
 btrfs.listAutomaticMounts.mockImplementationOnce(() => new Promise(resolve => { resolveRules = resolve; }));
 await act(async () => root.render(<Mounts/>));
 expect(container.textContent).toContain("Loading rules");
 await act(async () => resolveRules([]));
 expect(container.textContent).toContain("No automatic mounts configured");
});
it("reports a failed rule load and allows refresh", async () => {
 btrfs.listAutomaticMounts.mockRejectedValueOnce(new Error("offline"));
 const log = jest.spyOn(console, "error").mockImplementation(() => {});
 await act(async () => root.render(<Mounts/>));
 expect(mockToast.show).toHaveBeenCalled();
 await act(async () => button("Refresh").click());
 expect(container.textContent).toContain("/mnt/archive");
 log.mockRestore();
});
