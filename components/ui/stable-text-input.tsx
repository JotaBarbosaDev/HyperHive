'use client';
import React from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  TextInput,
  TextInputProps,
  TextInputChangeEventData,
  TextInputFocusEventData,
  TextInputSelectionChangeEventData,
} from 'react-native';

type Selection = TextInputSelectionChangeEventData['selection'];
type WebInputTarget = EventTarget & {
  selectionStart?: number;
  selectionEnd?: number;
  setSelectionRange?: (start: number, end: number) => void;
};

const readSelection = (target?: EventTarget | null): Selection | null => {
  const node = target as WebInputTarget | null;
  if (typeof node?.selectionStart !== 'number' || typeof node.selectionEnd !== 'number') {
    return null;
  }
  return { start: node.selectionStart, end: node.selectionEnd };
};

// React Native Web can move a controlled input's caret to the end after a
// value render. Capture the browser's post-input selection and restore it once.
const StableTextInput = React.forwardRef<TextInput, TextInputProps>(
  function StableTextInput(
    { onChange, onFocus, onBlur, selection: selectionProp, value, ...props },
    ref
  ) {
    const inputRef = React.useRef<TextInput | null>(null);
    const pendingSelectionRef = React.useRef<Selection | null>(null);
    const isFocusedRef = React.useRef(false);
    const preserveSelection =
      Platform.OS === 'web' && selectionProp === undefined && value !== undefined;

    const handleChange = React.useCallback(
      (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
        if (preserveSelection) {
          pendingSelectionRef.current =
            readSelection(event.target as unknown as EventTarget) ??
            readSelection(inputRef.current as unknown as EventTarget);
        }
        onChange?.(event);
      },
      [onChange, preserveSelection]
    );

    const handleFocus = React.useCallback(
      (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
        isFocusedRef.current = true;
        onFocus?.(event);
      },
      [onFocus]
    );

    const handleBlur = React.useCallback(
      (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
        isFocusedRef.current = false;
        pendingSelectionRef.current = null;
        onBlur?.(event);
      },
      [onBlur]
    );

    React.useLayoutEffect(() => {
      const selection = pendingSelectionRef.current;
      pendingSelectionRef.current = null;
      if (!preserveSelection || !selection || !isFocusedRef.current) {
        return;
      }
      const node = inputRef.current as unknown as WebInputTarget | null;
      if (!node || typeof node.setSelectionRange !== 'function') {
        return;
      }
      const valueLength = String(value ?? '').length;
      const start = Math.min(selection.start, valueLength);
      const end = Math.min(selection.end, valueLength);
      if (node.selectionStart !== start || node.selectionEnd !== end) {
        try {
          node.setSelectionRange(start, end);
        } catch {
          // Some input types do not support selection ranges.
        }
      }
    }, [preserveSelection, value]);

    const setCombinedRef = React.useCallback(
      (node: TextInput | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<TextInput | null>).current = node;
        }
      },
      [ref]
    );

    return (
      <TextInput
        ref={setCombinedRef}
        {...props}
        value={value}
        selection={selectionProp}
        onChange={preserveSelection ? handleChange : onChange}
        onFocus={preserveSelection ? handleFocus as TextInputProps['onFocus'] : onFocus}
        onBlur={preserveSelection ? handleBlur as TextInputProps['onBlur'] : onBlur}
      />
    );
  }
);

StableTextInput.displayName = 'StableTextInput';

export { StableTextInput };
