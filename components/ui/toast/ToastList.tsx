import { useKeyboardBottomInset } from "@gluestack-ui/utils/hooks";
import { Overlay } from "@gluestack-ui/core/overlay/creator";
import React from "react";
import { Platform, View } from "react-native";
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { OverlayAnimatePresence } from "@gluestack-ui/core/lib/esm/toast/creator/OverlayAnimatePresence";
import { ToastContext } from "@gluestack-ui/core/lib/esm/toast/creator/ToastContext";

const initialAnimationOffset = 24;
const transitionConfig = {
  bottom: initialAnimationOffset,
  top: -initialAnimationOffset,
  "top right": -initialAnimationOffset,
  "top left": -initialAnimationOffset,
  "bottom left": initialAnimationOffset,
  "bottom right": initialAnimationOffset,
} as const;

const toastPositionStyle = Platform.OS === "web" ? "fixed" : "absolute";
const POSITIONS = {
  top: {
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  "top right": {
    top: 0,
    right: 0,
    alignItems: "flex-end",
  },
  "top left": {
    top: 0,
    left: 0,
    alignItems: "flex-start",
  },
  bottom: {
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  "bottom left": {
    bottom: 0,
    left: 0,
    alignItems: "flex-start",
  },
  "bottom right": {
    bottom: 0,
    right: 0,
    alignItems: "flex-end",
  },
} as const;

export const ToastList = () => {
  const {
    toastInfo,
    visibleToasts,
    removeToast,
    AnimationWrapper,
    AnimatePresence: ContextAnimatePresence,
  } = React.useContext(ToastContext);
  const AnimationView = AnimationWrapper?.current;
  const AnimatePresence = ContextAnimatePresence?.current;
  const bottomInset = useKeyboardBottomInset() * 2;

  const positions = Object.keys(toastInfo);
  let hasToastOnOverlay = false;
  positions.forEach((position) => {
    if (toastInfo[position]?.length > 0) {
      hasToastOnOverlay = true;
    }
  });

  if (positions.length === 0) {
    return null;
  }

  return (
    <Overlay isOpen={hasToastOnOverlay} isKeyboardDismissable={false}>
      {positions.map((position) => {
        if (!Object.keys(POSITIONS).includes(position)) {
          return null;
        }
        return (
          <View
            key={position}
            pointerEvents="box-none"
            style={{
              justifyContent: "center",
              margin: "auto",
              position: toastPositionStyle,
              ...(POSITIONS as Record<string, object>)[position],
            }}
          >
            {toastInfo[position].map((toast: any) => {
              return (
                <SafeAreaProvider key={toast.id} initialMetrics={initialWindowMetrics}>
                  <SafeAreaView pointerEvents="box-none">
                    <OverlayAnimatePresence
                      visible={visibleToasts[toast.id]}
                      AnimatePresence={AnimatePresence}
                      onExit={() => {
                        removeToast(toast.id);
                        toast.config?.onCloseComplete?.();
                      }}
                    >
                      <AnimationView
                        initial={{
                          opacity: 0,
                          y: transitionConfig[position as keyof typeof transitionConfig],
                        }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          y: transitionConfig[position as keyof typeof transitionConfig],
                        }}
                        transition={{
                          type: "timing",
                          duration: 150,
                        }}
                        key={toast.id}
                        pointerEvents="box-none"
                        {...toast.config?.containerStyle}
                      >
                        <View
                          style={{
                            bottom:
                              ["bottom", "bottom-left", "bottom-right"].includes(position) &&
                              toast.config?.avoidKeyboard
                                ? bottomInset
                                : undefined,
                          }}
                        >
                          {toast.component}
                        </View>
                      </AnimationView>
                    </OverlayAnimatePresence>
                  </SafeAreaView>
                </SafeAreaProvider>
              );
            })}
          </View>
        );
      })}
    </Overlay>
  );
};
