import { TextDecoder, TextEncoder } from "node:util";
import { streamCelldObservations, CelldStreamUnsupported, CelldStreamGap } from "../services/celld-stream";
import { onUnauthorized } from "../services/api-client";
jest.mock("../config/apiConfig", () => ({ getApiBaseUrl: () => "https://hyperhive.test/api" }));
const query = { from: 1000, to: 10000, source: "otlp", text: "a & b" };
let originalFetch, originalDecoder;
beforeEach(() => { originalFetch = global.fetch; originalDecoder = global.TextDecoder; global.fetch = jest.fn(); global.TextDecoder = TextDecoder; });
afterEach(() => { global.fetch = originalFetch; global.TextDecoder = originalDecoder; });
function mockStream(text) {
  const bytes = new TextEncoder().encode(text);
  // One-byte chunks deliberately split multi-byte UTF-8 characters and CRLF.
  const chunks = Array.from(bytes, byte => new Uint8Array([byte]));
  const reader = {
    read: jest.fn(async () => chunks.length ? { value: chunks.shift(), done: false } : { done: true }),
    cancel: jest.fn(async () => {}), releaseLock: jest.fn(),
  };
  fetch.mockResolvedValue({ ok: true, status: 200, headers: { get: () => "text/event-stream" }, body: { getReader: () => reader } });
  return reader;
}
it("decodes fragmented UTF-8, keeps credentials in headers and checkpoints only complete replay", async () => {
  const row = { id: "a", received_ms: 19000, record: { body: "olá\nsecond line" } };
  const page = { records: [row], from: 1000, to: 20000 };
  const reader = mockStream(': comment\r\n\r\nevent: ready\r\ndata: {}\r\n\r\nevent: history\r\ndata: ' + JSON.stringify(page) + '\r\n\r\nevent: caught_up\ndata: {"received_ms":20000,"from":1000,"to":20000}\n\nevent: observations\ndata: ' + JSON.stringify(page) + '\n\n');
  const onPage = jest.fn(), onOpen = jest.fn();
  await expect(streamCelldObservations("private-token", "fleet/a", "logs", query, 10000, new AbortController().signal, onPage, onOpen)).rejects.toThrow("closed");
  const [url, options] = fetch.mock.calls[0];
  expect(url).not.toContain("private-token");
  expect(url).toContain("fleet%2Fa/logs/stream");
  expect(new URL(url).searchParams.get("source")).toBe("otlp");
  expect(options.headers.Authorization).toBe("Bearer private-token");
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onPage.mock.calls[0]).toEqual([page]);
  expect(onPage.mock.calls[1][1]).toBe(20000);
  expect(onPage.mock.calls[2]).toEqual([page, 19000]);
  expect(reader.cancel).toHaveBeenCalled();
  expect(reader.releaseLock).toHaveBeenCalled();
});
it("rejects malformed stream records, reports replay gaps and cancels the reader", async () => {
  let reader = mockStream('event: observations\ndata: {"records":[null],"from":1,"to":2}\n\n');
  await expect(streamCelldObservations("t", "f", "logs", query, 1, new AbortController().signal, jest.fn(), jest.fn())).rejects.toThrow("invalid observation");
  expect(reader.cancel).toHaveBeenCalled();
  reader = mockStream('event: gap\ndata: {"error":"Replay exceeded"}\n\n');
  await expect(streamCelldObservations("t", "f", "logs", query, 1, new AbortController().signal, jest.fn(), jest.fn())).rejects.toBeInstanceOf(CelldStreamGap);
});
it("expires authentication and treats old endpoints as an explicit polling fallback", async () => {
  const expired = jest.fn(), cancel = onUnauthorized(expired);
  fetch.mockResolvedValueOnce({ ok: false, status: 401 });
  await expect(streamCelldObservations("t", "f", "events", query, 1, new AbortController().signal, jest.fn(), jest.fn())).rejects.toThrow("Session expired");
  expect(expired).toHaveBeenCalledTimes(1); cancel();
  fetch.mockResolvedValueOnce({ ok: false, status: 404 });
  await expect(streamCelldObservations("t", "f", "logs", query, 1, new AbortController().signal, jest.fn(), jest.fn())).rejects.toBeInstanceOf(CelldStreamUnsupported);
});
it("passes cancellation through to the fetch request", async () => {
  const controller = new AbortController();
  fetch.mockImplementation((url, options) => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
  const request = streamCelldObservations("t", "f", "logs", query, 1, controller.signal, jest.fn(), jest.fn());
  controller.abort();
  await expect(request).rejects.toThrow("aborted");
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
