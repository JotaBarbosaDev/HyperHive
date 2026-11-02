import { tokenize } from "./condition-assist";

// Splits an HH Automation condition into rows joined by AND / OR / AND NOT / OR NOT / XOR and
// builds it back. Storage stays one expr string: the builder emits explicit left-to-right
// parentheses, `((c1 && c2) || c3) != c4`, so mixed joiners never depend on expr precedence.
// The parser only recognises that exact shape; anything else is one row holding the whole text,
// and parse(s) is accepted only when build(parse(s)) === s, so loading never rewrites a condition.

export type ConditionJoiner = "and" | "or" | "andNot" | "orNot" | "xor";
export type ConditionRow = { id: string; text: string; not: boolean };
export type ConditionGroup = { rows: ConditionRow[]; ops: ConditionJoiner[]; negate: boolean };

export const JOINERS: { value: ConditionJoiner; label: string; hint: string }[] = [
  { value: "and", label: "AND", hint: "both true" },
  { value: "or", label: "OR", hint: "at least one true" },
  { value: "andNot", label: "AND NOT", hint: "left true, right false" },
  { value: "orNot", label: "OR NOT", hint: "left true or right false" },
  { value: "xor", label: "XOR", hint: "exactly one true" },
];

const EMIT: Record<ConditionJoiner, string> = { and: " && ", or: " || ", andNot: " && !", orNot: " || !", xor: " != " };

let nextId = 0;
export const newRow = (text = "", not = false): ConditionRow => ({ id: `row-${++nextId}`, text, not });
const single = (text: string): ConditionGroup => ({ rows: [newRow(text)], ops: [], negate: false });

export function buildConditionGroup(group: ConditionGroup): string {
  // An empty row drops out together with the joiner in front of it.
  const kept: { row: ConditionRow; op?: ConditionJoiner }[] = [];
  group.rows.forEach((row, i) => { if (row.text.trim()) kept.push({ row, op: kept.length ? group.ops[i - 1] ?? "and" : undefined }); });
  if (!kept.length) return "";
  if (kept.length === 1) {
    const { row } = kept[0];
    // One plain row is stored as typed, so existing automations round-trip unchanged.
    if (!row.not && !group.negate) return row.text;
    const inner = `!(${row.text.trim()})`;
    return row.not && group.negate ? `!(${inner})` : inner;
  }
  const operand = (row: ConditionRow) => `${row.not ? "!" : ""}(${row.text.trim()})`;
  let expr = operand(kept[0].row);
  kept.slice(1).forEach(({ row, op }, i) => {
    expr = `${i ? `(${expr})` : expr}${EMIT[op ?? "and"]}${operand(row)}`;
  });
  return group.negate ? `!(${expr})` : expr;
}

type Tok = ReturnType<typeof tokenize>[number];
type Parsed = { rows: { text: string; not: boolean }[]; ops: ConditionJoiner[] };

// toks[from..to) is `!`* `(` … `)` with the parentheses matching each other.
function operandAt(src: string, toks: Tok[], from: number, to: number, match: Map<number, number>) {
  let bangs = 0;
  while (from + bangs < to && toks[from + bangs].text === "!") bangs++;
  const open = from + bangs;
  if (open >= to || toks[open].text !== "(" || match.get(open) !== to - 1) return null;
  return { bangs, inner: [toks[open].end, toks[to - 1].start] as const, innerToks: [open + 1, to - 1] as const };
}

function parseRange(src: string, toks: Tok[], from: number, to: number, match: Map<number, number>): Parsed | null {
  // Left-nested, so the rightmost top-level joiner splits the last row from everything before it.
  let depth = 0;
  let split = -1;
  for (let i = from; i < to; i++) {
    const text = toks[i].text;
    if (text === "(" || text === "[") depth++;
    else if (text === ")" || text === "]") depth--;
    else if (depth === 0 && (text === "&&" || text === "||" || text === "!=")) split = i;
  }
  if (split < 0) return null;
  const right = operandAt(src, toks, split + 1, to, match);
  if (!right || right.bangs > 2) return null;
  const sym = toks[split].text;
  if (sym === "!=" && right.bangs > 1) return null;
  // `L && !(R)` is both AND + NOT row and AND NOT; it reads back as the joiner.
  const op: ConditionJoiner = sym === "!=" ? "xor" : right.bangs ? (sym === "&&" ? "andNot" : "orNot") : sym === "&&" ? "and" : "or";
  const last = { text: src.slice(...right.inner), not: sym === "!=" ? right.bangs === 1 : right.bangs === 2 };

  const left = operandAt(src, toks, from, split, match);
  if (!left || left.bangs > 1) return null;
  const nested = left.bangs === 0 ? parseRange(src, toks, left.innerToks[0], left.innerToks[1], match) : null;
  const head = nested ?? { rows: [{ text: src.slice(...left.inner), not: left.bangs === 1 }], ops: [] };
  return { rows: [...head.rows, last], ops: [...head.ops, op] };
}

export function parseConditionGroup(text: string): ConditionGroup {
  const toks = tokenize(text).filter((t) => t.kind !== "ws");
  const match = new Map<number, number>();
  const stack: number[] = [];
  toks.forEach((t, i) => {
    if (t.text === "(") stack.push(i);
    else if (t.text === ")" && stack.length) match.set(stack.pop()!, i);
  });

  let group: ConditionGroup | null = null;
  const whole = toks.length ? operandAt(text, toks, 0, toks.length, match) : null;
  const negated = whole?.bangs === 1 ? parseRange(text, toks, whole.innerToks[0], whole.innerToks[1], match) : null;
  const parsed = negated ?? parseRange(text, toks, 0, toks.length, match);
  if (parsed) group = { rows: parsed.rows.map((r) => newRow(r.text, r.not)), ops: parsed.ops, negate: !!negated };
  else if (whole && whole.bangs === 1) group = { rows: [newRow(text.slice(...whole.inner), true)], ops: [], negate: false };

  return group && buildConditionGroup(group) === text ? group : single(text);
}
