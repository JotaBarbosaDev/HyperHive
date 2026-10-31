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
    onLayout?: (event: {
      nativeEvent: { layout: { x: number; y: number; width: number; height: number } };
    }) => void;
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
      onLayout,
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

    const elementRef = React.useRef<HTMLSpanElement | null>(null);
    const setRef = React.useCallback(
      (node: HTMLSpanElement | null) => {
        elementRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLSpanElement | null>).current = node;
      },
      [ref]
    );

    React.useEffect(() => {
      const element = elementRef.current;
      if (!onLayout || !element || typeof ResizeObserver === 'undefined') return;
      let lastWidth = -1;
      let lastHeight = -1;
      const observer = new ResizeObserver(() => {
        const rect = element.getBoundingClientRect();
        if (rect.width === lastWidth && rect.height === lastHeight) return;
        lastWidth = rect.width;
        lastHeight = rect.height;
        onLayout({
          nativeEvent: { layout: { x: 0, y: 0, width: rect.width, height: rect.height } },
        });
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, [onLayout]);

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
        ref={setRef}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
