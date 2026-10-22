import React, { forwardRef, memo } from 'react';
import { headingStyle } from './styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { cleanStyle } from '../clean-style';
type IHeadingProps = VariantProps<typeof headingStyle> &
  React.ComponentPropsWithoutRef<'h1'> & {
    as?: React.ElementType;
    numberOfLines?: number;
  };

const MappedHeading = memo(
  forwardRef<HTMLHeadingElement, IHeadingProps>(function MappedHeading(
    {
      size,
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      sub,
      italic,
      highlight,
      style,
      numberOfLines,
      ...props
    },
    ref
  ) {
    const safeStyle = {
      ...cleanStyle(style),
      ...(numberOfLines
        ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: numberOfLines, overflow: 'hidden' }
        : {}),
    };
    switch (size) {
      case '5xl':
      case '4xl':
      case '3xl':
        return (
          <h1
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={safeStyle}
            ref={ref}
          />
        );
      case '2xl':
        return (
          <h2
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={safeStyle}
            ref={ref}
          />
        );
      case 'xl':
        return (
          <h3
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={safeStyle}
            ref={ref}
          />
        );
      case 'lg':
        return (
          <h4
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={safeStyle}
            ref={ref}
          />
        );
      case 'md':
        return (
          <h5
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={safeStyle}
            ref={ref}
          />
        );
      case 'sm':
      case 'xs':
        return (
          <h6
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={safeStyle}
            ref={ref}
          />
        );
      default:
        return (
          <h4
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={safeStyle}
            ref={ref}
          />
        );
    }
  })
);

const Heading = memo(
  forwardRef<HTMLHeadingElement, IHeadingProps>(function Heading(
    { className, size = 'lg', as: AsComp, numberOfLines, ...props },
    ref
  ) {
    const {
      isTruncated,
      bold,
      underline,
      strikeThrough,
      sub,
      italic,
      highlight,
      style,
    } = props;

    if (AsComp) {
      return (
        <AsComp
          className={headingStyle({
            size,
            isTruncated: isTruncated as boolean,
            bold: bold as boolean,
            underline: underline as boolean,
            strikeThrough: strikeThrough as boolean,
            sub: sub as boolean,
            italic: italic as boolean,
            highlight: highlight as boolean,
            class: className,
          })}
          {...props}
          style={{
            ...cleanStyle(style),
            ...(numberOfLines
              ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: numberOfLines, overflow: 'hidden' }
              : {}),
          }}
          ref={ref}
        />
      );
    }

    return (
      <MappedHeading className={className} size={size} numberOfLines={numberOfLines} ref={ref} {...props} />
    );
  })
);

Heading.displayName = 'Heading';

export { Heading };
