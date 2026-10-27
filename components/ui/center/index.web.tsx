import React from 'react';
import { centerStyle } from './styles';
import { cleanStyle } from '../clean-style';
import { cleanAccessibilityProps, type WebAccessibilityProps } from '../clean-accessibility';

import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type ICenterProps = React.ComponentPropsWithoutRef<'div'> &
  WebAccessibilityProps &
  VariantProps<typeof centerStyle>;

const Center = React.forwardRef<HTMLDivElement, ICenterProps>(function Center(
  { className, style, ...props },
  ref
) {
  const domProps = cleanAccessibilityProps(props);
  return (
    <div
      className={centerStyle({ class: className })}
      style={cleanStyle(style)}
      {...domProps}
      ref={ref}
    />
  );
});

Center.displayName = 'Center';

export { Center };
