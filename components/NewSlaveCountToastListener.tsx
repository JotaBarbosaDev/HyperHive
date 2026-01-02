import React from "react";
import { Platform } from "react-native";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/ui/toast";
import { getNewSlaveCount } from "@/services/new-slave-count";

const POLL_INTERVAL_MS = 5000;
const TOAST_ID = "new-slave-count";

const buildMessage = (count: number) => {
  const isSingular = count === 1;
  const label = isSingular ? "slave" : "slaves";
  return {
    title: isSingular ? "Preparing a new slave" : "Preparing new slaves",
    description: `We are preparing ${count} ${label}. Please do not perform any actions.`,
  };
};

export function NewSlaveCountToastListener() {
  const toast = useToast();
  const lastCountRef = React.useRef<number | null>(null);
  const inFlightRef = React.useRef(false);

  const showToast = React.useCallback(
    (count: number) => {
      const { title, description } = buildMessage(count);
      toast.show({
        id: TOAST_ID,
        placement: Platform.OS === "web" ? "top" : "bottom",
        duration: null,
        render: ({ id }) => (
          <Toast
            nativeID={"toast-" + id}
            className="w-[92vw] max-w-[92vw] px-4 py-3 gap-2 shadow-soft-1 items-start flex-col self-center web:w-auto web:max-w-3xl web:flex-row web:flex-wrap web:items-center"
            action="warning"
          >
            <ToastTitle size="sm" className="w-full web:w-auto web:whitespace-nowrap">
              {title}
            </ToastTitle>
            <ToastDescription size="sm" className="w-full web:w-auto web:flex-1 web:min-w-0">
              {description}
            </ToastDescription>
          </Toast>
        ),
      });
    },
    [toast]
  );

  const hideToast = React.useCallback(() => {
    if (toast.isActive(TOAST_ID)) {
      toast.close(TOAST_ID);
    }
  }, [toast]);

  React.useEffect(() => {
    let isActive = true;

    const poll = async () => {
      if (!isActive || inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      try {
        const count = await getNewSlaveCount();
        if (!isActive || count == null) {
          return;
        }
        const normalized = Math.max(0, count);
        const previous = lastCountRef.current ?? 0;
        if (normalized > 0 && (normalized !== previous || !toast.isActive(TOAST_ID))) {
          showToast(normalized);
        } else if (normalized === 0 && toast.isActive(TOAST_ID)) {
          hideToast();
        }
        lastCountRef.current = normalized;
      } catch (err) {
        console.warn("Failed to check new slave count", err);
      } finally {
        inFlightRef.current = false;
      }
    };

    void poll();
    const intervalId = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      clearInterval(intervalId);
      hideToast();
    };
  }, [hideToast, showToast, toast]);

  return null;
}
