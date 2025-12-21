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

const StableTextInput = React.forwardRef<TextInput, TextInputProps>(
  function StableTextInput(
    {
      onChange,
      onSelectionChange,
      onFocus,
      onBlur,
      selection: selectionProp,
      value,
      ...props
    },
    ref
  ) {
    const inputRef = React.useRef<TextInput | null>(null);
    const selectionRef = React.useRef<Selection | null>(null);
    const isFocusedRef = React.useRef(false);
    // Preserve cursor position for controlled web inputs.
    const preserveSelection =
      Platform.OS === 'web' &&
      selectionProp === undefined &&
      value !== undefined;

    const updateSelectionFromTarget = React.useCallback(
      (target?: EventTarget | null) => {
        if (!preserveSelection) {
          return;
        }
        const node = target as
          | (EventTarget & { selectionStart?: number; selectionEnd?: number })
          | null;
        if (
          node &&
          typeof node.selectionStart === 'number' &&
          typeof node.selectionEnd === 'number'
        ) {
          selectionRef.current = {
            start: node.selectionStart,
            end: node.selectionEnd,
          };
        }
      },
      [preserveSelection]
    );

    const handleChange = React.useCallback(
      (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
        if (preserveSelection) {
          updateSelectionFromTarget(event.target);
        }
        onChange?.(event);
      },
      [onChange, preserveSelection, updateSelectionFromTarget]
    );

    const handleSelectionChange = React.useCallback(
      (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        selectionRef.current = event.nativeEvent.selection;
        onSelectionChange?.(event);
      },
      [onSelectionChange]
    );

    const handleFocus = React.useCallback(
      (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
        isFocusedRef.current = true;
        if (preserveSelection) {
          updateSelectionFromTarget(event.target);
        }
        onFocus?.(event);
      },
      [onFocus, preserveSelection, updateSelectionFromTarget]
    );

    const handleBlur = React.useCallback(
      (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
        isFocusedRef.current = false;
        onBlur?.(event);
      },
      [onBlur]
    );

    const getClampedSelection = React.useCallback(() => {
      if (!preserveSelection) {
        return null;
      }
      const selection = selectionRef.current;
      if (!selection) {
        return null;
      }
      const valueLength =
        typeof value === 'string'
          ? value.length
          : String(value ?? '').length;
      return {
        start: Math.min(selection.start, valueLength),
        end: Math.min(selection.end, valueLength),
      };
    }, [preserveSelection, value]);

    const applySelection = React.useCallback(() => {
      if (!preserveSelection || !isFocusedRef.current) {
        return;
      }
      const node = inputRef.current as unknown as {
        value?: string;
        selectionStart?: number;
        selectionEnd?: number;
        setSelectionRange?: (start: number, end: number) => void;
      } | null;
      const selection = getClampedSelection();
      if (!node || !selection || typeof node.setSelectionRange !== 'function') {
        return;
      }
      if (
        node.selectionStart !== selection.start ||
        node.selectionEnd !== selection.end
      ) {
        try {
          node.setSelectionRange(selection.start, selection.end);
        } catch {
          // Ignore selection errors on unsupported inputs.
        }
      }
    }, [getClampedSelection, preserveSelection]);

    React.useLayoutEffect(() => {
      if (preserveSelection) {
        applySelection();
      }
    }, [applySelection, preserveSelection, value]);

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
        selection={
          preserveSelection ? getClampedSelection() ?? undefined : selectionProp
        }
        onChange={preserveSelection ? handleChange : onChange}
        onSelectionChange={
          preserveSelection ? handleSelectionChange : onSelectionChange
        }
        onFocus={preserveSelection ? handleFocus : onFocus}
        onBlur={preserveSelection ? handleBlur : onBlur}
      />
    );
  }
);

StableTextInput.displayName = 'StableTextInput';

export { StableTextInput };
