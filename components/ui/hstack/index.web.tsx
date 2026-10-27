import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { hstackStyle } from './styles';
import { cleanStyle } from '../clean-style';
import { cleanAccessibilityProps, type WebAccessibilityProps } from '../clean-accessibility';

type IHStackProps = React.ComponentPropsWithoutRef<'div'> &
  WebAccessibilityProps &
  VariantProps<typeof hstackStyle>;

const HStack = React.forwardRef<React.ComponentRef<'div'>, IHStackProps>(
  function HStack({ className, space, reversed, style, ...props }, ref) {
    const domProps = cleanAccessibilityProps(props);
    return (
      <div
        className={hstackStyle({
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

HStack.displayName = 'HStack';

export { HStack };
