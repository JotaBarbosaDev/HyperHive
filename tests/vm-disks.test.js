/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
const mockElement = ({ children }) => <div>{children}</div>;
for (const [name, exports] of Object.entries({ box:["Box"], heading:["Heading"], text:["Text"], vstack:["VStack"], hstack:["HStack"], input:["Input","InputField"], select:["Select","SelectBackdrop","SelectContent","SelectIcon","SelectInput","SelectItem","SelectPortal","SelectTrigger"], icon:["ChevronDownIcon"] })) {
  jest.doMock(`../components/ui/${name}`, () => Object.fromEntries(exports.map(key => [key, mockElement])));
}
jest.mock("react-native", () => ({ ScrollView:mockElement, RefreshControl:() => null, useColorScheme:() => "light" }));
jest.mock("lucide-react-native", () => new Proxy({}, { get:() => () => null }));
jest.mock("expo-clipboard", () => ({ setStringAsync:jest.fn(async () => true) }));
jest.mock("../hooks/useAuthGuard", () => ({ useAuthGuard:() => ({token:"fixture",isChecking:false}) }));
jest.mock("../components/ui/button", () => ({ Button:({children,onPress,isDisabled,accessibilityLabel}) => <button onClick={onPress} disabled={isDisabled} aria-label={accessibilityLabel}>{children}</button>, ButtonText:mockElement, ButtonIcon:() => null, ButtonSpinner:() => null }));
jest.mock("../components/ui/modal", () => ({ Modal:({isOpen,children}) => isOpen ? <div role="dialog">{children}</div> : null, ...Object.fromEntries(["Backdrop","Content","Header","Body","Footer"].map(key => [`Modal${key}`,mockElement])) }));
jest.mock("../components/ui/alert-dialog", () => ({ AlertDialog:({isOpen,children}) => isOpen ? <div role="alertdialog">{children}</div> : null, ...Object.fromEntries(["Backdrop","Content","Header","Body","Footer"].map(key => [`AlertDialog${key}`,mockElement])) }));
const mockToast = {show:jest.fn()};
jest.mock("../components/ui/toast", () => ({Toast:mockElement,ToastDescription:mockElement,ToastTitle:mockElement,useToast:() => mockToast}));
jest.mock("../services/hyperhive", () => ({ listVmDisks:jest.fn(), listMounts:jest.fn(async () => []), deleteVmDisk:jest.fn(), growVmDisk:jest.fn(), createVmDisk:jest.fn() }));
const api = require("../services/hyperhive");
const clipboard = require("expo-clipboard");
const Screen = require("../app/vms-disks").default;
let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT=true; jest.clearAllMocks(); container=document.createElement("div"); root=createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); });
it("discloses and copies the file path and warns before deleting an attached disk", async () => {
  const path="/mnt/storage/a-long-directory/guest.qcow2";
  api.listVmDisks.mockResolvedValue([{id:1,name:"guest-disk",nfs_id:1,disk_path:path,folder_path:"/mnt/storage",attached_vm_name:"guest",size_gb:100,occupied_gb:10,occupied_bytes:10,format:"qcow2"}]);
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("Attached VM: guest");
  expect(container.textContent).toContain(path);
  await act(async () => container.querySelector('[aria-label="Copy disk path for guest-disk"]').click());
  expect(clipboard.setStringAsync).toHaveBeenCalledWith(path);
  await act(async () => container.querySelector('[aria-label="Delete disk guest-disk"]').click());
  expect(container.querySelector('[role="alertdialog"]').textContent).toContain("detached from guest before deletion");
  expect(api.deleteVmDisk).not.toHaveBeenCalled();
});
it("shows empty and error states without stale disk actions", async () => {
  api.listVmDisks.mockResolvedValueOnce([]);
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("No VM disks found.");
  api.listVmDisks.mockRejectedValueOnce(new Error("fixture failure"));
  await act(async () => container.querySelector('[aria-label="Refresh VM disks"]').click());
  expect(container.textContent).toContain("fixture failure");
  expect(container.querySelector('[aria-label^="Copy disk path"]')).toBeNull();
});
it("reports clipboard failure and does not offer copying a missing path", async () => {
  api.listVmDisks.mockResolvedValueOnce([
    {id:1,name:"disk-a",nfs_id:1,disk_path:"/mnt/a",attached_vm_name:"",size_gb:1},
    {id:2,name:"disk-b",nfs_id:1,disk_path:"",attached_vm_name:"",size_gb:1},
  ]);
  clipboard.setStringAsync.mockResolvedValueOnce(false);
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("Attached VM: None");
  expect(container.textContent).toContain("Not reported");
  expect(container.querySelector('[aria-label="Copy disk path for disk-b"]')).toBeNull();
  await act(async () => container.querySelector('[aria-label="Copy disk path for disk-a"]').click());
  const toast = mockToast.show.mock.calls.at(-1)[0].render({id:"test"});
  expect(toast.props.action).toBe("error");
});
it("does not show empty state while inventory is loading", async () => {
  api.listVmDisks.mockReturnValueOnce(new Promise(() => {}));
  await act(async () => root.render(<Screen />));
  expect(container.textContent).not.toContain("No VM disks found.");
  expect(container.querySelector('[aria-label^="Copy disk path"]')).toBeNull();
});
