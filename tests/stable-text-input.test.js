import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { StableTextInput } from "../components/ui/stable-text-input";

function ControlledInput() {
  const [value, setValue] = React.useState("Release checklist");
  return <StableTextInput value={value} onChangeText={setValue} multiline />;
}

describe("StableTextInput", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("does not replay a stale selection after controlled value updates", async () => {
    await act(async () => {
      root.render(<StableTextInput value="note text" onChangeText={jest.fn()} multiline />);
    });

    const input = container.querySelector("textarea");
    expect(input).not.toBeNull();
    input.focus();
    input.setSelectionRange(4, 4);
    await act(async () => {
      input.dispatchEvent(new Event("select", { bubbles: true }));
    });

    input.setSelectionRange(8, 8);
    await act(async () => {
      root.render(<StableTextInput value="note text!" onChangeText={jest.fn()} multiline />);
    });

    expect(input.selectionStart).not.toBe(4);
    expect(input.selectionEnd).toBe(input.selectionStart);
  });

  test("keeps the caret in place when typing in the middle of a line", async () => {
    await act(async () => {
      root.render(<ControlledInput />);
    });

    const input = container.querySelector("textarea");
    input.focus();
    input.setSelectionRange(5, 5);
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    valueSetter.call(input, "RelXease checklist");
    input.setSelectionRange(6, 6);
    await act(async () => {
      input.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        data: "X",
        inputType: "insertText",
      }));
    });

    expect(input.value).toBe("RelXease checklist");
    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(6);
  });

  test("still honors an explicit selection controlled by the caller", async () => {
    await act(async () => {
      root.render(<StableTextInput value="note text" selection={{ start: 2, end: 5 }} multiline />);
    });

    const input = container.querySelector("textarea");
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(5);
  });
});
