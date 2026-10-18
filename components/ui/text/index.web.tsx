import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    numberOfLines?: number;
    selectable?: boolean;
    accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  };

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      style,
      isTruncated,
      numberOfLines,
      selectable,
      accessibilityLiveRegion,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    return (
      <span
        className={textStyle({
          isTruncated: (isTruncated || numberOfLines === 1) as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        style={{
          ...(selectable !== undefined ? { userSelect: selectable ? 'text' : 'none' } as const : {}),
          ...style,
          ...(numberOfLines
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: numberOfLines,
                overflow: 'hidden',
              }
            : {}),
        }}
        {...props}
        aria-live={props['aria-live'] ?? (accessibilityLiveRegion === 'none' ? 'off' : accessibilityLiveRegion)}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
