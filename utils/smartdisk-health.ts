import { SmartDiskDevice } from "@/types/smartdisk";

// Mirrors the warning indicators in slave/smartdisk/assessHealth; absent values are not evidence of a cause.
export function cautionCauses(disk: SmartDiskDevice): string[] {
  const raw = disk.raw ?? {};
  const checks: [string, unknown, number][] = [
    ["Reallocation events", disk.metrics?.reallocatedEventCount ?? raw.reallocatedEventCount, 0],
    ["Raw read error rate", raw.rawReadErrorRate, 1000],
    ["Seek error rate", raw.seekErrorRate, 1000],
    ["Spin retries", raw.spinRetryCount, 0],
    ["Command timeouts", raw.commandTimeouts, 0],
    ["CRC errors", raw.crcErrorCount, 10],
    ["End-to-end errors", raw.endToEndErrors, 0],
    ["High fly writes", raw.highFlyWrites, 0],
    ["Temperature (°C)", disk.temp ?? raw.temperatureC, 60],
    ["NVMe wear (%)", raw.percentageUsed, 90],
    ["Device errors", raw.deviceErrorCount, 0],
    ["Error log entries", raw.errorLogCount, 100],
  ];
  const causes = checks.flatMap(([label, value, threshold]) => {
    if ((typeof value !== "number" && typeof value !== "string") || value === "") return [];
    const number = Number(value);
    return Number.isFinite(number) && number > threshold ? [`${label}: ${number}`] : [];
  });
  const spare = Number(raw.availableSpare);
  const threshold = Number(raw.availableSpareThreshold);
  if (raw.availableSpare != null && raw.availableSpare !== "" && raw.availableSpareThreshold != null && raw.availableSpareThreshold !== "" && Number.isFinite(spare) && Number.isFinite(threshold) && threshold > 0 && spare < threshold) {
    causes.push(`Available spare: ${spare}% (threshold ${threshold}%)`);
  }
  return causes;
}
