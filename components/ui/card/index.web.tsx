import React from 'react';
import { cardStyle } from './styles';
import { cleanStyle } from '../clean-style';
import { cleanAccessibilityProps, type WebAccessibilityProps } from '../clean-accessibility';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type ICardProps = React.ComponentPropsWithoutRef<'div'> &
  WebAccessibilityProps &
  VariantProps<typeof cardStyle>;

const Card = React.forwardRef<HTMLDivElement, ICardProps>(function Card(
  { className, size = 'md', variant = 'elevated', style, ...props },
  ref
) {
  const domProps = cleanAccessibilityProps(props);
  return (
    <div
      className={cardStyle({ size, variant, class: className })}
      style={cleanStyle(style)}
      {...domProps}
      ref={ref}
    />
  );
});

Card.displayName = 'Card';

export { Card };
