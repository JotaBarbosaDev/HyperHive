import React from "react";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { parseHyperHiveSocketPayload } from "@/utils/socketMessages";
import type { RunSummary } from "@/services/automations";

type Handlers = {
  onRun?: (run: RunSummary) => void;
  onLog?: (runId: string, chunk: string) => void;
};

// Listens to AutomationRun / AutomationLog messages on the shared master websocket.
export function useAutomationSocket(handlers: Handlers) {
  const ref = React.useRef(handlers);
  ref.current = handlers;

  React.useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const handle = async (payload: unknown) => {
      const messages = await parseHyperHiveSocketPayload(payload);
      for (const raw of messages) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const msg = raw as { type?: unknown; data?: unknown; extra?: unknown };
        const extra = typeof msg.extra === "string" ? msg.extra : "";
        if (msg.type === "AutomationLog" && typeof msg.data === "string") {
          ref.current.onLog?.(extra, msg.data);
        } else if (msg.type === "AutomationRun") {
          try {
            const run = (typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data) as RunSummary;
            if (run && typeof run.id === "string") ref.current.onRun?.(run);
          } catch (err) {
            console.warn("Automation socket: invalid AutomationRun payload", err);
          }
        }
      }
    };
    (async () => {
      try {
        await ensureHyperHiveWebsocket();
      } catch (err) {
        console.warn("Automation socket: unable to ensure websocket", err);
      }
      if (!active) return;
      unsubscribe = subscribeToHyperHiveWebsocket((payload) => void handle(payload));
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
}
