import type { CelldObservationQuery } from "@/types/celld";

export const MAX_WINDOW_MS = 7 * 86400000;
export const filterKeys = [
  "node",
  "workload",
  "source",
  "severity",
  "text",
] as const;
export function queryDraft(
  query: CelldObservationQuery,
): Record<string, string> {
  return {
    from: new Date(query.from).toISOString(),
    to: new Date(query.to).toISOString(),
    limit: String(query.limit ?? 200),
    ...Object.fromEntries(filterKeys.map((key) => [key, query[key] ?? ""])),
  };
}
function utcDate(value: string) {
  const input = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/i.test(input))
    return NaN;
  const ms = Date.parse(input);
  // Date.parse normalizes invalid days (e.g. 30 February); reject those too.
  return Number.isFinite(ms) &&
    new Date(ms).toISOString().slice(0, 16) === input.slice(0, 16)
    ? ms
    : NaN;
}
export function parseQueryDraft(
  draft: Record<string, string>,
  now = Date.now(),
): CelldObservationQuery {
  const from = utcDate(draft.from ?? ""),
    to = utcDate(draft.to ?? "");
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    from < 0 ||
    to <= from ||
    to - from > MAX_WINDOW_MS ||
    to > now + 60000
  )
    throw new Error(
      "Enter valid UTC dates ending in Z, with an end after the start and an interval of up to 7 days.",
    );
  const limit = Number(draft.limit);
  if (
    !draft.limit?.trim() ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 500
  )
    throw new Error("Page size must be a whole number from 1 to 500.");
  if ((draft.text?.length ?? 0) > 256)
    throw new Error("Search messages using at most 256 characters.");
  return {
    from,
    to,
    limit,
    ...Object.fromEntries(
      filterKeys
        .map((key) => [key, key === "text" ? draft[key] : draft[key]?.trim()])
        .filter(([, value]) => value !== undefined && value !== ""),
    ),
  };
}
