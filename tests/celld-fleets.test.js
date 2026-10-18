/** @jest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fetchCelldFleets, getCelldCredentials, getCelldFleet, runCelldAction, saveCelldFleet } from "../services/celld";
import { useCelldFleets } from "../hooks/useCelldFleets";
import { onUnauthorized } from "../services/api-client";
import { parseFleetPorts } from "../components/celld/ports";
jest.mock("../config/apiConfig", () => ({ getApiBaseUrl: () => "https://hyperhive.test/api" }));

const fleet = {
  id: "f1", name: "app", desired_state: "running", status: "running",
  servers: [{ name: "one", connected: true, running: true, healthy: true }],
  ports: { http: 18080, internal: 18081 },
  storage: { bucket: "hyperhive-celld-f1", endpoint: "http://127.0.0.1:9000", region: "us-east-1" },
  urls: ["http://127.0.0.2:18080"],
  deploy: { command: "celld deploy . --bucket s3://hyperhive-celld-f1", credentials_url: "/celld/fleets/f1/credentials", environment: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] },
  checked_at: "2026-10-18T12:00:00Z",
};
const list = {
  fleets: [fleet], reset_pending: false,
  storage: { healthy: true, bucket_count: 2, buckets: ["hyperhive-celld-f1", "unrelated"], managed_bucket_count: 1, checked_at: "2026-10-18T12:00:00Z" },
};
const response = (value = list, status = 200) => ({
  ok: status >= 200 && status < 300, status, statusText: "fixture",
  headers: { get: () => "application/json" }, json: async () => value, text: async () => JSON.stringify(value),
});
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

describe("fleet port selection", () => {
  it.each([
    ["", "", undefined],
    ["8080", "", { http: 8080, internal: 8081 }],
    ["8080", "9090", { http: 8080, internal: 9090 }],
    [" 8080 ", " 8081 ", { http: 8080, internal: 8081 }],
    ["65535", "1", { http: 65535, internal: 1 }],
  ])("parses HTTP %s and internal %s", (http, internal, expected) => {
    expect(parseFleetPorts(http, internal)).toEqual(expected);
  });
  it.each([["8080", "8080"], ["0", ""], ["65535", ""], ["8080.5", ""], ["", "8081"], ["8080", "65536"]])("rejects invalid pair %s / %s", (http, internal) => {
    expect(() => parseFleetPorts(http, internal)).toThrow(/port/i);
  });
});
beforeEach(() => {
  fetchMock.mockReset(); globalThis.fetch = fetchMock;
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks(); });

describe("celld fleet contracts", () => {
  it("keeps actual and managed bucket counts distinct and offline IPs optional", async () => {
    fetchMock.mockResolvedValue(response());
    await expect(fetchCelldFleets("token")).resolves.toEqual(list);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
  });
  it("preserves unknown storage counts and reset progress instead of showing zero", async () => {
    const unavailable = { ...list, reset_pending: true, error: "Waiting for old agent", storage: { ...list.storage, healthy: false, bucket_count: null, buckets: null, error: "SILO offline" } };
    fetchMock.mockResolvedValue(response(unavailable));
    await expect(fetchCelldFleets("token")).resolves.toEqual(unavailable);
  });
  it.each([{ fleets: null }, { ...list, storage: {} }, { ...list, fleets: [{ ...fleet, status: "invented" }] }])("rejects malformed fleet reports", async (value) => {
    fetchMock.mockResolvedValue(response(value));
    await expect(fetchCelldFleets("token")).rejects.toThrow(/invalid fleet/);
  });
  it("explains an older API and preserves unauthorized handling", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "missing" }, 404));
    await expect(fetchCelldFleets("token")).rejects.toThrow("Update the master");
    const handler = jest.fn(); const unsubscribe = onUnauthorized(handler);
    try {
      fetchMock.mockResolvedValueOnce(response({ error: "expired" }, 401));
      await expect(fetchCelldFleets("token")).rejects.toMatchObject({ status: 401, message: "expired" });
      expect(handler).toHaveBeenCalledTimes(1);
    } finally { unsubscribe(); }
  });
  it("uses POST/PATCH and accepts durable 202 progress", async () => {
    const accepted = { ...fleet, status: "provisioning" };
    fetchMock.mockResolvedValue(response(accepted, 202));
    const input = { name: "app", servers: ["one", "two"], ports: fleet.ports };
    await expect(saveCelldFleet("token", input)).resolves.toEqual(accepted);
    await saveCelldFleet("token", input, fleet.id);
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method, JSON.parse(options.body)])).toEqual([
      ["https://hyperhive.test/api/celld/fleets", "POST", input],
      ["https://hyperhive.test/api/celld/fleets/f1", "PATCH", input],
    ]);
  });
  it.each(["start", "stop", "restart", "delete"])("sends the %s action to its correct endpoint", async (action) => {
    fetchMock.mockResolvedValue(response(fleet, 202));
    await runCelldAction("token", "f1", action);
    expect(fetchMock).toHaveBeenCalledWith("https://hyperhive.test/api/celld/fleets/f1" + (action === "delete" ? "" : "/" + action), expect.objectContaining({ method: action === "delete" ? "DELETE" : "POST" }));
  });
  it("keeps conflicts available to the form without retrying mutations", async () => {
    fetchMock.mockResolvedValue(response({ error: "Ports are reserved" }, 409));
    await expect(saveCelldFleet("token", { name: "x", servers: ["one"] })).rejects.toMatchObject({ status: 409, message: "Ports are reserved" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });
  it("keeps unexpected server errors in the console", async () => {
    fetchMock.mockResolvedValue(response({ error: "Storage unavailable" }, 503));
    await expect(saveCelldFleet("token", { name: "x", servers: ["one"] })).rejects.toMatchObject({ status: 503 });
    expect(console.error).toHaveBeenCalled();
  });
  it("fetches scoped credentials only explicitly and never logs their values", async () => {
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(fleet));
    await fetchCelldFleets("token"); await getCelldFleet("token", fleet.id);
    expect(fetchMock.mock.calls.some(([path]) => path.includes("credentials"))).toBe(false);
    const keys = { aws_access_key_id: "fixture-access", aws_secret_access_key: "fixture-secret" };
    fetchMock.mockResolvedValueOnce(response(keys));
    await expect(getCelldCredentials("Bearer token", fleet.id)).resolves.toEqual(keys);
    expect(JSON.stringify(console.info.mock.calls)).not.toContain("fixture-secret");
    expect(fetchMock.mock.calls[2][0]).toBe("https://hyperhive.test/api/celld/fleets/f1/credentials");
  });
});

describe("fleet polling after mutations", () => {
  let root, latest, container;
  function Harness() { latest = useCelldFleets("token", false); return null; }
  beforeEach(() => {
    jest.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
  it("aborts a pre-mutation read and ignores its late stale response", async () => {
    fetchMock.mockResolvedValueOnce(response());
    await act(async () => root.render(React.createElement(Harness)));
    let finishOld;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    await act(async () => { void latest.refresh(); });
    const oldSignal = fetchMock.mock.calls[1][1].signal;
    const stopped = { ...list, fleets: [{ ...fleet, desired_state: "stopped", status: "provisioning" }] };
    fetchMock.mockResolvedValueOnce(response(stopped));
    await act(async () => latest.refresh(true));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finishOld(response()));
    expect(latest.data).toEqual(stopped);
  });
  it("times out, retains the last observation and recovers on refresh", async () => {
    fetchMock.mockResolvedValueOnce(response());
    await act(async () => root.render(React.createElement(Harness)));
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    await act(async () => { void latest.refresh(); });
    await act(async () => jest.advanceTimersByTime(20000));
    expect(latest.error).toContain("timed out"); expect(latest.data).toEqual(list);
    fetchMock.mockResolvedValueOnce(response());
    await act(async () => latest.refresh());
    expect(latest.error).toBeNull();
  });
});
