import type { CelldObservation } from "@/types/celld";
export const unavailable = "Unavailable";
export const numberValue = (value?: number) =>
  value === undefined || !Number.isFinite(value)
    ? unavailable
    : value.toLocaleString(
        "en-GB",
        Math.abs(value) > 0 && Math.abs(value) < 0.01
          ? { maximumSignificantDigits: 2 }
          : { maximumFractionDigits: 2 },
      );
export function bytes(value?: number) {
  if (value === undefined || !Number.isFinite(value) || value < 0)
    return unavailable;
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const unit =
    value === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            units.length - 1,
            Math.floor(Math.log(value) / Math.log(1024)),
          ),
        );
  return `${numberValue(value / 1024 ** unit)} ${units[unit]}`;
}
export const timestamp = (value?: number) =>
  value === undefined ||
  !Number.isFinite(value) ||
  Number.isNaN(new Date(value).getTime())
    ? unavailable
    : new Date(value).toLocaleString("en-GB");
export const duration = (value?: number) =>
  value === undefined || !Number.isFinite(value)
    ? unavailable
    : `${numberValue(value / 1000)} ms`;
export function mergeObservations(
  previous: CelldObservation[],
  next: CelldObservation[],
  limit = 2000,
) {
  return [
    ...new Map([...previous, ...next].map((row) => [row.id, row])).values(),
  ]
    .sort(
      (a, b) =>
        (a.record?.time_ms ?? a.snapshot?.collected_ms ?? a.received_ms ?? 0) -
          (b.record?.time_ms ??
            b.snapshot?.collected_ms ??
            b.received_ms ??
            0) || a.id.localeCompare(b.id),
    )
    .slice(-limit);
}
