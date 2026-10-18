import type { CelldObservation } from "@/types/celld";
import { unavailable } from "./observability";
export type ResourceMetric = "rss_bytes" | "cpu_percent_x100";
export type ResourcePoint = { time: number; value: number };
export function resourceSeries(
  rows: CelldObservation[],
  metric: ResourceMetric,
  from: number,
  to: number,
) {
  const nodes = new Map<
    string,
    Map<number, { point: ResourcePoint | null; generation?: string }>
  >();
  for (const row of rows) {
    const node = row.node ?? row.snapshot?.node_id ?? unavailable;
    if (!nodes.has(node)) nodes.set(node, new Map());
    const time = row.snapshot?.collected_ms;
    if (
      typeof time !== "number" ||
      !Number.isFinite(time) ||
      time < from ||
      time > to
    )
      continue;
    const value = row.snapshot?.resources?.[metric];
    nodes.get(node)!.set(time, {
      point:
        typeof value === "number" && Number.isFinite(value) && value >= 0
          ? { time, value }
          : null,
      generation: row.generation,
    });
  }
  return [...nodes]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([node, byTime]) => {
      const segments: ResourcePoint[][] = [];
      let segment: ResourcePoint[] = [],
        previousGeneration: string | undefined;
      for (const [, sample] of [...byTime].sort(([a], [b]) => a - b)) {
        if (
          !sample.point ||
          (previousGeneration &&
            sample.generation &&
            sample.generation !== previousGeneration)
        ) {
          if (segment.length) segments.push(segment);
          segment = [];
        }
        if (sample.point) segment.push(sample.point);
        previousGeneration = sample.generation;
      }
      if (segment.length) segments.push(segment);
      return { node, segments, points: segments.flat() };
    });
}
export function chartCeiling(maximum: number, metric: ResourceMetric) {
  const value = Math.max(metric === "rss_bytes" ? 1024 : 100, maximum);
  if (metric === "rss_bytes") return 2 ** Math.ceil(Math.log2(value));
  const scale = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find((step) => step * scale >= value) ?? 10) * scale;
}
// Samples are sorted once, so inspection stays logarithmic even for dense series.
export function nearestPoint(points: ResourcePoint[], time: number) {
  if (!points.length) return undefined;
  let low = 0,
    high = points.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (points[mid].time < time) low = mid + 1;
    else high = mid;
  }
  const previous = points[Math.max(0, low - 1)],
    next = points[low];
  return Math.abs(previous.time - time) <= Math.abs(next.time - time)
    ? previous
    : next;
}

// Keep the real minimum and maximum in every time bucket, including short spikes.
// Only rendering is reduced; statistics and inspection always use the originals.
export function sampleEnvelope(
  points: ResourcePoint[],
  budget: number,
): ResourcePoint[] {
  budget = Math.max(4, Math.floor(budget));
  if (points.length <= budget) return points;
  const first = points[0],
    last = points[points.length - 1];
  const count = Math.max(1, Math.floor((budget - 2) / 2));
  const buckets = new Map<number, { min: ResourcePoint; max: ResourcePoint }>();
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const bucket = Math.min(
      count - 1,
      Math.floor(
        ((point.time - first.time) / Math.max(1, last.time - first.time)) *
          count,
      ),
    );
    const pair = buckets.get(bucket);
    if (!pair) buckets.set(bucket, { min: point, max: point });
    else {
      if (point.value < pair.min.value) pair.min = point;
      if (point.value > pair.max.value) pair.max = point;
    }
  }
  return [
    ...new Map(
      [
        first,
        ...[...buckets.values()].flatMap((pair) => [pair.min, pair.max]),
        last,
      ].map((point) => [point.time, point]),
    ).values(),
  ].sort((a, b) => a.time - b.time);
}
export function sampleSegments(segments: ResourcePoint[][], budget: number) {
  budget = Math.max(4, Math.floor(budget));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const sampled = segments.map((segment) =>
    sampleEnvelope(
      segment,
      Math.max(4, Math.floor((budget * segment.length) / Math.max(1, total))),
    ),
  );
  if (sampled.reduce((sum, segment) => sum + segment.length, 0) <= budget)
    return sampled;
  // Many tiny segments must not defeat the render budget. Keep their extrema,
  // but never connect samples across an original missing-data boundary.
  const retained = new Set(sampleEnvelope(segments.flat(), budget));
  return segments
    .map((segment) => segment.filter((point) => retained.has(point)))
    .filter((segment) => segment.length);
}
