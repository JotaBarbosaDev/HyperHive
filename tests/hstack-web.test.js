/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HStack } from '../components/ui/hstack/index.web';
import { VStack } from '../components/ui/vstack/index.web';
import { cleanAccessibilityProps } from '../components/ui/clean-accessibility';

jest.mock('../components/ui/hstack/styles', () => ({
  hstackStyle: ({ class: className }) => className ?? '',
}));
jest.mock('../components/ui/vstack/styles', () => ({
  vstackStyle: ({ class: className }) => className ?? '',
}));

describe('HStack and VStack web accessibility prop handling', () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('maps accessibilityLabel to aria-label on HStack without React unrecognized prop warning', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await act(async () => {
        root.render(
          <HStack
            className="px-4 pb-3 gap-2 flex-wrap"
            accessibilityRole="toolbar"
            accessibilityLabel="Filter disks by health"
          >
            <span>Filter</span>
          </HStack>
        );
      });

      const element = container.querySelector('div');
      expect(element).not.toBeNull();
      expect(element?.getAttribute('aria-label')).toBe('Filter disks by health');
      expect(element?.getAttribute('role')).toBe('toolbar');
      expect(element?.hasAttribute('accessibilityLabel')).toBe(false);
      expect(element?.hasAttribute('accessibilitylabel')).toBe(false);
      expect(element?.hasAttribute('accessibilityRole')).toBe(false);

      // Verify React did not warn about unrecognized DOM props
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      consoleError.mockRestore();
    }
  });

  it('maps accessibilityState and testID on VStack to web semantics', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await act(async () => {
        root.render(
          <VStack
            accessibilityLabel="Device details"
            accessibilityState={{ selected: true, busy: true }}
            testID="device-details-stack"
            nativeID="device-1"
          >
            <span>Details</span>
          </VStack>
        );
      });

      const element = container.querySelector('div');
      expect(element).not.toBeNull();
      expect(element?.getAttribute('aria-label')).toBe('Device details');
      expect(element?.getAttribute('aria-selected')).toBe('true');
      expect(element?.getAttribute('aria-busy')).toBe('true');
      expect(element?.getAttribute('data-testid')).toBe('device-details-stack');
      expect(element?.getAttribute('id')).toBe('device-1');
      expect(element?.hasAttribute('accessibilityState')).toBe(false);
      expect(element?.hasAttribute('testID')).toBe(false);
      expect(element?.hasAttribute('nativeID')).toBe(false);

      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      consoleError.mockRestore();
    }
  });

  it('preserves existing aria-label and role when explicitly provided', () => {
    const cleaned = cleanAccessibilityProps({
      accessibilityLabel: 'Native Label',
      'aria-label': 'Web Label',
      accessibilityRole: 'header',
      role: 'banner',
    });

    expect(cleaned['aria-label']).toBe('Web Label');
    expect(cleaned.role).toBe('banner');
    expect(cleaned.accessibilityLabel).toBeUndefined();
    expect(cleaned.accessibilityRole).toBeUndefined();
  });
});
