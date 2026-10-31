import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { validatePowerSchedule } from "../services/power-schedule";
import { setAuthToken } from "../services/api-client";
import { setApiBaseUrl } from "../config/apiConfig";
import PowerScheduleCard from "../components/PowerScheduleCard";

jest.mock("../components/ui/box", () => ({ Box: ({ children }) => <div>{children}</div> }));
jest.mock("../components/ui/text", () => ({ Text: ({ children }) => <span>{children}</span> }));
jest.mock("../components/ui/heading", () => ({ Heading: ({ children }) => <h2>{children}</h2> }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, onPress, isDisabled }) => <button disabled={isDisabled} onClick={onPress}>{children}</button>, ButtonText: ({ children }) => children }));
jest.mock("../components/ui/input", () => ({ Input: ({ children }) => <div>{children}</div>, InputField: ({ value, onChangeText, accessibilityLabel }) => <input aria-label={accessibilityLabel} value={value} onChange={(e) => onChangeText(e.target.value)} /> }));
jest.mock("../components/ui/switch", () => ({ Switch: ({ value, onValueChange, accessibilityLabel }) => <input type="checkbox" aria-label={accessibilityLabel} checked={value} onChange={(e) => onValueChange(e.target.checked)} /> }));

const json = (body, status = 200) => ({ ok: true, status, headers: { get: () => "application/json" }, json: async () => body });

const view = (schedule, hosts = []) => ({ schedule: { tz: "Europe/Lisbon", updatedAt: "", ...schedule }, masterTz: "Europe/Lisbon", masterTime: "2026-10-31T12:00:00Z", hosts });

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  setAuthToken("session-one");
  setApiBaseUrl("https://hyperhive.test/api");
});

const setValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("validatePowerSchedule", () => {
  it("matches backend validation", () => {
    expect(validatePowerSchedule("08:00", "23:00")).toBeNull();
    expect(validatePowerSchedule("08:00", "01:00")).toBeNull();
    expect(validatePowerSchedule("08:00", "08:00")).toMatch(/differ/);
    expect(validatePowerSchedule("08:05", "08:00")).toMatch(/10 minutes/);
    expect(validatePowerSchedule("8:00", "23:00")).toMatch(/HH:MM/);
    expect(validatePowerSchedule("24:00", "23:00")).toMatch(/HH:MM/);
  });
});

describe("PowerScheduleCard", () => {
  it("waits for the session before calling the API", async () => {
    global.fetch = jest.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<PowerScheduleCard token={null} />); });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("not configured");
    act(() => root.unmount());
  });


  it("says it is cluster-wide, shows host status and saves", async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      calls.push([init.method || "GET", String(url), init.body]);
      if (init.method === "PUT") return json({ status: "applying", schedule: {} }, 202);
      return json(view({ enabled: false, start: "08:00", stop: "23:00" }, [
        { machine: "slave-a", connected: true, enabled: false, stopUnix: 0, wakeUnix: 0, jobId: "", appliedAt: "", lastError: "atd down", attemptedAt: "2026-10-31T10:00:00Z" },
      ]));
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<PowerScheduleCard token="session-one" />); });

    expect(container.textContent).toContain("Power schedule (all machines)");
    expect(container.textContent).toContain("applies to every machine in the cluster");
    expect(container.textContent).toContain("Power On By RTC");
    expect(container.textContent).toContain("Last attempt failed: atd down");

    const save = [...container.querySelectorAll("button")].find((b) => b.textContent.includes("Save"));
    expect(save.disabled).toBe(true);

    await act(async () => {
      container.querySelector('[aria-label="Enable cluster power schedule"]').click();
      setValue(container.querySelector('[aria-label="Power schedule stop time"]'), "01:00");
    });
    expect(save.disabled).toBe(false);
    await act(async () => { save.click(); });

    const put = calls.find(([method]) => method === "PUT");
    expect(put[1]).toBe("https://hyperhive.test/api/power-schedule");
    expect(JSON.parse(put[2])).toEqual({ enabled: true, start: "08:00", stop: "01:00" });
    act(() => root.unmount());
  });
});
