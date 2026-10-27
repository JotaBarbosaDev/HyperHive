import type { AccessibilityRole, AccessibilityState, AccessibilityValue } from 'react-native';
import React from 'react';

export const roleAliases: Partial<Record<AccessibilityRole, React.AriaRole | undefined>> = {
  header: 'heading',
  image: 'img',
  imagebutton: 'button',
  adjustable: 'slider',
  none: 'presentation',
  text: undefined,
  summary: 'region',
  keyboardkey: undefined,
};

export type WebAccessibilityProps = {
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  accessibilityHint?: string;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  accessibilityValue?: AccessibilityValue;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  accessibilityViewIsModal?: boolean;
  accessibilityLabelledBy?: string | string[];
  accessibilityActions?: readonly any[];
  onAccessibilityAction?: (event: any) => void;
  accessibilityLanguage?: string;
  accessibilityKeyShortcuts?: readonly string[];
  testID?: string;
  nativeID?: string;
};

export function cleanAccessibilityProps<T extends Record<string, any>>(props: T): Record<string, any> {
  const {
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
    accessibilityHint,
    accessibilityLiveRegion,
    accessibilityValue,
    accessibilityElementsHidden,
    importantForAccessibility,
    accessibilityViewIsModal,
    accessibilityLabelledBy,
    accessibilityActions,
    onAccessibilityAction,
    accessibilityLanguage,
    accessibilityKeyShortcuts,
    testID,
    nativeID,
    ...rest
  } = props as T & WebAccessibilityProps;

  const result: Record<string, any> = { ...rest };

  if (accessibilityLabel != null && result['aria-label'] == null) {
    result['aria-label'] = accessibilityLabel;
  }

  if (accessibilityRole != null && result.role == null) {
    const mapped = Object.prototype.hasOwnProperty.call(roleAliases, accessibilityRole)
      ? roleAliases[accessibilityRole]
      : (accessibilityRole as React.AriaRole);
    if (mapped != null) {
      result.role = mapped;
    }
  }

  if (accessibilityState) {
    if (accessibilityState.disabled != null && result['aria-disabled'] == null) {
      result['aria-disabled'] = accessibilityState.disabled;
    }
    if (accessibilityState.selected != null && result['aria-selected'] == null) {
      result['aria-selected'] = accessibilityState.selected;
    }
    if (accessibilityState.checked != null && result['aria-checked'] == null) {
      result['aria-checked'] = accessibilityState.checked;
    }
    if (accessibilityState.busy != null && result['aria-busy'] == null) {
      result['aria-busy'] = accessibilityState.busy;
    }
    if (accessibilityState.expanded != null && result['aria-expanded'] == null) {
      result['aria-expanded'] = accessibilityState.expanded;
    }
  }

  if (accessibilityLiveRegion != null && result['aria-live'] == null) {
    result['aria-live'] = accessibilityLiveRegion === 'none' ? 'off' : accessibilityLiveRegion;
  }

  if (accessibilityHint != null && result['aria-description'] == null) {
    result['aria-description'] = accessibilityHint;
  }

  if (accessibilityValue) {
    if (accessibilityValue.min != null && result['aria-valuemin'] == null) {
      result['aria-valuemin'] = accessibilityValue.min;
    }
    if (accessibilityValue.max != null && result['aria-valuemax'] == null) {
      result['aria-valuemax'] = accessibilityValue.max;
    }
    if (accessibilityValue.now != null && result['aria-valuenow'] == null) {
      result['aria-valuenow'] = accessibilityValue.now;
    }
    if (accessibilityValue.text != null && result['aria-valuetext'] == null) {
      result['aria-valuetext'] = accessibilityValue.text;
    }
  }

  if (accessibilityElementsHidden || importantForAccessibility === 'no-hide-descendants') {
    if (result['aria-hidden'] == null) {
      result['aria-hidden'] = true;
    }
  }

  if (accessibilityViewIsModal != null && result['aria-modal'] == null) {
    result['aria-modal'] = accessibilityViewIsModal;
  }

  if (accessibilityLabelledBy != null && result['aria-labelledby'] == null) {
    result['aria-labelledby'] = Array.isArray(accessibilityLabelledBy)
      ? accessibilityLabelledBy.join(' ')
      : accessibilityLabelledBy;
  }

  if (testID != null && result['data-testid'] == null) {
    result['data-testid'] = testID;
  }

  if (nativeID != null && result.id == null) {
    result.id = nativeID;
  }

  return result;
}
