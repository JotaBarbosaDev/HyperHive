jest.mock("../services/vms-client", () => ({ resolveToken: jest.fn(async () => "token") }));
jest.mock("../services/api-client", () => ({ apiFetch: jest.fn() }));
import { normalizeDiskHealthHistory, normalizeDiskHealthList } from "../services/diskhealth";
import {
  bandBadgeAction,
  bandBadgeLabel,
  counterSeries,
  diskHealthSummary,
  lastPollText,
  pickDiskHealth,
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
