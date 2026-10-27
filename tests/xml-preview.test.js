/** @jest-environment jsdom */
import React, {act} from "react";
import {createRoot} from "react-dom/client";
const mockElement = ({children}) => <div>{children}</div>;
for (const [name, exports] of Object.entries({box:["Box"],text:["Text"],heading:["Heading"],vstack:["VStack"],hstack:["HStack"],badge:["Badge","BadgeText"],spinner:["Spinner"],icon:["Icon"],divider:["Divider"],"form-control":["FormControl","FormControlError","FormControlErrorText","FormControlHelper","FormControlHelperText","FormControlLabel","FormControlLabelText"],textarea:["Textarea","TextareaInput"]})) {
  jest.doMock(`../components/ui/${name}`, () => Object.fromEntries(exports.map(key => [key,mockElement])));
}
jest.mock("react-native", () => ({ScrollView: mockElement, RefreshControl: () => null, useColorScheme: () => "dark"}));
jest.mock("../components/ui/button", () => ({Button: ({children,onPress,accessibilityLabel,accessibilityState}) => <button onClick={onPress} aria-label={accessibilityLabel} aria-expanded={accessibilityState?.expanded}>{children}</button>, ButtonText: mockElement, ButtonIcon: () => null, ButtonSpinner: () => null}));
jest.mock("../components/ui/input", () => ({Input: mockElement,InputField: () => null,InputIcon: () => null,InputSlot: mockElement}));
jest.mock("../components/ui/modal", () => Object.fromEntries(["Modal","ModalBackdrop","ModalBody","ModalCloseButton","ModalContent","ModalFooter","ModalHeader"].map(key => [key, () => null])));
jest.mock("../components/ui/alert-dialog", () => Object.fromEntries(["AlertDialog","AlertDialogBackdrop","AlertDialogBody","AlertDialogContent","AlertDialogFooter","AlertDialogHeader"].map(key => [key, () => null])));
jest.mock("../components/ui/toast", () => { const toast = {show: jest.fn()}; return {Toast: mockElement, ToastTitle: mockElement, ToastDescription: mockElement, useToast: () => toast}; });
jest.mock("lucide-react-native", () => new Proxy({}, {get: () => () => null}));
jest.mock("../hooks/useAuthGuard", () => ({useAuthGuard: () => ({token:"test",isChecking:false})}));
jest.mock("../services/api-client", () => ({ApiError: class extends Error {}}));
const xml = '<domain>\n  <name>$Name &amp; $name</name>\n  <![CDATA[<script>unsafe</script>]]>\n  <broken';
jest.mock("../services/xml-templates-client", () => ({listXmlTemplates: jest.fn(), createXmlTemplate: jest.fn(), deleteXmlTemplate: jest.fn(), getXmlTemplate: jest.fn(), updateXmlTemplate: jest.fn()}));
const client = require("../services/xml-templates-client");
const Screen = require("../app/vms-xml-templates").default;
it("expands and collapses literal XML without losing whitespace, case or malformed content", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  client.listXmlTemplates.mockResolvedValue([{id:1, name:"Sample", xml}]);
  const container = document.createElement("div"); const root = createRoot(container);
  await act(async () => root.render(<Screen/>));
  const toggle = container.querySelector('[aria-label="Expand XML preview for Sample"]');
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => toggle.click());
  expect(container.querySelector('[aria-label="Collapse XML preview for Sample"]').getAttribute("aria-expanded")).toBe("true");
  expect([...container.querySelectorAll("div")].some(node => node.textContent === xml)).toBe(true);
  expect(container.querySelector("script")).toBeNull();
  await act(async () => container.querySelector('[aria-label="Collapse XML preview for Sample"]').click());
  expect(container.querySelector('[aria-label="Expand XML preview for Sample"]').getAttribute("aria-expanded")).toBe("false");
  await act(async () => root.unmount());
});

it("formats simple minified XML and safely leaves complex or malformed input unchanged", () => {
  const {formatXmlTemplatePreview} = require("../utils/xml-template-preview");
  expect(formatXmlTemplatePreview('<domain><name>$Name</name><disk path="$qcow2"/></domain>'))
    .toBe('<domain>\n  <name>$Name</name>\n  <disk path="$qcow2"/>\n</domain>');
  for (const input of [xml, '<domain><broken></domain>', '<domain attr="a>b"><name>$Name</name></domain>', '<x>before<y/><z/>after</x>', '<domain><!-- note --><name>$Name</name></domain>', '<domain><![CDATA[<x>$Name</x>]]></domain>', '<domain><bad attr="x"></domain>']) {
    expect(formatXmlTemplatePreview(input)).toBe(input);
  }
});

it("offers the exact original after formatting a minified template", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const original = '<domain><name>$Name</name><disk path="$qcow2"/></domain>';
  client.listXmlTemplates.mockResolvedValue([{id:2, name:"Minified", xml:original}]);
  const container = document.createElement("div"); const root = createRoot(container);
  await act(async () => root.render(<Screen/>));
  await act(async () => container.querySelector('[aria-label="Expand XML preview for Minified"]').click());
  expect(container.textContent).toContain('<domain>\n  <name>$Name</name>');
  await act(async () => container.querySelector('[aria-label="Show original XML for Minified"]').click());
  expect([...container.querySelectorAll("div")].some(node => node.textContent === original)).toBe(true);
  await act(async () => root.unmount());
});
