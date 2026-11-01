import React from "react";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { parseHyperHiveSocketPayload } from "@/utils/socketMessages";
import type { RunSummary } from "@/services/automations";

type Handlers = {
  onRun?: (run: RunSummary) => void;
  onLog?: (runId: string, chunk: string) => void;
};

// The Automations page mounts several listeners; one shared subscription parses each payload once
// and fans the automation messages out, instead of every listener decoding every socket message.
const listeners = new Set<React.MutableRefObject<Handlers>>();
let unsubscribe: (() => void) | undefined;
let connecting = false;

const dispatch = async (payload: unknown) => {
  const messages = await parseHyperHiveSocketPayload(payload);
  for (const raw of messages) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const msg = raw as { type?: unknown; data?: unknown; extra?: unknown };
    const extra = typeof msg.extra === "string" ? msg.extra : "";
    if (msg.type === "AutomationLog" && typeof msg.data === "string") {
      const chunk = msg.data;
      listeners.forEach((ref) => ref.current.onLog?.(extra, chunk));
    } else if (msg.type === "AutomationRun") {
      let run: RunSummary;
      try {
        run = (typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data) as RunSummary;
      } catch (err) {
        console.warn("Automation socket: invalid AutomationRun payload", err);
        continue;
      }
      if (run && typeof run.id === "string") listeners.forEach((ref) => ref.current.onRun?.(run));
    }
  }
};

const connect = async () => {
  if (unsubscribe || connecting) return;
  connecting = true;
  try {
    await ensureHyperHiveWebsocket();
  } catch (err) {
    console.warn("Automation socket: unable to ensure websocket", err);
  } finally {
    connecting = false;
  }
  // Every listener may have unmounted while the socket was connecting.
  if (!listeners.size || unsubscribe) return;
  unsubscribe = subscribeToHyperHiveWebsocket((payload) => void dispatch(payload));
};

// Listens to AutomationRun / AutomationLog messages on the shared master websocket.
export function useAutomationSocket(handlers: Handlers) {
  const ref = React.useRef(handlers);
  ref.current = handlers;

  React.useEffect(() => {
    listeners.add(ref);
    void connect();
    return () => {
      listeners.delete(ref);
      if (!listeners.size) {
        unsubscribe?.();
        unsubscribe = undefined;
      }
    };
  }, []);
}
