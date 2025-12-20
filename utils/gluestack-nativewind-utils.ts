import * as nativewindUtils from "@gluestack-ui/utils/nativewind-utils";

export const tva = nativewindUtils.tva;
export const cn = nativewindUtils.cn;
export const withStyleContext = nativewindUtils.withStyleContext;
export const isWeb = nativewindUtils.isWeb;
export const flush = nativewindUtils.flush;
export const setFlushStyles = nativewindUtils.setFlushStyles;
export const gluestackPlugin = nativewindUtils.gluestackPlugin;

// Provide a safe default when a component is rendered without its style context.
export const useStyleContext = (scope: string = "Global") => {
  const context = nativewindUtils.useStyleContext(scope);
  return context ?? {};
};
