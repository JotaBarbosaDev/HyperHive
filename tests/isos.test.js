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
jest.mock("../services/hyperhive", () => ({listIsos: jest.fn(async () => [{id:"1",name:"ubuntu-24.iso",mountName:"fast",availableOnSlaves:["worker-1"],filePath:"/iso/ubuntu.iso",checksum:"abc123"},{id:"2",name:"alpine-3.iso",mountName:"archive",availableOnSlaves:[]}]), listMounts: jest.fn(async () => []),deleteIso: jest.fn(),downloadIso: jest.fn()}));
jest.mock("../services/api-client", () => ({ApiError: class extends Error {}}));
jest.mock("../config/apiConfig", () => ({getApiBaseUrl: () => "https://example.test"}));
jest.mock("../services/websocket-client", () => ({subscribeToHyperHiveWebsocket: () => () => {},ensureHyperHiveWebsocket: jest.fn(async () => {})}));
const Screen = require("../app/isos").default;
let root, container;
beforeEach(async () => {global.IS_REACT_ACT_ENVIRONMENT = true;container=document.createElement("div");root=createRoot(container);await act(async () => root.render(<Screen/>));});
afterEach(async () => {await act(async () => root.unmount());});
const button = label => [...container.querySelectorAll("button")].find(el => el.textContent === label);
const click = async el => act(async () => el.click());
it("sorts the inventory and filters by host, then clears the search", async () => {
  expect(container.textContent.indexOf("alpine-3.iso")).toBeLessThan(container.textContent.indexOf("ubuntu-24.iso"));
  await click(button("Name A–Z"));
  expect(container.textContent.indexOf("ubuntu-24.iso")).toBeLessThan(container.textContent.indexOf("alpine-3.iso"));
  await act(async () => {const input=container.querySelector("input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"worker-1");input.dispatchEvent(new Event("input",{bubbles:true}));});
  expect(container.textContent).toContain("1 of 2 images");expect(container.textContent).not.toContain("alpine-3.iso");
  await click(button("Clear search"));expect(container.textContent).toContain("2 of 2 images");
});
it("expands file metadata and keeps removal behind confirmation", async () => {
  expect(container.textContent).not.toContain("abc123");
  await click([...container.querySelectorAll("button")].filter(el => el.textContent === "Details").at(-1));expect(container.textContent).toContain("abc123");expect(container.textContent).toContain("/iso/ubuntu.iso");
  await click(button("Remove ISO"));expect(container.querySelector('[role="dialog"]').textContent).toContain("Remove ISO?");
  expect(require("../services/hyperhive").deleteIso).not.toHaveBeenCalled();
});
