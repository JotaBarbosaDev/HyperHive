/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";

jest.mock("../components/ui/box", () => ({ Box: ({ children, accessibilityRole }) => <div role={accessibilityRole}>{children}</div> }));
jest.mock("../components/ui/text", () => ({ Text: ({ children }) => <span>{children}</span> }));
jest.mock("../components/ui/pressable", () => ({ Pressable: ({ children, onPress, accessibilityRole, accessibilityLabel }) => <button role={accessibilityRole} aria-label={accessibilityLabel} onClick={onPress}>{children}</button> }));
jest.mock("../components/automations/automation-ui", () => ({ mono: "", subtle: "" }));
jest.mock("../services/automations", () => ({
  errorText: (e, f) => f,
  getConditionCatalog: jest.fn(async () => ({ apps: [{ id: "a1", name: "DB", connectivity: "online", health: "healthy", instances: [], streams: [{ name: "cpu", type: "number", unit: "%", value: 42 }] }] })),
}));
const { ConditionInput } = require("../components/automations/condition-input");

function Harness({ initial = "", onValue }) {
  const [value, setValue] = React.useState(initial);
  return <ConditionInput value={value} showVariables onChange={(v) => { setValue(v); onValue?.(v); }} />;
}

let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

const rows = () => [...container.querySelectorAll('[role="menuitem"]')].map((el) => el.getAttribute("aria-label"));

it("suggests Apps on focus, inserts with Enter and lints a typo", async () => {
  let last = "";
  await act(async () => root.render(<Harness onValue={(v) => { last = v; }} />));
  const textarea = container.querySelector("textarea");
  await act(async () => { textarea.focus(); });
  expect(rows()[0]).toContain("app('DB')");
  await act(async () => { textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); });
  expect(last).toBe("app('DB').");
  expect(rows()[0]).toMatch(/^health/);
  expect(container.textContent).toContain("42 %");
});

it("shows hints for unknown streams", async () => {
  await act(async () => root.render(<Harness initial="app('DB').cpuu > 1" />));
  expect(container.textContent).toContain("DB has no stream 'cpuu'. Did you mean 'cpu'?");
});
