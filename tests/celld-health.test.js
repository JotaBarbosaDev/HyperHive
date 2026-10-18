/** @jest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fetchCelldHealth } from "../services/celld";
import { useCelldHealth } from "../hooks/useCelldHealth";
import { onApiResult, onUnauthorized } from "../services/api-client";
jest.mock("../config/apiConfig", () => ({ getApiBaseUrl: () => "https://hyperhive.test/api" }));
const health = {
    healthy: false,
    storage: { healthy: true },
    machines: [
        { name: "master", ip: "192.168.76.1", connected: true, healthy: true },
        { name: "slave-a", ip: "192.168.76.55", connected: false, healthy: false, error: "no live reachable celld peer" },
    ],
};
const response = (status = 200, data = health) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "test response",
    headers: { get: () => "application/json" },
    json: async () => data,
    text: async () => JSON.stringify(data),
});
const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    jest.spyOn(console, "error").mockImplementation(() => { });
    jest.spyOn(console, "info").mockImplementation(() => { });
});
afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
});
describe("celld health API", () => {
    it.each([200, 503])("reads the health JSON for HTTP %s, including offline machines", async (status) => {
        fetchMock.mockResolvedValue(response(status));
        const report = jest.fn();
        const unsubscribe = onApiResult(report);
        try {
            await expect(fetchCelldHealth("session-token")).resolves.toEqual(health);
            expect(fetchMock).toHaveBeenCalledWith("https://hyperhive.test/api/celld/health", expect.objectContaining({
                headers: { Accept: "application/json", Authorization: "Bearer session-token" },
            }));
            expect(report).not.toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
        }
        finally {
            unsubscribe();
        }
    });
    it("does not duplicate the Bearer prefix", async () => {
        fetchMock.mockResolvedValue(response());
        await fetchCelldHealth("Bearer session-token");
        expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
        }));
    });
    it.each([200, 503])("rejects a malformed health payload from HTTP %s", async (status) => {
        fetchMock.mockResolvedValue(response(status, { message: "unavailable" }));
        await expect(fetchCelldHealth("token")).rejects.toThrow("invalid health response");
    });
    it("preserves storage errors and an empty machine list during startup", async () => {
        const starting = { healthy: false, storage: { healthy: false, error: "SILO starting" }, machines: [] };
        fetchMock.mockResolvedValue(response(503, starting));
        await expect(fetchCelldHealth("token")).resolves.toEqual(starting);
    });
    it("keeps unauthorized handling for HTTP 401", async () => {
        const unauthorized = jest.fn();
        const unsubscribe = onUnauthorized(unauthorized);
        fetchMock.mockResolvedValue(response(401, { error: "unauthorized" }));
        try {
            await expect(fetchCelldHealth("token")).rejects.toMatchObject({ status: 401 });
            expect(unauthorized).toHaveBeenCalledTimes(1);
        }
        finally {
            unsubscribe();
        }
    });
    it("rejects transport failures separately from fleet health", async () => {
        fetchMock.mockRejectedValue(new Error("Network unavailable"));
        await expect(fetchCelldHealth("token")).rejects.toThrow("Network unavailable");
    });
});
describe("celld polling", () => {
    let root;
    let latest;
    let container;
    function Harness() {
        latest = useCelldHealth("token", false);
        return null;
    }
    beforeEach(() => {
        jest.useFakeTimers();
        Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
        container = document.createElement("div");
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        jest.useRealTimers();
    });
    const mount = async () => {
        await act(async () => root.render(React.createElement(Harness)));
    };
    it("loads immediately and refreshes every 30 seconds", async () => {
        fetchMock.mockResolvedValue(response(503));
        await mount();
        expect(latest.health).toEqual(health);
        expect(latest.error).toBeNull();
        expect(latest.isLoading).toBe(false);
        await act(async () => jest.advanceTimersByTime(29999));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await act(async () => jest.advanceTimersByTime(1));
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it("blocks overlapping manual and automatic refresh requests", async () => {
        let finish;
        fetchMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        await mount();
        expect(latest.isLoading).toBe(true);
        await act(async () => {
            latest.refresh();
            latest.refresh();
            jest.advanceTimersByTime(30000);
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await act(async () => finish(response()));
        expect(latest.isRefreshing).toBe(false);
    });
    it("keeps the last health report on network error and clears the error after recovery", async () => {
        fetchMock.mockResolvedValue(response());
        await mount();
        const updatedAt = latest.updatedAt;
        fetchMock.mockRejectedValueOnce(new Error("Connection lost"));
        await act(async () => latest.refresh());
        expect(latest.health).toEqual(health);
        expect(latest.updatedAt).toBe(updatedAt);
        expect(latest.error).toBe("Connection lost");
        await act(async () => latest.refresh());
        expect(latest.error).toBeNull();
    });
    it("aborts requests and stops polling when the page unmounts", async () => {
        fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }));
        await mount();
        const signal = fetchMock.mock.calls[0][1]?.signal;
        await act(async () => root.unmount());
        expect(signal?.aborted).toBe(true);
        await act(async () => jest.advanceTimersByTime(60000));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        root = createRoot(container);
    });
});
