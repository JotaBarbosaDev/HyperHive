import { describe, expect, it } from "@jest/globals";
import { buildConditionGroup, newRow, parseConditionGroup, type ConditionGroup, type ConditionJoiner } from "./condition-group";

const A = "app('UPS').battery < 20";
const B = "app('NAS').health == 'bad'";
const C = "app('web').connectivity == 'offline'";

const group = (texts: (string | [string, boolean])[], ops: ConditionJoiner[] = [], negate = false): ConditionGroup => ({
  rows: texts.map((t) => (typeof t === "string" ? newRow(t) : newRow(t[0], t[1]))), ops, negate,
});
const shape = (g: ConditionGroup) => ({ rows: g.rows.map((r) => [r.text, r.not]), ops: g.ops, negate: g.negate });

describe("buildConditionGroup", () => {
  it("keeps one plain row exactly as typed", () => {
    expect(buildConditionGroup(group([` ${A} `]))).toBe(` ${A} `);
  });

  it.each<[ConditionJoiner, string]>([
    ["and", `(${A}) && (${B})`],
    ["or", `(${A}) || (${B})`],
    ["andNot", `(${A}) && !(${B})`],
    ["orNot", `(${A}) || !(${B})`],
    ["xor", `(${A}) != (${B})`],
  ])("emits %s", (op, expected) => {
    expect(buildConditionGroup(group([A, B], [op]))).toBe(expected);
  });

  it("negates rows and the whole result", () => {
    expect(buildConditionGroup(group([[A, true]]))).toBe(`!(${A})`);
    expect(buildConditionGroup(group([A], [], true))).toBe(`!(${A})`);
    expect(buildConditionGroup(group([[A, true], B], ["and"], true))).toBe(`!(!(${A}) && (${B}))`);
    expect(buildConditionGroup(group([A, [B, true]], ["andNot"]))).toBe(`(${A}) && !!(${B})`);
  });

  it("nests mixed joiners left to right", () => {
    expect(buildConditionGroup(group([A, B, C, A], ["and", "or", "xor"]))).toBe(`(((${A}) && (${B})) || (${C})) != (${A})`);
  });

  it("drops empty rows with the joiner in front of them", () => {
    expect(buildConditionGroup(group([A, " ", B], ["and", "or"]))).toBe(`(${A}) || (${B})`);
    expect(buildConditionGroup(group(["", A, B], ["xor", "or"]))).toBe(`(${A}) || (${B})`);
    expect(buildConditionGroup(group(["", A], ["and"]))).toBe(A);
    expect(buildConditionGroup(group(["", ""], ["and"], true))).toBe("");
  });
});

describe("parseConditionGroup", () => {
  it.each([
    [group([A, B], ["and"])],
    [group([A, B], ["or"])],
    [group([A, [B, true]], ["andNot"])],
    [group([[A, true], B], ["orNot"], true)],
    [group([A, B], ["andNot"])],
    [group([A, [B, true]], ["xor"])],
    [group([A, B, C], ["and", "or"])],
    [group([A, B, C, A], ["xor", "andNot", "or"], true)],
    [group(["app('x').name == 'a && b)'", "app('y').v != 1"], ["or"])],
  ])("round-trips builder output %#", (g) => {
    const text = buildConditionGroup(g);
    const parsed = parseConditionGroup(text);
    expect(buildConditionGroup(parsed)).toBe(text);
    expect(shape(parsed)).toEqual(shape(g));
  });

  it("reads a single NOT row", () => {
    expect(shape(parseConditionGroup(`!(${A})`))).toEqual({ rows: [[A, true]], ops: [], negate: false });
  });

  it("reads one bang after && as AND NOT, two as AND NOT plus a NOT row", () => {
    expect(shape(parseConditionGroup(buildConditionGroup(group([A, [B, true]], ["and"]))))).toEqual({ rows: [[A, false], [B, false]], ops: ["andNot"], negate: false });
    expect(shape(parseConditionGroup(`(${A}) && !!(${B})`))).toEqual({ rows: [[A, false], [B, true]], ops: ["andNot"], negate: false });
  });

  it.each([
    "",
    A,
    `${A} && ${B} || ${C}`,
    `(${A}) && (${B}) || (${C})`,
    `( ${A} ) && (${B})`,
    `(${A})&&(${B})`,
    `(${A}) && (${B}`,
    `(${A}) != !!(${B})`,
    `!!(${A})`,
    `${A} and not ${B}`,
  ])("keeps other text as one row: %s", (text) => {
    const parsed = parseConditionGroup(text);
    expect(shape(parsed)).toEqual({ rows: [[text, false]], ops: [], negate: false });
    expect(buildConditionGroup(parsed)).toBe(text);
  });
});
