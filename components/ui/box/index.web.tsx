import React from 'react';
import { View, type ViewProps } from 'react-native';
import { boxStyle } from './styles';
import { cleanStyle } from '../clean-style';

import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type IBoxProps = ViewProps &
  VariantProps<typeof boxStyle> & { className?: string };

const Box = React.forwardRef<React.ComponentRef<typeof View>, IBoxProps>(function Box(
  { className, style, ...props },
  ref
) {
  return (
    <View ref={ref} className={boxStyle({ class: className })} style={cleanStyle(style) as ViewProps["style"]} {...props} />
  );
});

Box.displayName = 'Box';
export { Box };
