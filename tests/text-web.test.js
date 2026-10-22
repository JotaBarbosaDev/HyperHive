/** @jest-environment jsdom */
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Text} from '../components/ui/text/index.web';
jest.mock('../components/ui/text/styles', () => ({textStyle: ({class: className}) => className}));

it('maps native accessibility props to web semantics without React warnings', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => root.render(<Text accessibilityRole="alert" accessibilityLabel="Deletion failed" accessibilityLiveRegion="assertive">Retry deletion</Text>));
    const alert = container.querySelector('[role="alert"]');
    expect(alert.textContent).toBe('Retry deletion');
    expect(alert.getAttribute('aria-label')).toBe('Deletion failed');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.hasAttribute('accessibilityRole')).toBe(false);
    expect(error).not.toHaveBeenCalled();
    await act(async () => root.render(<Text accessibilityRole="header">Pools</Text>));
    expect(container.querySelector('[role="heading"]')).not.toBeNull();
    await act(async () => root.render(<Text accessibilityRole="alert" role="status" accessibilityLabel="Native" aria-label="Web">Saved</Text>));
    expect(container.querySelector('[role="status"]').getAttribute('aria-label')).toBe('Web');
  } finally {
    await act(async () => root.unmount());
    error.mockRestore();
  }
});
