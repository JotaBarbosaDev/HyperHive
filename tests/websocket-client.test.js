import { setApiBaseUrl } from "../config/apiConfig";
import { setAuthToken } from "../services/api-client";
import {
  disconnectHyperHiveWebsocket,
  ensureHyperHiveWebsocket,
  getActiveHyperHiveWebsocket,
  subscribeToHyperHiveWebsocket,
} from "../services/websocket-client";

const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  setAuthToken(null);
  setApiBaseUrl(null);
  globalThis.WebSocket = Object.assign(jest.fn(function (url) {
    this.url = url;
    this.readyState = 0;
    this.close = jest.fn();
  }), { CONNECTING: 0, OPEN: 1 });
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  disconnectHyperHiveWebsocket();
  globalThis.WebSocket = originalWebSocket;
  jest.restoreAllMocks();
});

it.each([
  [null, null],
  ["test-token", null],
  [null, "https://example.test/api"],
])("defers connection until both session values are ready (%s, %s)", async (token, baseUrl) => {
  setAuthToken(token);
  setApiBaseUrl(baseUrl);
  await expect(ensureHyperHiveWebsocket()).resolves.toBeNull();
  expect(globalThis.WebSocket).not.toHaveBeenCalled();
  expect(getActiveHyperHiveWebsocket()).toBeNull();
});

it("delivers messages to early subscribers after session restoration", async () => {
  const listener = jest.fn();
  const unsubscribe = subscribeToHyperHiveWebsocket(listener);
  try {
    await ensureHyperHiveWebsocket();
    setAuthToken("test-token");
    setApiBaseUrl("https://example.test/api");
    const socket = await ensureHyperHiveWebsocket();
    expect(socket.url).toBe("wss://example.test/api/ws?token=test-token");
    socket.onmessage({ data: "vm progress" });
    expect(listener).toHaveBeenCalledWith("vm progress");
    unsubscribe();
    socket.onmessage({ data: "later progress" });
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
  }
});

it("reuses a connecting socket for concurrent startup calls", async () => {
  setAuthToken("test-token");
  setApiBaseUrl("https://example.test");
  const [first, second] = await Promise.all([
    ensureHyperHiveWebsocket(), ensureHyperHiveWebsocket(),
  ]);
  expect(first).toBe(second);
  expect(globalThis.WebSocket).toHaveBeenCalledTimes(1);
});

it("still reports genuine connection setup failures", async () => {
  globalThis.WebSocket.mockImplementation(() => { throw new Error("Socket setup failed"); });
  await expect(ensureHyperHiveWebsocket({
    token: "test-token", baseUrl: "https://example.test",
  })).rejects.toThrow("Socket setup failed");
  expect(getActiveHyperHiveWebsocket()).toBeNull();
});
