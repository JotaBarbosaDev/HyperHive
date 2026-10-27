/** @jest-environment jsdom */
import React, {act} from "react";
import {createRoot} from "react-dom/client";
const mockElement = ({children}) => <div>{children}</div>;
for (const [name, exports] of Object.entries({box:["Box"],text:["Text"],heading:["Heading"],vstack:["VStack"],hstack:["HStack"],badge:["Badge","BadgeText"],select:["Select","SelectBackdrop","SelectContent","SelectDragIndicator","SelectDragIndicatorWrapper","SelectIcon","SelectInput","SelectItem","SelectPortal","SelectTrigger"],modal:["Modal","ModalBackdrop","ModalBody","ModalCloseButton","ModalContent","ModalFooter","ModalHeader"]})) {
  jest.doMock(`../components/ui/${name}`, () => Object.fromEntries(exports.map(key => [key,mockElement])));
}
jest.mock("react-native", () => ({ScrollView:mockElement,RefreshControl:()=>null,useColorScheme:()=>"dark"}));
jest.mock("../components/ui/button", () => ({Button:({children,onPress,isDisabled})=><button disabled={isDisabled} onClick={onPress}>{children}</button>,ButtonText:mockElement,ButtonIcon:()=>null,ButtonSpinner:()=>null}));
jest.mock("lucide-react-native", () => new Proxy({}, {get:()=>()=>null}));
jest.mock("../hooks/useAuthGuard", () => ({useAuthGuard:()=>({token:"test",isChecking:false})}));
jest.mock("../hooks/useMachines", () => ({useMachines:()=>({machines:[{MachineName:"one"},{MachineName:"two"}],isLoading:false,error:null})}));
jest.mock("../hooks/useSelectedMachine", () => ({useSelectedMachine:()=>({selectedMachine:mockMachine,setSelectedMachine:jest.fn()})}));
jest.mock("../services/pci", () => ({listHostGpus:jest.fn(),attachGpuToVm:jest.fn(),detachGpuFromVm:jest.fn()}));
jest.mock("../services/vms-client", () => ({getAllVMs:jest.fn(async()=>[])}));
let mockMachine="one";
const {listHostGpus}=require("../services/pci");
const Screen=require("../app/gpus").default;
let root, container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;mockMachine="one";listHostGpus.mockReset();container=document.createElement("div");root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());});
it("distinguishes loading, empty, error and retry with populated inventory",async()=>{
 let resolve;listHostGpus.mockImplementationOnce(()=>new Promise(r=>resolve=r));
 await act(async()=>root.render(<Screen/>));expect(container.textContent).toContain("Loading GPUs");expect(container.textContent).not.toContain("No GPUs found");
 await act(async()=>resolve([]));expect(container.textContent).toContain("No GPUs found");expect(container.textContent).toContain("select another machine");
 listHostGpus.mockRejectedValueOnce(new Error("Offline"));await act(async()=>container.querySelector("button").click());expect(container.textContent).toContain("Unable to load GPUs: Offline");expect(container.textContent).not.toContain("No GPUs found");
 listHostGpus.mockResolvedValueOnce([{address:"0000:01:00.0",vendor:"Fixture vendor",product:"Fixture GPU"}]);await act(async()=>container.querySelector("button").click());expect(container.textContent).toContain("Fixture GPU");expect(container.textContent).toContain("Total: 1");
});
it("ignores a late response from the previously selected machine",async()=>{
 let resolve;listHostGpus.mockImplementationOnce(()=>new Promise(r=>resolve=r)).mockResolvedValueOnce([{address:"2",product:"Host two GPU"}]);
 await act(async()=>root.render(<Screen/>));mockMachine="two";await act(async()=>root.render(<Screen/>));expect(container.textContent).toContain("Host two GPU");
 await act(async()=>resolve([{address:"1",product:"Old host GPU"}]));expect(container.textContent).not.toContain("Old host GPU");expect(container.textContent).toContain("Host two GPU");
});
