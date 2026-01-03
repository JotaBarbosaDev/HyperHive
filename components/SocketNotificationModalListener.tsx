import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { parseHyperHiveSocketPayload } from "@/utils/socketMessages";

type NotificationSocketMessage = {
  type?: unknown;
  Type?: unknown;
  data?: unknown;
  Data?: unknown;
  extra?: unknown;
  Extra?: unknown;
};

type NotificationPayload = {
  title: string;
  message: string;
  receivedAt: number;
};

const toDisplayString = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const normalizeNotificationMessage = (
  raw: unknown
): Omit<NotificationPayload, "receivedAt"> | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as NotificationSocketMessage;
  const typeCandidate =
    typeof record.type === "string"
      ? record.type
      : typeof record.Type === "string"
      ? record.Type
      : "";
  if (typeCandidate.trim().toLowerCase() !== "notification") {
    return null;
  }

  const title = toDisplayString(record.extra ?? record.Extra) || "Notification";
  const message = toDisplayString(record.data ?? record.Data);
  return {
    title,
    message,
  };
};

export function SocketNotificationModalListener() {
  const [notification, setNotification] = React.useState<NotificationPayload | null>(null);

  const handleSocketPayload = React.useCallback(async (payload: unknown) => {
    const messages = await parseHyperHiveSocketPayload(payload);
    let normalized: Omit<NotificationPayload, "receivedAt"> | null = null;
    for (const message of messages) {
      const candidate = normalizeNotificationMessage(message);
      if (candidate) {
        normalized = candidate;
      }
    }
    if (normalized) {
      setNotification({
        ...normalized,
        receivedAt: Date.now(),
      });
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      try {
        await ensureHyperHiveWebsocket();
      } catch (err) {
        console.warn("SocketNotificationModalListener: unable to ensure websocket", err);
      }
      if (!isMounted) {
        return;
      }
      unsubscribe = subscribeToHyperHiveWebsocket((payload) => {
        void handleSocketPayload(payload);
      });
    };

    setup();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [handleSocketPayload]);

  const handleClose = React.useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <Modal isOpen={Boolean(notification)} onClose={handleClose} size="md">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Box className="flex-1 pr-4">
            <Text className="text-lg font-semibold text-typography-900 dark:text-[#E2E8F0]">
              {notification?.title ?? "Notification"}
            </Text>
          </Box>
        </ModalHeader>
        <ModalBody>
          {notification?.message ? (
            <Box className="bg-background-100 dark:bg-[#111827] rounded-md p-3">
              <Text className="text-sm text-typography-900 dark:text-[#E2E8F0]">
                {notification.message}
              </Text>
            </Box>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button onPress={handleClose} size="sm">
            <ButtonText>OK</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
