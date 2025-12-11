import {getApiBaseUrl} from "@/config/apiConfig";
import {getAuthToken} from "./api-client";

type MessagePayload = string | ArrayBuffer | Blob | ArrayBufferView | null | undefined;
type WebsocketMessageListener = (payload: MessagePayload) => void;

const listeners = new Set<WebsocketMessageListener>();

let activeSocket: WebSocket | null = null;
let activeToken: string | null = null;
let activeBaseUrl: string | null = null;

const notifyListeners = (payload: MessagePayload) => {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      console.error("WebSocket listener failed", err);
    }
  });
};

const resetActiveSocket = (socket?: WebSocket | null) => {
  if (socket && socket !== activeSocket) {
    return;
  }
  activeSocket = null;
  activeToken = null;
  activeBaseUrl = null;
};

const buildWebsocketUrl = (baseUrl: string, token: string) => {
  const parsed = new URL(baseUrl);
  const sanitizedPath = parsed.pathname.replace(/\/+$/, "");
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = sanitizedPath ? `${sanitizedPath}/ws` : "/ws";
  parsed.search = `token=${encodeURIComponent(token)}`;
  parsed.hash = "";
  return parsed.toString();
};

export const subscribeToHyperHiveWebsocket = (listener: WebsocketMessageListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getActiveHyperHiveWebsocket = () => activeSocket;

export const disconnectHyperHiveWebsocket = () => {
  if (!activeSocket) {
    return;
  }
  try {
    activeSocket.close();
  } catch {
    // no-op
  } finally {
    resetActiveSocket();
  }
};

const isSocketReusable = (token: string, baseUrl: string) => {
  if (!activeSocket) {
    return false;
  }
  if (
    activeToken !== token ||
    activeBaseUrl !== baseUrl ||
    (activeSocket.readyState !== WebSocket.OPEN && activeSocket.readyState !== WebSocket.CONNECTING)
  ) {
    return false;
  }
  return true;
};

export const ensureHyperHiveWebsocket = async (options?: {
  token?: string | null;
  baseUrl?: string | null;
}) => {
  const resolvedToken = options?.token ?? getAuthToken();
  const resolvedBaseUrl = options?.baseUrl ?? getApiBaseUrl();

  if (!resolvedToken || !resolvedBaseUrl) {
    throw new Error("Cannot establish WebSocket connection without token and API base URL.");
  }

  if (isSocketReusable(resolvedToken, resolvedBaseUrl)) {
    return activeSocket;
  }

  if (activeSocket) {
    try {
      activeSocket.close();
    } catch {
      // no-op
    }
  }
  resetActiveSocket();

  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) {
    throw new Error("WebSocket API is not available in this environment.");
  }

  const wsUrl = buildWebsocketUrl(resolvedBaseUrl, resolvedToken);
  console.info("[WS] Connecting to", wsUrl);

  const socket = new WebSocketCtor(wsUrl);
  activeSocket = socket;
  activeToken = resolvedToken;
  activeBaseUrl = resolvedBaseUrl;

  socket.onopen = () => {
    console.info("[WS] Connected");
  };

  socket.onmessage = (event: {data: MessagePayload}) => {
    const payload = event?.data;
    console.log("[WS MESSAGE]", payload);
    notifyListeners(payload);
  };

  socket.onerror = (event) => {
    console.error("[WS] Error", event);
  };

  socket.onclose = (event) => {
    console.warn("[WS] Connection closed", event);
    resetActiveSocket(socket);
  };

  return socket;
};
