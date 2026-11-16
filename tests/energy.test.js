import { energyLine, formatCost, formatKWh, formatWatts } from "../services/energy";

describe("energy formatters", () => {
  it("formats live watts with a tilde and rounds", () => {
    expect(formatWatts(180)).toBe("~180 W");
    expect(formatWatts(180.4)).toBe("~180 W");
    expect(formatWatts(179.6)).toBe("~180 W");
    expect(formatWatts(0)).toBe("~0 W");
  });

  it("formats kWh with one decimal below 10 and whole numbers above", () => {
    expect(formatKWh(4.24)).toBe("4.2 kWh");
    expect(formatKWh(9.94)).toBe("9.9 kWh");
    expect(formatKWh(0)).toBe("0.0 kWh");
    expect(formatKWh(10)).toBe("10 kWh");
    expect(formatKWh(42.4)).toBe("42 kWh");
    expect(formatKWh(42.6)).toBe("43 kWh");
  });

  it("formats costs as euros with two decimals", () => {
    expect(formatCost(8.82)).toBe("€8.82");
    expect(formatCost(0)).toBe("€0.00");
    expect(formatCost(12.5)).toBe("€12.50");
  });
});

describe("energyLine", () => {
  const row = { liveWatts: 180, monthKWh: 42, monthCost: 8.82 };

  it("includes the cost segment when a price is set", () => {
    expect(energyLine(row, 0.25)).toBe("~180 W · 42 kWh · €8.82");
  });

  it("omits the cost segment when the price is null", () => {
    expect(energyLine(row, null)).toBe("~180 W · 42 kWh");
  });
});

describe("timeline helpers", () => {
  const { stripSegments, wattPoints } = require("../services/energy");
  const series = { kind: "vm", name: "vm1", machine: "", wh: [10, 30, null, null, 0, 5], runningS: [3600, 3600, null, null, 0, 600] };
  const timeline = { start: 3600, stepSeconds: 1800, count: 6, series: [series] };

  it("marks segments running, stopped or without data", () => {
    expect(stripSegments(series, 3)).toEqual(["running", "none", "running"]);
    expect(stripSegments({ ...series, runningS: [0, null] }, 96)).toEqual(["stopped", "none"]);
  });

  it("averages watts per group, keeps gaps and drops the filling bucket", () => {
    const points = wattPoints(timeline, series, 3);
    // 5 finished buckets in groups of 2; 10 Wh in half an hour is 20 W.
    expect(points.map((p) => p.y)).toEqual([40, null, 0]);
    expect(points[1].x.getTime()).toBe((3600 + 2 * 1800) * 1000);
  });
});
