import React from "react";
import { Platform } from "react-native";
import { AnimatePresence, Motion } from "@legendapp/motion";
import { Box } from "@/components/ui/box";
import { Toast, ToastDescription, ToastTitle } from "@/components/ui/toast";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { parseHyperHiveSocketPayload } from "@/utils/socketMessages";
import {
  normalizeVmProgressMessage,
  NormalizedVmProgressMessage,
  VmProgressSocketMessage,
} from "@/utils/vmProgress";

type ToastEntry = NormalizedVmProgressMessage & {
  createdAt: number;
  updatedAt: number;
};

const INACTIVITY_TIMEOUT_MS = 8000;

const extractMessages = async (payload: unknown): Promise<VmProgressSocketMessage[]> => {
  const decoded = await parseHyperHiveSocketPayload(payload);
  return decoded.filter(
    (msg): msg is VmProgressSocketMessage => Boolean(msg) && typeof msg === "object" && !Array.isArray(msg)
  );
};

export function VmProgressToastListener() {
  const [toasts, setToasts] = React.useState<Record<string, ToastEntry>>({});
  const timersRef = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const scheduleCleanup = React.useCallback((messageId: string) => {
    const existing = timersRef.current.get(messageId);
    if (existing) {
      clearTimeout(existing);
    }
    const timeout = setTimeout(() => {
      setToasts((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      timersRef.current.delete(messageId);
    }, INACTIVITY_TIMEOUT_MS);
    timersRef.current.set(messageId, timeout);
  }, []);

  const handleSocketPayload = React.useCallback(
    async (payload: unknown) => {
      const rawMessages = await extractMessages(payload);
      const normalizedMessages = rawMessages
        .map((msg) => normalizeVmProgressMessage(msg))
        .filter((msg): msg is NormalizedVmProgressMessage => Boolean(msg));

      normalizedMessages.forEach((message) => {
        setToasts((prev) => {
          const existing = prev[message.id];
          const now = Date.now();
          const entry: ToastEntry = existing
            ? {
                ...existing,
                title: message.title,
                description: message.description,
                vmName: message.vmName ?? existing.vmName,
                updatedAt: now,
              }
            : { ...message, createdAt: now, updatedAt: now };
          return { ...prev, [message.id]: entry };
        });
        scheduleCleanup(message.id);
      });
    },
    [scheduleCleanup]
  );

  React.useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      try {
        await ensureHyperHiveWebsocket();
      } catch (err) {
        console.warn("VM progress listener: unable to ensure websocket", err);
      }
      if (!isActive) return;
      unsubscribe = subscribeToHyperHiveWebsocket((payload) => {
        void handleSocketPayload(payload);
      });
    };

    setup();

    return () => {
      isActive = false;
      unsubscribe?.();
      timersRef.current.forEach((timeout) => clearTimeout(timeout));
      timersRef.current.clear();
      setToasts({});
    };
  }, [handleSocketPayload]);

  const sortedToasts = React.useMemo(
    () => Object.values(toasts).sort((a, b) => a.createdAt - b.createdAt),
    [toasts]
  );

  if (sortedToasts.length === 0) {
    return null;
  }

  const baseOffset = Platform.OS === "web" ? 24 : 24;

  return (
    <Box
      className="pointer-events-none absolute"
      style={{
        right: baseOffset,
        bottom: baseOffset,
        zIndex: 99,
      }}
      pointerEvents="box-none"
    >
      <AnimatePresence>
        {sortedToasts.map((toast) => (
          <Motion.View
            key={toast.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "timing", duration: 150 }}
            style={{ marginBottom: 8 }}
            pointerEvents="box-none"
          >
            <Toast
              nativeID={`vm-progress-${toast.id}`}
              className="px-4 py-3 rounded-xl shadow-soft-2 min-w-[260px] max-w-[360px] gap-1"
              action="info"
              variant="outline"
              style={{ pointerEvents: "auto" }}
            >
              <ToastTitle size="sm">{toast.title}</ToastTitle>
              <ToastDescription size="sm">{toast.description}</ToastDescription>
            </Toast>
          </Motion.View>
        ))}
      </AnimatePresence>
    </Box>
  );
}
