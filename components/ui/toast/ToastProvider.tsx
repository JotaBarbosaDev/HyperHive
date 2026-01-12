import React from "react";
import { View } from "react-native";
import { ToastContext } from "@gluestack-ui/core/lib/esm/toast/creator/ToastContext";
import { ToastList } from "./ToastList";

type ToastProviderProps = {
  children?: React.ReactNode;
};

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toastInfo, setToastInfo] = React.useState<Record<string, any>>({});
  const [visibleToasts, setVisibleToasts] = React.useState<Record<string, boolean>>({});
  const AnimationWrapper = React.useRef(View);
  const AnimatePresence = React.useRef(View);
  const toastIndex = React.useRef(1);

  const hideAll = React.useCallback(() => {
    setVisibleToasts({});
  }, []);

  const hideToast = React.useCallback((id: string) => {
    setVisibleToasts((prevVisibleToasts) => ({
      ...prevVisibleToasts,
      [id]: false,
    }));
  }, []);

  const isActive = React.useCallback(
    (id: string) => {
      for (const toastPosition of Object.keys(toastInfo)) {
        const positionArray = toastInfo[toastPosition];
        if (positionArray.findIndex((toastData: any) => toastData.id === id) > -1) {
          return true;
        }
      }
      return false;
    },
    [toastInfo]
  );

  const removeToast = React.useCallback((id: string) => {
    setToastInfo((prev) => {
      for (const toastPosition of Object.keys(prev)) {
        const positionArray = prev[toastPosition];
        const isToastPresent = positionArray.findIndex((toastData: any) => toastData.id === id) > -1;
        if (isToastPresent) {
          const newPositionArray = positionArray.filter((item: any) => item.id !== id);
          return {
            ...prev,
            [toastPosition]: newPositionArray,
          };
        }
      }
      return prev;
    });
  }, []);

  const setToast = React.useCallback(
    (props: any) => {
      const {
        placement = "bottom",
        render,
        id = `${toastIndex.current++}`,
        duration = 5000,
      } = props;
      if (render) {
        const component = render({ id });
        setToastInfo((prev) => ({
          ...prev,
          [placement]: [
            ...(prev[placement] ? prev[placement] : []).filter((toast: any) => toast.id !== id),
            { component, id, config: props },
          ],
        }));
        setVisibleToasts((toasts) => ({
          ...Object.fromEntries(Object.entries(toasts).filter(([key]) => key !== id)),
          [id]: true,
        }));
        if (duration !== null) {
          setTimeout(() => {
            hideToast(id);
          }, duration);
        }
      }
      return id;
    },
    [hideToast]
  );

  const contextValue = React.useMemo(
    () => ({
      toastInfo,
      setToastInfo,
      setToast,
      removeToast,
      hideAll,
      isActive,
      visibleToasts,
      setVisibleToasts,
      hideToast,
      AnimationWrapper,
      AnimatePresence,
    }),
    [
      toastInfo,
      setToastInfo,
      setToast,
      removeToast,
      hideAll,
      isActive,
      visibleToasts,
      setVisibleToasts,
      hideToast,
    ]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastList />
    </ToastContext.Provider>
  );
};
