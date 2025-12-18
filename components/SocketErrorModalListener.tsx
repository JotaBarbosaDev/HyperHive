import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalCloseButton,
} from "@/components/ui/modal";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { parseHyperHiveSocketPayload } from "@/utils/socketMessages";

type ErrorSocketMessage = {
  type?: unknown;
  data?: unknown;
};

const normalizeErrorMessage = (raw: unknown): string | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as ErrorSocketMessage;
  const rawType = typeof candidate.type === "string" ? candidate.type : "";
  if (rawType.trim().toLowerCase() !== "error") {
    return null;
  }
  const payload = candidate.data;
  if (typeof payload === "string") {
    return payload.trim() || "Unknown error received.";
  }
  if (payload === undefined || payload === null) {
    return "Unknown error received.";
  }
  return String(payload);
};

export function SocketErrorModalListener() {
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSocketPayload = React.useCallback(async (payload: unknown) => {
    const messages = await parseHyperHiveSocketPayload(payload);
    for (const message of messages) {
      const normalized = normalizeErrorMessage(message);
      if (normalized) {
        setErrorMessage(normalized);
        break;
      }
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    const setup = async () => {
      try {
        await ensureHyperHiveWebsocket();
      } catch (err) {
        console.warn("SocketErrorModalListener: unable to ensure websocket", err);
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
    setErrorMessage(null);
  }, []);

  return (
    <Modal isOpen={Boolean(errorMessage)} onClose={handleClose} size="md">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Box className="flex-1 pr-4">
            <Text className="text-lg font-semibold text-typography-900 dark:text-[#E2E8F0]">
              Operation Error
            </Text>
          </Box>
          <ModalCloseButton onPress={handleClose} />
        </ModalHeader>
        <ModalBody>
          <Box className="bg-background-100 dark:bg-[#111827] rounded-md p-3">
            <Text className="font-mono text-sm text-typography-900 dark:text-[#E2E8F0]">
              {errorMessage}
            </Text>
          </Box>
        </ModalBody>
        <ModalFooter>
          <Button onPress={handleClose} size="sm">
            <ButtonText>Close</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
