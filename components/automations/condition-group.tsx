import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { buildConditionGroup, JOINERS, newRow, parseConditionGroup, type ConditionGroup as Group, type ConditionJoiner, type ConditionRow } from "@/utils/condition-group";
import { ConditionInput, useConditionCatalog } from "./condition-input";
import { mono, subtle } from "./automation-ui";

const link = "text-xs font-semibold text-[#147D78] dark:text-[#6ED5C4]";
const focusRing = "web:cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-[#2DD4BF]";

// Joiner between two rows; opens an inline list so it works the same on web and native.
function JoinerPicker({ value, onChange }: { value: ConditionJoiner; onChange: (value: ConditionJoiner) => void }) {
  const [open, setOpen] = React.useState(false);
  const current = JOINERS.find((j) => j.value === value) ?? JOINERS[0];
  return <Box className="items-start gap-1">
    <Pressable accessibilityRole="button" accessibilityLabel={`Joiner: ${current.label}, ${current.hint}`} accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)}
      className={focusRing + " flex-row items-center gap-1 px-2 py-0.5 border border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#15233A]"} style={{ minHeight: 28 }}>
      <Text className="text-xs font-semibold text-typography-900 dark:text-[#E8EBF0]">{current.label}</Text>
      <Text className={subtle}>{open ? "▴" : "▾"}</Text>
    </Pressable>
    {open ? <Box accessibilityRole="menu" className="rounded-md border border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1726] overflow-hidden">
      {JOINERS.map((j) => <Pressable key={j.value} accessibilityRole="menuitem" accessibilityState={{ selected: j.value === value }} accessibilityLabel={`${j.label}, ${j.hint}`}
        onPress={() => { onChange(j.value); setOpen(false); }}
        className={"flex-row items-center gap-3 px-3 web:cursor-pointer " + (j.value === value ? "bg-background-100 dark:bg-[#1A2A40]" : "hover:bg-background-50 dark:hover:bg-[#15233A]")} style={{ minHeight: 32 }}>
        <Text className="w-16 text-xs font-semibold text-typography-900 dark:text-[#E8EBF0]">{j.label}</Text>
        <Text className={subtle}>{j.hint}</Text>
      </Pressable>)}
    </Box> : null}
  </Box>;
}

function NotChip({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)}
    className={focusRing + " px-2 py-0.5 border " + (value ? "border-[#147D78] bg-[#E7F6F2] dark:border-[#2DD4BF] dark:bg-[#153B3B]" : "border-outline-200 dark:border-[#2A3B52]")} style={{ minHeight: 24, justifyContent: "center" }}>
    <Text className={"text-xs font-semibold " + (value ? "text-[#147D78] dark:text-[#6ED5C4]" : "text-typography-600 dark:text-[#8A94A8]")}>NOT</Text>
  </Pressable>;
}

// "Run when" as rows joined by AND / OR / AND NOT / OR NOT / XOR, evaluated left to right.
// The value stays one condition string; text the builder can't split shows as a single row.
export function ConditionGroup({ value, onChange, showVariables }: { value: string; onChange: (value: string) => void; showVariables: boolean }) {
  const [group, setGroup] = React.useState<Group>(() => parseConditionGroup(value));
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const assist = useConditionCatalog();
  const built = buildConditionGroup(group);
  // Re-split only when the condition changed outside this editor (load, example, revert).
  React.useEffect(() => { if (value !== built) setGroup(parseConditionGroup(value)); }, [value]);

  const update = (next: Group) => { setGroup(next); onChange(buildConditionGroup(next)); };
  const setRow = (id: string, patch: Partial<ConditionRow>) => update({ ...group, rows: group.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const add = () => {
    const row = newRow();
    setFocusedId(row.id);
    update({ ...group, rows: [...group.rows, row], ops: [...group.ops, "and"] });
  };
  const remove = (at: number) => {
    // The joiner in front of a row goes with it; removing the first row drops the one after it.
    const ops = group.ops.filter((_, i) => i !== Math.max(0, at - 1));
    const rows = group.rows.filter((_, i) => i !== at);
    // "Negate result" is hidden for one row, so fold it into that row's NOT.
    if (rows.length === 1 && group.negate) update({ rows: [{ ...rows[0], not: !rows[0].not }], ops, negate: false });
    else update({ ...group, rows, ops });
  };

  const many = group.rows.length > 1;
  const variablesFor = group.rows.some((r) => r.id === focusedId) ? focusedId : group.rows[0].id;
  const preview = many || group.negate || group.rows[0].not;
  return <Box className="gap-2">
    {group.rows.map((row, at) => <Box key={row.id} className="gap-2">
      {at > 0 ? <JoinerPicker value={group.ops[at - 1] ?? "and"} onChange={(op) => update({ ...group, ops: group.ops.map((o, i) => (i === at - 1 ? op : o)) })} /> : null}
      <Box className="flex-row items-center gap-2">
        <NotChip value={row.not} label={`Negate condition ${at + 1}`} onChange={(not) => setRow(row.id, { not })} />
        {many ? <Text className={subtle + " mr-auto"}>Condition {at + 1}</Text> : <Box className="mr-auto" />}
        {many ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove condition ${at + 1}`} onPress={() => remove(at)} className={focusRing + " px-1"}>
          <Text className="text-xs font-semibold text-[#BA4F3D] dark:text-[#F4A293]">Remove</Text>
        </Pressable> : null}
      </Box>
      <ConditionInput value={row.text} label={many ? `Run when, condition ${at + 1}` : "Run when"} assist={assist}
        showVariables={showVariables && row.id === variablesFor} onFocus={() => setFocusedId(row.id)}
        onChange={(text) => setRow(row.id, { text })} />
    </Box>)}

    <Box className="flex-row items-center gap-3 flex-wrap">
      <Pressable accessibilityRole="button" onPress={add} className={focusRing + " px-1 mr-auto"} style={{ minHeight: 28, justifyContent: "center" }}>
        <Text className={link}>+ Add condition</Text>
      </Pressable>
      {many ? <Box className="flex-row items-center gap-2">
        <Text className={subtle}>Negate result</Text>
        <Switch accessibilityLabel="Negate the whole result" value={group.negate} onValueChange={(negate: boolean) => update({ ...group, negate })} />
      </Box> : null}
    </Box>

    {preview && built ? <Box className="gap-1 pl-3 border-l-2 border-outline-200 dark:border-[#2A3B52]">
      <Text className={subtle}>Full condition{many ? ", evaluated left to right" : ""}</Text>
      <Text selectable className={mono}>{built}</Text>
      {many ? <Text className={subtle}>A row that can't be read (missing stream, offline sender) makes the whole condition false, unless an earlier row already decided it.</Text> : null}
    </Box> : null}
  </Box>;
}
