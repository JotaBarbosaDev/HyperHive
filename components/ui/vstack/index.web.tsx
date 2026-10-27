import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { vstackStyle } from './styles';
import { cleanStyle } from '../clean-style';
import { cleanAccessibilityProps, type WebAccessibilityProps } from '../clean-accessibility';

type IVStackProps = React.ComponentProps<'div'> &
  WebAccessibilityProps &
  VariantProps<typeof vstackStyle>;

const VStack = React.forwardRef<React.ComponentRef<'div'>, IVStackProps>(
  function VStack({ className, space, reversed, style, ...props }, ref) {
    const domProps = cleanAccessibilityProps(props);
    return (
      <div
        className={vstackStyle({
          space,
          reversed: reversed as boolean,
          class: className,
        })}
        style={cleanStyle(style)}
        {...domProps}
        ref={ref}
      />
    );
  }
);

VStack.displayName = 'VStack';

export { VStack };
