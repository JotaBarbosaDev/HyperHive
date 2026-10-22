import React from 'react';
import type {AccessibilityRole} from 'react-native';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { textStyle } from './styles';
import { cleanStyle } from '../clean-style';

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    accessibilityRole?: AccessibilityRole;
    accessibilityLabel?: string;
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
      accessibilityRole,
      accessibilityLabel,
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
    const safeStyle = React.useMemo(() => cleanStyle(style), [style]);

    const roleAliases: Partial<Record<AccessibilityRole, React.AriaRole | undefined>> = {
      header: 'heading', image: 'img', imagebutton: 'button', adjustable: 'slider',
      none: 'presentation', text: undefined, summary: 'region', keyboardkey: undefined,
    };
    const webRole = accessibilityRole && Object.prototype.hasOwnProperty.call(roleAliases, accessibilityRole)
      ? roleAliases[accessibilityRole] : accessibilityRole as React.AriaRole | undefined;

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
        {...props}
        style={{
          ...(selectable !== undefined ? { userSelect: selectable ? 'text' : 'none' } as const : {}),
          ...safeStyle,
          ...(numberOfLines
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: numberOfLines,
                overflow: 'hidden',
              }
            : {}),
        }}
        role={props.role ?? webRole}
        aria-label={props["aria-label"] ?? accessibilityLabel}
        aria-live={props['aria-live'] ?? (accessibilityLiveRegion === 'none' ? 'off' : accessibilityLiveRegion)}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
