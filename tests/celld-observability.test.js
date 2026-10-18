import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { getCelldObservability, getCelldObservations, getCelldMetrics, downloadCelldLogs } from "../services/celld";
import { useCelldObservations } from "../hooks/useCelldObservations";
import { mergeObservations, bytes, duration, numberValue } from "../components/celld/observability";
import * as liveStreams from "../services/celld-stream";
import { onUnauthorized } from "../services/api-client";
jest.mock("../config/apiConfig", () => ({ getApiBaseUrl: () => "https://hyperhive.test/api" }));
const reply = (value, status = 200, type = "application/json") => ({ ok: status === 200, status, headers: { get: () => type }, json: async () => value, text: async () => typeof value === "string" ? value : JSON.stringify(value) });
const query = { from: 1000, to: 10000, severity: "ERROR", text: "a & b", limit: 100 };
const row = (id, time_ms = 2000) => ({ id, record: { time_ms, kind: "log", body: id } });
const page = (records = [], extra = {}) => ({ records, from: 1000, to: 10000, incomplete: true, ...extra });
let original;
beforeEach(() => { jest.spyOn(liveStreams, "streamCelldObservations").mockRejectedValue(new liveStreams.CelldStreamUnsupported("compatibility test")); original = global.fetch; global.fetch = jest.fn(); jest.spyOn(console, "info").mockImplementation(() => {}); jest.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { global.fetch = original; jest.restoreAllMocks(); jest.useRealTimers(); });
it("preserves absent metrics, explicit zero and exact units", () => {
  expect(bytes(undefined)).toBe("Unavailable"); expect(numberValue(0)).toBe("0"); expect(duration(8000)).toBe("8 ms"); expect(bytes(1048576)).toBe("1 MiB");
});
it("deduplicates by opaque ID, orders and bounds the buffer", () => {
  expect(mergeObservations([row("b", 3), row("a", 1)], [row("b", 4), row("c", 2)], 2)).toEqual([row("c", 2), row("b", 4)]);
});
it("reads partial 200 overviews and optional fields without inventing resource values", async () => {
  const overview = { fleet_id: "x", historical: true, nodes: [{ node_id: "n", state: "offline", collected_ms: 1 }], incomplete: true, error: "Partial report" };
  fetch.mockResolvedValue(reply(overview)); expect(await getCelldObservability("token", "x/y")).toEqual(overview);
  expect(fetch.mock.calls[0][0]).toContain("/x%2Fy/observability");
});
it("encodes filters and preserves fixed interval and opaque cursor", async () => {
  fetch.mockResolvedValue(reply(page())); await getCelldObservations("token", "fleet", "logs", { ...query, cursor: "opaque /+" });
  const url = new URL(fetch.mock.calls[0][0]); expect(url.searchParams.get("cursor")).toBe("opaque /+"); expect(url.searchParams.get("severity")).toBe("ERROR"); expect(url.searchParams.get("text")).toBe("a & b"); expect(url.searchParams.get("to")).toBe("10000");
});
it("validates trace IDs and retains event interval for traces", async () => {
  await expect(getCelldObservations("t", "f", "trace", query, undefined, "bad")).rejects.toThrow("32 lowercase"); expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue(reply(page())); await getCelldObservations("t", "f", "trace", query, undefined, "a".repeat(32)); expect(fetch.mock.calls[0][0]).toContain("/traces/" + "a".repeat(32));
});
it("parses metric samples and summary and rejects malformed pages", async () => {
  fetch.mockResolvedValueOnce(reply({ samples: page([{ id: "s", snapshot: { resources: { cpu_percent_x100: 0 } } }]), requests: { observed: false } }));
  expect((await getCelldMetrics("t", "f", query)).requests.observed).toBe(false);
  fetch.mockResolvedValueOnce(reply({ records: [null], from: 1, to: 2 })); await expect(getCelldObservations("t", "f", "events", query)).rejects.toThrow("invalid observation");
});
it.each([400, 404, 503])("keeps HTTP %i errors readable", async (status) => {
  fetch.mockResolvedValue(reply({ error: "Unavailable history" }, status)); await expect(getCelldObservations("t", "f", "logs", query)).rejects.toThrow("Unavailable history");
});
it("handles a plain-text 401 with existing session expiry", async () => {
  const handler = jest.fn(), unsubscribe = onUnauthorized(handler); fetch.mockResolvedValue(reply("Session expired", 401, "text/plain"));
  await expect(getCelldObservations("t", "f", "logs", query)).rejects.toThrow("Session expired"); expect(handler).toHaveBeenCalledTimes(1); unsubscribe();
});
it("downloads bounded authenticated NDJSON without cursor", async () => {
  fetch.mockResolvedValue(reply('{"id":"one"}\n', 200, "application/x-ndjson"));
  expect(await downloadCelldLogs("token", "f", { ...query, cursor: "old" })).toContain('"one"');
  const [url, options] = fetch.mock.calls[0]; expect(new URL(url).searchParams.get("limit")).toBe("2000"); expect(new URL(url).searchParams.has("cursor")).toBe(false); expect(options.headers.Authorization).toBe("Bearer token");
});
function mountHook(props) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const div = document.createElement("div"), root = createRoot(div); let state;
  function Harness(p) { state = useCelldObservations("token", "f", p.kind ?? "logs", p.query, p.follow, p.trace); return null; }
  return { render: async (p = props) => { await act(async () => root.render(<Harness {...p} />)); }, state: () => state, close: async () => { await act(async () => root.unmount()); } };
}
it("drains a fixed cursor before advancing overlapping follow windows and deduplicates", async () => {
  jest.useFakeTimers(); jest.setSystemTime(50000);
  fetch.mockResolvedValueOnce(reply(page([row("one")], { next_cursor: "next" }))).mockResolvedValueOnce(reply(page([row("one"), row("two", 3000)]))).mockResolvedValueOnce(reply(page([row("two", 3000), row("three", 4000)], { from: 1000, to: 54000 })));
  const hook = mountHook({ query, follow: true }); await hook.render();
  await act(async () => jest.advanceTimersByTime(2000));
  const second = new URL(fetch.mock.calls[1][0]); expect(second.searchParams.get("cursor")).toBe("next"); expect(second.searchParams.get("to")).toBe("10000");
  await act(async () => jest.advanceTimersByTime(2000));
  const third = new URL(fetch.mock.calls[2][0]); expect(third.searchParams.has("cursor")).toBe(false); expect(third.searchParams.get("to")).toBe("54000"); expect(hook.state().page.records.map((r) => r.id)).toEqual(["one", "two", "three"]); await hook.close();
});
it("does not overlap slow requests, aborts on close and suppresses late results", async () => {
  jest.useFakeTimers(); let resolve; fetch.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const hook = mountHook({ query, follow: true }); await hook.render();
  await act(async () => jest.advanceTimersByTime(6000)); expect(fetch).toHaveBeenCalledTimes(1);
  const signal = fetch.mock.calls[0][1].signal; await hook.close(); expect(signal.aborted).toBe(true); await act(async () => resolve(reply(page([row("late")]))));
  await act(async () => jest.advanceTimersByTime(6000)); expect(fetch).toHaveBeenCalledTimes(1);
});
it("clears cursor after filter changes and retains last page on follow errors", async () => {
  jest.useFakeTimers(); fetch.mockResolvedValueOnce(reply(page([row("one")], { next_cursor: "old" }))).mockResolvedValueOnce(reply({ error: "Offline" }, 503)).mockResolvedValueOnce(reply(page([row("new")])));
  const hook = mountHook({ query, follow: true }); await hook.render(); await act(async () => jest.advanceTimersByTime(2000)); expect(hook.state().page.records[0].id).toBe("one"); expect(hook.state().error).toBe("Offline");
  await hook.render({ query: { ...query, severity: "INFO" }, follow: false }); expect(new URL(fetch.mock.calls[2][0]).searchParams.has("cursor")).toBe(false); expect(hook.state().page.records.map((r) => r.id)).toEqual(["new"]); await hook.close();
});
it("pauses follow without clearing buffered observations or starting a request", async () => {
  jest.useFakeTimers(); fetch.mockResolvedValue(reply(page([row("one")])));
  const hook = mountHook({ query, follow: true }); await hook.render(); await hook.render({ query, follow: false });
  await act(async () => jest.advanceTimersByTime(6000)); expect(fetch).toHaveBeenCalledTimes(1); expect(hook.state().page.records[0].id).toBe("one"); await hook.close();
});
it("manual continuation keeps all filters and follows only the returned cursor", async () => {
  fetch.mockResolvedValueOnce(reply(page([row("one")], { next_cursor: "opaque" }))).mockResolvedValueOnce(reply(page([row("two", 3000)])));
  const hook = mountHook({ query, follow: false }); await hook.render(); await act(async () => hook.state().more());
  const next = new URL(fetch.mock.calls[1][0]); for (const [key, value] of Object.entries(query)) expect(next.searchParams.get(key)).toBe(String(value));
  expect(next.searchParams.get("cursor")).toBe("opaque"); expect(hook.state().page.records).toHaveLength(2); await hook.close();
});
it("normalizes absent node arrays and rejects malformed nested observation data", async () => {
  fetch.mockResolvedValueOnce(reply({ fleet_id: "f", nodes: null })); expect((await getCelldObservability("t", "f")).nodes).toEqual([]);
  fetch.mockResolvedValueOnce(reply({ fleet_id: "f", nodes: [{ workloads: "bad" }] })); await expect(getCelldObservability("t", "f")).rejects.toThrow("invalid observability");
  fetch.mockResolvedValueOnce(reply({ samples: page(), requests: { count: "bad" } })); await expect(getCelldMetrics("t", "f", query)).rejects.toThrow("invalid metrics");
});

it("does not request a trace until a valid ID is applied", async () => {
  const hook = mountHook({ query, follow: false, kind: "trace", trace: "" }); await hook.render();
  expect(fetch).not.toHaveBeenCalled(); expect(hook.state().busy).toBe(false);
  fetch.mockResolvedValue(reply(page([row("span")])));
  await hook.render({ query, follow: false, kind: "trace", trace: "a".repeat(32) });
  expect(fetch).toHaveBeenCalledTimes(1); await hook.close();
});
it("reload retains observations on failure and replaces them only after success", async () => {
  fetch.mockResolvedValueOnce(reply(page([row("old")], { next_cursor: "cursor" }))).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(reply(page([row("fresh")])));
  const hook = mountHook({ query, follow: false }); await hook.render();
  await act(async () => hook.state().reload());
  expect(hook.state().page.records[0].id).toBe("old"); expect(hook.state().error).toBe("Offline");
  await act(async () => hook.state().reload());
  expect(hook.state().page.records.map(row => row.id)).toEqual(["fresh"]);
  expect(new URL(fetch.mock.calls[2][0]).searchParams.has("cursor")).toBe(false); await hook.close();
});
it("formats large memory and small nonzero rates without hiding their values", () => {
  expect(bytes(1073741824)).toBe("1 GiB"); expect(numberValue(0.00012)).toBe("0.00012");
  expect(bytes(NaN)).toBe("Unavailable"); expect(numberValue(Infinity)).toBe("Unavailable");
});
it("waits for a selected future end time before advancing live follow", async () => {
  jest.useFakeTimers(); jest.setSystemTime(50000);
  const futureQuery = { ...query, to: 80000 };
  fetch.mockResolvedValue(reply(page([row("one")], { to: 80000 })));
  const hook = mountHook({ query: futureQuery, follow: true }); await hook.render();
  await act(async () => jest.advanceTimersByTime(2000));
  expect(fetch).toHaveBeenCalledTimes(1); expect(hook.state().busy).toBe(false); await hook.close();
});


it("uses one live connection instead of interval reads, resumes from a safe checkpoint and cancels on pause", async () => {
  jest.useFakeTimers(); jest.setSystemTime(50000);
  fetch.mockResolvedValue(reply(page([row("history")])));
  let deliver, connected, rejectStream, streamSignal;
  liveStreams.streamCelldObservations.mockImplementation((token, fleet, kind, filters, since, signal, onPage, onOpen) => {
    deliver = onPage; connected = onOpen; streamSignal = signal;
    return new Promise((resolve, reject) => { rejectStream = reject; });
  });
  const hook = mountHook({ query, follow: true }); await hook.render();
  await act(async () => { connected(); deliver(page([{ ...row("new"), received_ms: 49000 }], { to: 50000 }), 49000); });
  expect(hook.state().transport).toBe("streaming");
  await act(async () => jest.advanceTimersByTime(6000));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(hook.state().page.records.map(r => r.id)).toEqual(["history", "new"]);
  await act(async () => rejectStream(new Error("disconnect")));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(liveStreams.streamCelldObservations.mock.calls.at(-1)[4]).toBe(49000);
  await hook.render({ query, follow: false });
  expect(streamSignal.aborted).toBe(true);
  await act(async () => deliver(page([row("late")])));
  expect(hook.state().page.records.map(r => r.id)).not.toContain("late");
  await hook.close();
});

it("does not advance reconnect checkpoints while replay is incomplete", async () => {
  jest.useFakeTimers(); jest.setSystemTime(50000);
  fetch.mockResolvedValue(reply(page()));
  let deliver;
  liveStreams.streamCelldObservations.mockImplementation((...args) => { deliver = args[6]; return new Promise(() => {}); });
  const hook = mountHook({ query, follow: true }); await hook.render();
  await act(async () => deliver(page([{ ...row("replay"), received_ms: 90000 }])));
  await hook.render({ query, follow: false });
  await hook.render({ query, follow: true });
  expect(liveStreams.streamCelldObservations.mock.calls.at(-1)[4]).toBe(query.to);
  await hook.close();
});
