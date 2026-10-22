/** @jest-environment jsdom */
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
jest.mock('../components/ui/box/styles', () => ({boxStyle: ({class: className}) => className}));

import {Box} from '../components/ui/box/index.web';

it('handles onLayout without forwarding it to the DOM', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const ref = React.createRef();
  try {
    await act(async () => root.render(<Box ref={ref} onLayout={() => {}} className="rounded-xl" style={{padding: 12}}>Pool</Box>));
    expect(container.textContent).toBe('Pool');
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current.style.paddingTop).toBe('12px');
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/Unknown event handler property.*onLayout/);
  } finally {
    await act(async () => root.unmount());
    error.mockRestore();
  }
});
