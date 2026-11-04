jest.mock("../services/vms-client", () => ({ resolveToken: jest.fn(async () => "token") }));
jest.mock("../services/api-client", () => ({ apiFetch: jest.fn() }));
import { normalizeDiskHealthHistory, normalizeDiskHealthList } from "../services/diskhealth";
import {
  bandBadgeAction,
  bandBadgeLabel,
  bandTextColor,
  changeText,
  chartTickText,
  counterRows,
  counterSeries,
  diskHealthSummary,
  lastPollText,
  pickDiskHealth,
  powerOnText,
  seriesStats,
  temperatureDomain,
  temperatureSeries,
  wearProjection,
} from "../utils/diskhealth";

const disk = (over = {}) => ({
  serial: "S1",
  smartAvailable: true,
  score: 85,
  band: "good",
  reasons: ["No problems found"],
  rotational: false,
  wearOutAt: null,
  pastRatedEndurance: false,
  ...over,
});

test("maps bands to badge actions and labels", () => {
  expect(bandBadgeAction(disk())).toBe("success");
  expect(bandBadgeAction(disk({ band: "watch", score: 70 }))).toBe("info");
  expect(bandBadgeAction(disk({ band: "at_risk", score: 40 }))).toBe("warning");
  expect(bandBadgeAction(disk({ band: "critical", score: 10 }))).toBe("error");
  expect(bandBadgeLabel(disk({ band: "at_risk", score: 40 }))).toBe("At risk · 40");
  for (const missing of [undefined, null, disk({ smartAvailable: false, score: null, band: "" }), disk({ score: null })]) {
    expect(bandBadgeAction(missing)).toBe("muted");
    expect(bandBadgeLabel(missing)).toBe("No SMART data");
  }
});

test("normalizes list and history payloads defensively", () => {
  const list = normalizeDiskHealthList({
    lastPollAt: "2026-11-03T12:00:00Z",
    disks: [
      { serial: "A", score: "70", band: "watch", smartAvailable: true, reasons: ["x", 3, ""], retiredAt: null, latest: { pendingSectors: "2" } },
      { serial: "", band: "good" },
      { serial: "B", band: "bogus", score: null, smartAvailable: false },
    ],
  });
  expect(list.lastPollAt).toBe("2026-11-03T12:00:00Z");
  expect(list.disks.map((d) => d.serial)).toEqual(["A", "B"]);
  expect(list.disks[0]).toMatchObject({ score: 70, band: "watch", reasons: ["x"], retiredAt: null });
  expect(list.disks[0].latest.pendingSectors).toBe(2);
  expect(list.disks[1]).toMatchObject({ band: "", score: null, smartAvailable: false });
  expect(normalizeDiskHealthList(null)).toEqual({ lastPollAt: null, disks: [] });

  const history = normalizeDiskHealthHistory({
    disk: { serial: "A" },
    points: [{ at: "2026-08-01T00:00:00Z", resolution: "daily", score: 100 }, { at: "bad" }, { at: "2026-11-03T12:00:00Z", score: null }],
  });
  expect(history.points).toHaveLength(2);
  expect(history.points[0].resolution).toBe("daily");
  expect(history.points[1]).toMatchObject({ resolution: "6h", score: null });
});

test("summarizes the reason line and last poll", () => {
  const now = Date.parse("2026-11-03T12:00:00Z");
  expect(diskHealthSummary(disk({ reasons: ["3 pending sectors (+2 in 7 days)"] }), now)).toBe("3 pending sectors (+2 in 7 days)");
  expect(diskHealthSummary(disk({ wearOutAt: "2027-07-03T12:00:00Z", latest: { percentageUsed: 82 } }), now)).toBe("Wear 82%, ~8 months left (estimate)");
  expect(diskHealthSummary(disk({ rotational: true, wearOutAt: "2027-07-03T12:00:00Z" }), now)).toBe("No problems found");
  expect(diskHealthSummary(disk({ smartAvailable: false, score: null, band: "", reasons: ["SMART read failed: timeout"] }), now)).toBe("SMART read failed: timeout");
  expect(diskHealthSummary(undefined, now)).toBe("No SMART data");
  expect(lastPollText("2026-11-03T09:00:00Z", now)).toBe("Last health poll 3 h ago");
  expect(lastPollText("2026-11-03T11:30:00Z", now)).toBe("Last health poll under 1 h ago");
  expect(lastPollText(null, now)).toBe("No health poll yet");
});

test("picks rows by serial and builds chart series", () => {
  expect(pickDiskHealth([disk(), disk({ serial: "S2" })], " S2 ").serial).toBe("S2");
  expect(pickDiskHealth([disk()], "")).toBeUndefined();

  const points = [
    { at: "2026-11-01T00:00:00Z", pendingSectors: 0, reallocatedSectors: 0, percentageUsed: 40 },
    { at: "2026-11-02T00:00:00Z", pendingSectors: 2, reallocatedSectors: 0, percentageUsed: 41 },
  ];
  const { shown, zero } = counterSeries(points);
  expect(shown.map((s) => s.label)).toEqual(["Pending"]);
  expect(zero).toContain("Reallocated");

  const projection = wearProjection(points, "2027-11-02T00:00:00Z");
  expect(projection).toHaveLength(2);
  expect(projection[0].y).toBe(41);
  expect(projection[1].y).toBe(100);
  expect(wearProjection(points, null)).toEqual([]);
  expect(wearProjection(points, "2026-10-01T00:00:00Z")).toEqual([]);
});

test("reports counters with their change across the loaded range", () => {
  const points = [
    { at: "2026-11-01T00:00:00Z", pendingSectors: 1, reallocatedSectors: 4 },
    { at: "2026-11-02T00:00:00Z", pendingSectors: 3, reallocatedSectors: 4 },
  ];
  const rows = counterRows(points, { pendingSectors: 5, reallocatedSectors: 4 }, false);
  const pending = rows.find((r) => r.label === "Pending");
  expect(pending).toMatchObject({ value: 5, change: 2, charted: true });
  expect(rows.find((r) => r.label === "Reallocated")).toMatchObject({ value: 4, change: 0, charted: true });
  expect(rows.find((r) => r.label === "CRC errors")).toMatchObject({ value: 0, charted: false });

  expect(rows.map((r) => r.label)).not.toContain("Media errors");
  expect(counterRows(points, { mediaErrors: 2 }, false).map((r) => r.label)).toContain("Media errors");
  expect(counterRows(points, {}, true).map((r) => r.label)).toContain("Media errors");

  expect(counterRows([], { pendingSectors: 7 }, false)[0]).toMatchObject({ value: 7, change: null, charted: false });
});

test("treats a missing temperature as a gap, not 0 degrees", () => {
  const points = [
    { at: "2026-11-01T00:00:00Z", temperatureC: 40 },
    { at: "2026-11-01T06:00:00Z", temperatureC: 0 },
    { at: "2026-11-01T12:00:00Z", temperatureC: 42 },
  ];
  expect(temperatureSeries(points).map((p) => p.y)).toEqual([40, 42]);
  expect(temperatureDomain([40, 42])).toEqual([38, 44]);
  expect(temperatureDomain([40, 40])).toEqual([37, 43]);
  expect(temperatureDomain([])).toBeUndefined();
});

test("summarizes a series and formats its values", () => {
  expect(seriesStats([])).toBeNull();
  expect(seriesStats([28, 12, 15])).toEqual({ latest: 15, low: 12, high: 28, change: -13 });
  expect(changeText(0)).toBe("No change");
  expect(changeText(7)).toBe("+7");
  expect(changeText(-16)).toBe("\u221216");
  expect(powerOnText(12)).toBe("12 hours");
  expect(powerOnText(72)).toBe("3 days");
  expect(powerOnText(2190)).toBe("3 months");
  expect(powerOnText(53874)).toBe("6.1 years");
  expect(bandTextColor("critical", true)).toBe("#F87171");
  expect(bandTextColor("critical", false)).toBe("#B91C1C");
  expect(bandTextColor("", false)).toBe("#475569");
});

test("sizes time axis labels to the visible span", () => {
  const at = new Date(2026, 10, 3, 18, 30);
  const day = 86_400_000;
  const dayText = at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  expect(chartTickText(at, 30 * day)).toBe(dayText);
  expect(chartTickText(at, 2 * day).startsWith(`${dayText} `)).toBe(true);
  expect(chartTickText(at, 900 * day)).toBe(at.toLocaleDateString(undefined, { month: "short", year: "numeric" }));
});

test("prefers a live row over a retired row with the same serial", () => {
  const retired = disk({ serial: "S1", retiredAt: "2026-10-01T00:00:00Z", score: 40, band: "at_risk" });
  const live = disk({ serial: "S1", retiredAt: null, score: 90, band: "good" });
  expect(pickDiskHealth([retired, live], "S1")).toBe(live);
  expect(pickDiskHealth([live, retired], "S1")).toBe(live);
  expect(pickDiskHealth([retired], "S1")).toBe(retired);
});

test("calls the disk health routes with the session token", async () => {
  const { apiFetch } = require("../services/api-client");
  const { listDiskHealth, getDiskHealthHistory, purgeDiskHealth } = require("../services/diskhealth");
  apiFetch.mockResolvedValueOnce({ lastPollAt: null, disks: [] });
  await listDiskHealth("retired");
  expect(apiFetch).toHaveBeenLastCalledWith("/diskhealth/?state=retired", { token: "token", reportResult: false });
  apiFetch.mockResolvedValueOnce({ disk: { serial: "WD 1" }, points: [] });
  await getDiskHealthHistory("WD 1", 30);
  expect(apiFetch).toHaveBeenLastCalledWith("/diskhealth/WD%201?days=30", { token: "token", reportResult: false });
  apiFetch.mockResolvedValueOnce(undefined);
  await purgeDiskHealth("WD 1");
  expect(apiFetch).toHaveBeenLastCalledWith("/diskhealth/WD%201", { method: "DELETE", token: "token" });
});
