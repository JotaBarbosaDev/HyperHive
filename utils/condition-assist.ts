import type { CatalogApp, CatalogStream, ConditionCatalog } from "@/services/automations";

// Completions and checks for HH Automation conditions (expr language, see
// HyperHive docs/automations.md). Works on a small tokenizer instead of a full
// parser: it only needs to recognise app('name'[, 'instance']) followed by
// .field / ['field'] and an optional comparison.

type TokenKind = "str" | "num" | "ident" | "op" | "punct" | "ws";
type Token = { kind: TokenKind; text: string; value: string; start: number; end: number; closed?: boolean; quote?: string };

const TWO_CHAR_OPS = ["==", "!=", ">=", "<=", "&&", "||", "**", "??", "?."];
const COMPARISONS = ["==", "!=", ">=", "<=", ">", "<"];

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const start = i;
    const ch = source[i];
    if (/\s/.test(ch)) {
      while (i < source.length && /\s/.test(source[i])) i++;
      tokens.push({ kind: "ws", text: source.slice(start, i), value: "", start, end: i });
    } else if (ch === "'" || ch === '"') {
      let value = "";
      let closed = false;
      i++;
      while (i < source.length) {
        if (source[i] === "\\" && i + 1 < source.length) { value += source[i + 1]; i += 2; continue; }
        if (source[i] === ch) { closed = true; i++; break; }
        value += source[i++];
      }
      tokens.push({ kind: "str", text: source.slice(start, i), value, start, end: i, closed, quote: ch });
    } else if (/[0-9]/.test(ch)) {
      while (i < source.length && /[0-9._eE]/.test(source[i])) i++;
      tokens.push({ kind: "num", text: source.slice(start, i), value: source.slice(start, i), start, end: i });
    } else if (/[A-Za-z_$]/.test(ch)) {
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) i++;
      tokens.push({ kind: "ident", text: source.slice(start, i), value: source.slice(start, i), start, end: i });
    } else {
      const two = source.slice(i, i + 2);
      const op = TWO_CHAR_OPS.includes(two) ? two : "<>!+-*/%?:".includes(ch) ? ch : "";
      i += op ? op.length : 1;
      tokens.push({ kind: op ? "op" : "punct", text: source.slice(start, i), value: source.slice(start, i), start, end: i });
    }
  }
  return tokens;
}

const is = (token: Token | undefined, kind: TokenKind, text?: string) => !!token && token.kind === kind && (text === undefined || token.text === text);
const closedStr = (token: Token | undefined) => is(token, "str") && !!token!.closed;

type Ref = { app: string; instance?: string; start: number };
type Access = { ref: Ref; key: string; viaStreams: boolean };

// t[end] is the ")" of app('a') or app('a', 'i').
function refEndingAt(t: Token[], end: number): Ref | null {
  if (!is(t[end], "punct", ")")) return null;
  if (closedStr(t[end - 1]) && is(t[end - 2], "punct", "(") && is(t[end - 3], "ident", "app")) return { app: t[end - 1].value, start: end - 3 };
  if (closedStr(t[end - 1]) && is(t[end - 2], "punct", ",") && closedStr(t[end - 3]) && is(t[end - 4], "punct", "(") && is(t[end - 5], "ident", "app")) {
    return { app: t[end - 3].value, instance: t[end - 1].value, start: end - 5 };
  }
  return null;
}

// t[end] is the ")" of a ref or the "streams" of ref.streams.
function targetEndingAt(t: Token[], end: number): { ref: Ref; viaStreams: boolean } | null {
  if (is(t[end], "ident", "streams") && is(t[end - 1], "punct", ".")) {
    const ref = refEndingAt(t, end - 2);
    if (ref) return { ref, viaStreams: true };
  }
  const ref = refEndingAt(t, end);
  return ref ? { ref, viaStreams: false } : null;
}

// t[end] is the last token of ref.key or ref['key'].
function accessEndingAt(t: Token[], end: number): Access | null {
  let key: string;
  let before: number;
  if (is(t[end], "ident") && is(t[end - 1], "punct", ".")) { key = t[end].value; before = end - 2; }
  else if (is(t[end], "punct", "]") && closedStr(t[end - 1]) && is(t[end - 2], "punct", "[")) { key = t[end - 1].value; before = end - 3; }
  else return null;
  const target = targetEndingAt(t, before);
  if (!target || (!target.viaStreams && key === "streams")) return null;
  return { ref: target.ref, key, viaStreams: target.viaStreams };
}

type FieldInfo = { type: string; values?: string[]; detail: string };
const FIELDS: Record<string, FieldInfo> = {
  health: { type: "text", values: ["healthy", "degraded", "unhealthy", "unknown"], detail: "health state" },
  connectivity: { type: "text", values: ["online", "offline", "unknown"], detail: "online state" },
  health_message: { type: "text", detail: "health message" },
};

export const findApp = (catalog: ConditionCatalog | null, name: string): CatalogApp | undefined => {
  const lower = name.toLowerCase();
  return catalog?.apps.find((app) => app.id === name) ?? catalog?.apps.find((app) => app.name.toLowerCase() === lower);
};

type KeyInfo = { field?: FieldInfo; stream?: CatalogStream; type: string };
function describeKey(app: CatalogApp, access: Pick<Access, "key" | "viaStreams">): KeyInfo | null {
  if (!access.viaStreams && FIELDS[access.key]) return { field: FIELDS[access.key], type: FIELDS[access.key].type };
  const stream = app.streams.find((s) => s.name === access.key);
  return stream ? { stream, type: stream.type } : null;
}

export function formatValue(value: unknown, unit?: string): string {
  if (value === undefined) return "no current value";
  const text = typeof value === "string" ? `'${value}'` : JSON.stringify(value);
  const short = text.length > 40 ? text.slice(0, 39) + "…" : text;
  return unit && typeof value === "number" ? `${short} ${unit}` : short;
}

export type SuggestionKind = "app" | "instance" | "field" | "stream" | "value" | "operator";
export type Suggestion = {
  label: string;
  insert: string;
  kind: SuggestionKind;
  detail?: string;
  // Value type ("number", "text"…) and current value, shown as separate columns.
  type?: string;
  value?: string;
  // Replace from here instead of the completion's `from` (e.g. ".disk.used" → "['disk.used']").
  from?: number;
  // Cursor position inside `insert` after accepting; defaults to its end.
  cursor?: number;
};
export type Completion = { from: number; to: number; items: Suggestion[] };

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const escape = (value: string, quote: string) => value.replace(/\\/g, "\\\\").split(quote).join("\\" + quote);

function rank<T extends { label: string }>(items: T[], prefix: string, keyOf: (item: T) => string = (item) => item.label): T[] {
  const p = prefix.toLowerCase();
  if (!p) return items.slice(0, 60);
  const starts = items.filter((s) => keyOf(s).toLowerCase().startsWith(p));
  const contains = items.filter((s) => !keyOf(s).toLowerCase().startsWith(p) && keyOf(s).toLowerCase().includes(p));
  return [...starts, ...contains].slice(0, 60);
}

const appInfo = (app: CatalogApp) => ({ detail: `${app.streams.length} stream${app.streams.length === 1 ? "" : "s"}`, value: app.connectivity });
const streamInfo = (stream: CatalogStream, instance?: string) =>
  ({ type: stream.type || "untyped", detail: stream.label || undefined, value: instance ? undefined : formatValue(stream.value, stream.unit) });

function keyItems(app: CatalogApp, instance: string | undefined, viaStreams: boolean, dotStart: number, tail: string): Suggestion[] {
  const items: Suggestion[] = [];
  if (!viaStreams) {
    for (const [name, info] of Object.entries(FIELDS)) {
      const current = instance ? undefined : name === "health" ? app.health : name === "connectivity" ? app.connectivity : undefined;
      items.push({ label: name, insert: name + tail, kind: "field", type: info.type, detail: info.detail, value: current && `'${current}'` });
    }
  }
  for (const stream of app.streams) {
    // Field names win over stream names, so a clashing stream is read through .streams.
    const clash = !viaStreams && (stream.name in FIELDS || stream.name === "streams");
    const plain = IDENT.test(stream.name) && !clash;
    const insert = plain ? stream.name : clash ? `.streams['${escape(stream.name, "'")}']` : `['${escape(stream.name, "'")}']`;
    items.push({ label: stream.name, insert: insert + tail, kind: "stream", ...streamInfo(stream, instance), from: plain ? undefined : dotStart });
  }
  return items;
}

function operatorItems(info: KeyInfo): Suggestion[] {
  if (info.field?.values) {
    return info.field.values.flatMap((v) => [{ op: `== '${v}'`, detail: `is ${v}` }, { op: `!= '${v}'`, detail: `is not ${v}` }])
      .map(({ op, detail }) => ({ label: op, insert: op, kind: "operator" as const, detail }));
  }
  switch (info.type) {
    case "number": return ([[">= ", "at least"], ["> ", "greater than"], ["<= ", "at most"], ["< ", "less than"], ["== ", "equal to"], ["!= ", "not equal to"]] as const)
      .map(([op, detail]) => ({ label: op.trim(), insert: op, kind: "operator" as const, detail }));
    case "boolean": return ([["== true", "is true"], ["== false", "is false"]] as const).map(([op, detail]) => ({ label: op, insert: op, kind: "operator" as const, detail }));
    case "text": return ([["== ''", "exactly"], ["!= ''", "anything but"], ["contains ''", "has the text"], ["startsWith ''", "begins with"], ["matches ''", "regular expression"]] as const)
      .map(([op, detail]) => ({ label: op, insert: op, kind: "operator" as const, cursor: op.length - 1, detail }));
  }
  return [];
}

// Suggestions for the text before `cursor`, or null when nothing fits.
export function suggest(text: string, cursor: number, catalog: ConditionCatalog | null): Completion | null {
  if (!catalog) return null;
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const all = tokenize(before);
  const trailingWs = all[all.length - 1]?.kind === "ws";
  const t = all.filter((token) => token.kind !== "ws");
  const n = t.length;
  const last = t[n - 1];
  const atEnd = after.trim() === "";
  const completion = (from: number, items: Suggestion[]) => (items.length ? { from, to: cursor, items } : null);

  // Inside an unfinished string: App name, instance, ['stream'] or a compared value.
  if (last && last.kind === "str" && !last.closed) {
    const quote = last.quote!;
    const closes = !after.startsWith(quote);
    const from = last.start + 1;
    const prefix = last.value;
    if (is(t[n - 2], "punct", "(") && is(t[n - 3], "ident", "app")) {
      const items = catalog.apps.map((app) => ({ label: app.name, insert: escape(app.name, quote) + (closes ? quote + ")" + (atEnd ? "." : "") : ""), kind: "app" as const, ...appInfo(app) }));
      return completion(from, rank(items, prefix));
    }
    if (is(t[n - 2], "punct", ",") && closedStr(t[n - 3]) && is(t[n - 4], "punct", "(") && is(t[n - 5], "ident", "app")) {
      const app = findApp(catalog, t[n - 3].value);
      const items = (app?.instances ?? []).map((id) => ({ label: id, insert: escape(id, quote) + (closes ? quote + ")" + (atEnd ? "." : "") : ""), kind: "instance" as const, detail: app!.name }));
      return completion(from, rank(items, prefix));
    }
    if (is(t[n - 2], "punct", "[")) {
      const target = targetEndingAt(t, n - 3);
      const app = target && findApp(catalog, target.ref.app);
      if (!target || !app) return null;
      const items = app.streams.map((s) => ({ label: s.name, insert: escape(s.name, quote) + (closes ? quote + "]" : ""), kind: "stream" as const, ...streamInfo(s, target.ref.instance) }));
      return completion(from, rank(items, prefix));
    }
    if (is(t[n - 2], "op") && ["==", "!="].includes(t[n - 2].text)) {
      const access = accessEndingAt(t, n - 3);
      const app = access && findApp(catalog, access.ref.app);
      const info = access && app && describeKey(app, access);
      if (!info) return null;
      const values = info.field?.values ?? (typeof info.stream?.value === "string" ? [info.stream.value] : []);
      const items = values.map((v) => ({ label: v, insert: escape(v, quote) + (closes ? quote : ""), kind: "value" as const }));
      return completion(from, rank(items, prefix));
    }
    return null;
  }

  // After "app(...)." or "app(...).pre": fields and streams.
  const dotIndex = !trailingWs && is(last, "punct", ".") ? n - 1 : !trailingWs && is(last, "ident") && is(t[n - 2], "punct", ".") ? n - 2 : -1;
  if (dotIndex >= 0) {
    const target = targetEndingAt(t, dotIndex - 1);
    const app = target && findApp(catalog, target.ref.app);
    if (!target || !app) return null;
    const prefix = dotIndex === n - 1 ? "" : last.text;
    const items = keyItems(app, target.ref.instance, target.viaStreams, t[dotIndex].start, atEnd ? " " : "");
    return completion(dotIndex === n - 1 ? cursor : last.start, rank(items, prefix));
  }

  // After a complete access and a space: comparisons that fit its type.
  if (trailingWs && n) {
    const access = accessEndingAt(t, n - 1);
    const app = access && findApp(catalog, access.ref.app);
    const info = access && app && describeKey(app, access);
    if (info) return completion(cursor, operatorItems(info));
  }

  // Start of an operand: app('Name').
  const operandStart = !last || is(last, "punct", "(") || (is(last, "op") && ["&&", "||", "!"].includes(last.text))
    || (trailingWs && is(last, "ident") && ["and", "or", "not"].includes(last.text));
  const word = !trailingWs && is(last, "ident") && !is(t[n - 2], "punct", ".") ? last : null;
  if (operandStart || word) {
    const prefix = word?.text ?? "";
    const apps = catalog.apps.map((app) => ({ label: app.name, app }));
    const matches = "app".startsWith(prefix.toLowerCase()) ? apps.slice(0, 60) : rank(apps, prefix);
    return completion(word ? word.start : cursor, matches.map(({ app }) => ({ label: `app('${app.name}')`, insert: `app('${escape(app.name, "'")}')` + (atEnd ? "." : ""), kind: "app" as const, ...appInfo(app) })));
  }
  return null;
}

// Applies a suggestion; returns the new text and cursor.
export function applySuggestion(text: string, completion: Completion, item: Suggestion): { text: string; cursor: number } {
  const from = item.from ?? completion.from;
  const next = text.slice(0, from) + item.insert + text.slice(completion.to);
  return { text: next, cursor: from + (item.cursor ?? item.insert.length) };
}

export type Hint = { tone: "warn" | "info"; message: string };

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function closest(name: string, options: string[]): string | undefined {
  const lower = name.toLowerCase();
  let best: string | undefined;
  let bestScore = Infinity;
  for (const option of options) {
    const score = option.toLowerCase() === lower ? 0 : distance(lower, option.toLowerCase());
    if (score < bestScore) { best = option; bestScore = score; }
  }
  return bestScore <= Math.max(2, Math.floor(name.length / 3)) ? best : undefined;
}

const literalType = (token: Token | undefined) =>
  !token ? null : token.kind === "str" ? "text" : token.kind === "num" ? "number" : is(token, "ident", "true") || is(token, "ident", "false") ? "boolean" : null;

// Problems the server would only report at evaluation time: unknown Apps,
// instances or streams, values of the wrong type and missing current values.
export function lintCondition(text: string, catalog: ConditionCatalog | null): Hint[] {
  if (!catalog || !text.trim()) return [];
  const t = tokenize(text).filter((token) => token.kind !== "ws");
  const hints: Hint[] = [];
  const add = (tone: Hint["tone"], message: string) => { if (!hints.some((h) => h.message === message)) hints.push({ tone, message }); };
  for (let i = 0; i < t.length; i++) {
    if (!is(t[i], "ident", "app") || !is(t[i + 1], "punct", "(")) continue;
    let end = -1;
    for (const candidate of [i + 3, i + 5]) if (refEndingAt(t, candidate)?.start === i) { end = candidate; break; }
    if (end < 0) continue;
    const ref = refEndingAt(t, end)!;
    const app = findApp(catalog, ref.app);
    if (!app) {
      const guess = closest(ref.app, catalog.apps.map((a) => a.name));
      add("warn", `Unknown App '${ref.app}'.` + (guess ? ` Did you mean '${guess}'?` : ""));
      continue;
    }
    if (ref.instance !== undefined && !app.instances.includes(ref.instance)) {
      const guess = closest(ref.instance, app.instances);
      add("warn", `${app.name} has no instance '${ref.instance}'.` + (guess ? ` Did you mean '${guess}'?` : app.instances.length ? "" : " It has no instances."));
    }
    let keyEnd = -1;
    for (const candidate of [end + 2, end + 3, end + 4, end + 5]) {
      const access = accessEndingAt(t, candidate);
      if (access && access.ref.start === i) keyEnd = candidate;
    }
    if (keyEnd < 0) continue;
    const access = accessEndingAt(t, keyEnd)!;
    const label = app.name + (ref.instance !== undefined ? `[${ref.instance}]` : "") + "." + access.key;
    const info = describeKey(app, access);
    if (!info) {
      const guess = closest(access.key, app.streams.map((s) => s.name));
      add("warn", `${app.name} has no stream '${access.key}'.` + (guess ? ` Did you mean '${guess}'?` : ""));
      continue;
    }
    if (info.stream && info.stream.value === undefined && ref.instance === undefined) {
      add("info", `${label} has no current value right now (missing, or its sender is offline), so the condition evaluates to false.`);
    }
    const op = t[keyEnd + 1];
    if (!is(op, "op") || !COMPARISONS.includes(op.text)) continue;
    const literal = t[keyEnd + 2];
    const got = literalType(literal);
    if (got && ["number", "text", "boolean"].includes(info.type) && got !== info.type) {
      add("warn", `${label} is ${info.type === "text" ? "text" : `a ${info.type}`} but is compared with ${literal.text}.`);
    } else if (info.type === "text" && !["==", "!="].includes(op.text)) {
      add("info", `${label} is text; ${op.text} compares it alphabetically.`);
    } else if (info.field?.values && got === "text" && !info.field.values.includes(literal.value)) {
      add("warn", `${label} is one of ${info.field.values.map((v) => `'${v}'`).join(", ")}, not '${literal.value}'.`);
    }
  }
  return hints;
}
