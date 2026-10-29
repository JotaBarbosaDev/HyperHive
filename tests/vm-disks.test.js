/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
const mockElement = ({ children }) => <div>{children}</div>;
for (const [name, exports] of Object.entries({ box:["Box"], heading:["Heading"], text:["Text"], vstack:["VStack"], hstack:["HStack"], input:["Input","InputField"], icon:["ChevronDownIcon"] })) {
  jest.doMock(`../components/ui/${name}`, () => Object.fromEntries(exports.map(key => [key, mockElement])));
}
jest.mock("../components/ui/select", () => {
  const React = require("react");
  const Context = React.createContext(() => {});
  const Element = ({children}) => <div>{children}</div>;
  return {Select:({children,onValueChange}) => <Context.Provider value={onValueChange}>{children}</Context.Provider>, SelectItem:({label,value,isDisabled}) => { const select = React.useContext(Context); return <button disabled={isDisabled} onClick={() => select(value)}>{label}</button>; }, ...Object.fromEntries(["SelectBackdrop","SelectContent","SelectIcon","SelectInput","SelectPortal","SelectTrigger"].map(key => [key, Element]))};
});
jest.mock("expo-document-picker", () => ({getDocumentAsync:jest.fn()}));
jest.mock("react-native", () => ({ Platform:{OS:"web"}, ScrollView:mockElement, RefreshControl:() => null, useColorScheme:() => "light" }));
jest.mock("lucide-react-native", () => new Proxy({}, { get:() => () => null }));
jest.mock("expo-clipboard", () => ({ setStringAsync:jest.fn(async () => true) }));
jest.mock("../hooks/useAuthGuard", () => ({ useAuthGuard:() => ({token:"fixture",isChecking:false}) }));
jest.mock("../components/ui/button", () => ({ Button:({children,onPress,isDisabled,accessibilityLabel}) => <button onClick={onPress} disabled={isDisabled} aria-label={accessibilityLabel}>{children}</button>, ButtonText:mockElement, ButtonIcon:() => null, ButtonSpinner:() => null }));
jest.mock("../components/ui/modal", () => ({ Modal:({isOpen,children}) => isOpen ? <div role="dialog">{children}</div> : null, ...Object.fromEntries(["Backdrop","Content","Header","Body","Footer"].map(key => [`Modal${key}`,mockElement])) }));
jest.mock("../components/ui/alert-dialog", () => ({ AlertDialog:({isOpen,children}) => isOpen ? <div role="alertdialog">{children}</div> : null, ...Object.fromEntries(["Backdrop","Content","Header","Body","Footer"].map(key => [`AlertDialog${key}`,mockElement])) }));
const mockToast = {show:jest.fn()};
jest.mock("../components/ui/toast", () => ({Toast:mockElement,ToastDescription:mockElement,ToastTitle:mockElement,useToast:() => mockToast}));
jest.mock("../services/hyperhive", () => ({ getVmDiskDownloadUrl:jest.fn(), listDiskOperations:jest.fn(async () => []), importVmDisk:jest.fn(), moveVmDisk:jest.fn(), reconcileDiskOperation:jest.fn(), listVmDisks:jest.fn(), listMounts:jest.fn(async () => []), deleteVmDisk:jest.fn(), growVmDisk:jest.fn(), createVmDisk:jest.fn() }));
jest.mock("../services/vms-client", () => ({getAllVMs:jest.fn(),attachVmDisk:jest.fn(),detachVmDisk:jest.fn()}));
const vms = require("../services/vms-client");
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
it("refreshes capacity when creating a disk and reports unavailable data", async () => {
  const mount = {NfsShare:{Id:1,Name:"Storage",MachineName:"host"}, Status:{working:true,spaceOccupiedGB:20,spaceFreeGB:80,spaceTotalGB:100}};
  api.listVmDisks.mockResolvedValue([]);
  api.listMounts.mockResolvedValueOnce([mount]).mockResolvedValueOnce([mount]);
  await act(async () => root.render(<Screen />));
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent.includes("Create VM Disk")).click());
  expect(api.listMounts).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="dialog"]').textContent).toContain("20 GB used, 80 GB free of 100 GB total");
  await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent.includes("Cancel")).click());
  api.listMounts.mockRejectedValueOnce(new Error("offline"));
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent.includes("Create VM Disk")).click());
  expect(container.querySelector('[role="dialog"]').textContent).toContain("NFS capacity: unavailable");
});

it("detaches a disk and attaches it to another VM", async () => {
  const disk = {id:1,name:"data",nfs_id:1,disk_path:"/mnt/data",attached_vm_name:"old",size_gb:1};
  api.listVmDisks.mockResolvedValueOnce([disk]).mockResolvedValueOnce([{...disk,attached_vm_name:""}]).mockResolvedValueOnce([{...disk,attached_vm_name:"new"}]);
  vms.getAllVMs.mockResolvedValue([{name:"new",machineName:"host"}]);
  vms.detachVmDisk.mockResolvedValue({});
  vms.attachVmDisk.mockResolvedValue({});
  await act(async () => root.render(<Screen />));
  await act(async () => container.querySelector('[aria-label="Detach disk data"]').click());
  expect(container.querySelector('[role="alertdialog"]').textContent).toContain("Unmount the disk");
  await act(async () => [...container.querySelectorAll('[role="alertdialog"] button')].find(b => b.textContent === "Detach").click());
  expect(vms.detachVmDisk).toHaveBeenCalledWith("old",1);
  await act(async () => container.querySelector('[aria-label="Attach disk data"]').click());
  await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === "new (host)").click());
  await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === "Attach").click());
  expect(vms.attachVmDisk).toHaveBeenCalledWith("new",1);
  expect(container.textContent).toContain("Attached VM: new");
});
it("keeps the attachment dialog open and refreshes after a detach failure", async () => {
  const disk = {id:1,name:"data",nfs_id:1,disk_path:"/mnt/data",attached_vm_name:"old",size_gb:1};
  api.listVmDisks.mockResolvedValue([disk]);
  vms.detachVmDisk.mockRejectedValueOnce(new Error("guest refused detach"));
  await act(async () => root.render(<Screen />));
  await act(async () => container.querySelector('[aria-label="Detach disk data"]').click());
  await act(async () => [...container.querySelectorAll('[role="alertdialog"] button')].find(b => b.textContent === "Detach").click());
  expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(api.listVmDisks).toHaveBeenCalledTimes(2);
  expect(mockToast.show.mock.calls.at(-1)[0].render({id:"test"}).props.action).toBe("error");
});

it("imports a selected browser image and shows verification after upload progress", async () => {
  api.listVmDisks.mockResolvedValue([]);
  api.listMounts.mockResolvedValue([{NfsShare:{Id:2,Name:"Destination",MachineName:"host"},Status:{working:true,spaceOccupiedGB:10,spaceFreeGB:90,spaceTotalGB:100}}]);
  require("expo-document-picker").getDocumentAsync.mockResolvedValue({canceled:false,assets:[{name:"image.raw",file:new File(["image"],"image.raw")}]});
  let finish;
  api.importVmDisk.mockImplementation((name,nfs,file,options) => {options.onProgress(100);return new Promise(resolve => {finish=resolve;});});
  await act(async () => root.render(<Screen />));
  await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === "Import Disk").click());
  await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.includes("Choose raw")).click());
  await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === "Destination (host)").click());
  expect(container.textContent).toContain("90 GB free");
  await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === "Import disk").click());
  expect(api.importVmDisk.mock.calls[0][0]).toBe("image");
  expect(api.importVmDisk.mock.calls[0][1]).toBe(2);
  expect(container.textContent).toContain("Validating and registering");
  await act(async () => finish({id:1}));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});
it("excludes the source NFS when moving and reports failures without closing the dialog", async () => {
  api.listVmDisks.mockResolvedValue([{id:1,name:"data",nfs_id:1,attached_vm_name:"guest",size_gb:1}]);
  api.listMounts.mockResolvedValue([1,2].map(Id => ({NfsShare:{Id,Name:`Share ${Id}`,MachineName:"host"},Status:{working:true}})));
  api.moveVmDisk.mockRejectedValue(new Error("operation move-1 requires reconciliation"));
  await act(async () => root.render(<Screen />));
  await act(async () => container.querySelector('[aria-label="Move disk data"]').click());
  const dialog=container.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain("Keep it stopped throughout");
  expect(dialog.textContent).toContain("Capacity: unavailable");
  expect([...dialog.querySelectorAll("button")].some(b => b.textContent === "Share 1 (host)")).toBe(false);
  await act(async () => [...dialog.querySelectorAll("button")].find(b => b.textContent === "Share 2 (host)").click());
  await act(async () => [...dialog.querySelectorAll("button")].find(b => b.textContent === "Move disk").click());
  expect(api.moveVmDisk).toHaveBeenCalledWith(1,2);
  expect(dialog.textContent).toContain("requires reconciliation");
});
it("shows cleanup-required operations and offers reconciliation", async () => {
  api.listVmDisks.mockResolvedValue([]);
  api.listDiskOperations.mockResolvedValueOnce([{id:"move-2",kind:"move",disk_id:1,name:"data",phase:"cleanup-required",error:"source unreachable"}]).mockResolvedValue([]);
  api.reconcileDiskOperation.mockResolvedValue({phase:"complete"});
  await act(async () => root.render(<Screen />));
  expect(container.textContent).toContain("Moved; source cleanup required");
  await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === "Reconcile transfer").click());
  expect(api.reconcileDiskOperation).toHaveBeenCalledWith("move-2","finish");
  expect(container.textContent).not.toContain("source cleanup required");
});


it("reports browser download errors", async () => {
  api.listVmDisks.mockResolvedValue([{id:1,name:"download",nfs_id:1,size_gb:1}]);
  api.getVmDiskDownloadUrl.mockRejectedValue(new Error("session expired"));
  await act(async () => root.render(<Screen />));
  await act(async () => container.querySelector('[aria-label="Download disk download"]').click());
  expect(api.getVmDiskDownloadUrl).toHaveBeenCalledWith(1);
  expect(mockToast.show.mock.calls.at(-1)[0].render({id:"download-error"}).props.action).toBe("error");

});
