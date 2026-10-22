import { StyleSheet } from 'react-native';

export function cleanStyle(style: any): Record<string, any> | undefined {
  if (style == null) return undefined;
  if (typeof (style as any).getPropertyValue === 'function') {
    const plain: Record<string, string> = {};
    const cssStyle = style as CSSStyleDeclaration;
    for (let i = 0; i < cssStyle.length; i++) {
      const prop = cssStyle[i];
      plain[prop] = cssStyle.getPropertyValue(prop);
    }
    return plain;
  }
  const flat = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  if (flat == null || typeof flat !== 'object') return undefined;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (/^\d+$/.test(key)) {
      if (value && typeof value === 'object') {
        const nested = cleanStyle(value);
        if (nested) Object.assign(result, nested);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
