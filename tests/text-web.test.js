/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Text } from "../components/ui/text/index.web";

jest.mock("@gluestack-ui/utils/nativewind-utils", () => ({
  isWeb: true,
  tva: () => ({ class: className }) => className,
}));

let container;
let root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  jest.restoreAllMocks();
});

it("maps native text props to valid DOM accessibility and selection properties", async () => {
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => root.render(React.createElement(Text, {
    selectable: true,
    accessibilityLiveRegion: "polite",
    children: "Loading…",
  })));
  const text = container.querySelector("span");
  expect(text.getAttribute("aria-live")).toBe("polite");
  expect(text.style.userSelect).toBe("text");
  expect(text.hasAttribute("selectable")).toBe(false);
  expect(text.hasAttribute("accessibilityLiveRegion")).toBe(false);
  expect(errors).not.toHaveBeenCalled();
});

it("supports disabled selection and preserves an explicit aria-live value", async () => {
  await act(async () => root.render(React.createElement(Text, {
    selectable: false,
    accessibilityLiveRegion: "none",
    "aria-live": "assertive",
    children: "Status",
  })));
  const text = container.querySelector("span");
  expect(text.getAttribute("aria-live")).toBe("assertive");
  expect(text.style.userSelect).toBe("none");
});
