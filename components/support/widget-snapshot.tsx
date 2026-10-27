import React from "react";
import { FlatList, PanResponder, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { Sample } from "@/types/support";
import { Action, ink, muted } from "./support-ui";
import { SupportDialog } from "./support-dialogs";
import { WidgetDetails } from "./widget-details";
import { measurementText } from "./widget-format";

type RecordRow = Record<string, unknown>;
const preferredColumns: Record<string, string[]> = {
  filesystems: ["mount_point", "usage_percent", "capacity_bytes", "available_bytes", "device", "filesystem_type"],
  top_processes: ["pid", "name", "cpu_percent", "resident_memory_bytes"],
  network_interfaces: ["name", "link_state", "receive_bytes_per_second", "transmit_bytes_per_second", "ip_addresses"],
  services: ["unit", "active_state", "substate", "restart_count", "result"],
  hardware: ["sensor", "value", "device", "passed", "available", "category"],
};
const labels: Record<string, string> = { pid: "PID", name: "Name", cpu_percent: "CPU %", resident_memory_bytes: "Memory", mount_point: "Mount", usage_percent: "Used", capacity_bytes: "Capacity", available_bytes: "Available", receive_bytes_per_second: "Receive/s", transmit_bytes_per_second: "Transmit/s", ip_addresses: "IP addresses", link_state: "Link", active_state: "State", restart_count: "Restarts", passed: "SMART passed" };
const label = (key: string) => labels[key] ?? key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
const isRecord = (value: unknown): value is RecordRow => !!value && typeof value === "object" && !Array.isArray(value);
const clampWidth = (value: number) => Math.max(48, Math.min(1600, value));

export function parseColumnWidths(raw: string | null): Record<string, number> {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    return isRecord(value) ? Object.fromEntries(Object.entries(value).filter(([, width]) => typeof width === "number" && Number.isFinite(width)).map(([key, width]) => [key, clampWidth(width as number)])) : {};
  } catch { return {}; }
}

function SnapshotColumn({ name, width, sortLabel, onSort, onResize }: { name: string; width: number; sortLabel: string; onSort: () => void; onResize: (width: number) => void }) {
  const current = React.useRef({ width, onResize }); current.current = { width, onResize };
  const origin = React.useRef(width);
  const resize = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { origin.current = current.current.width; },
    onPanResponderMove: (_event, gesture) => current.current.onResize(clampWidth(origin.current + gesture.dx)),
    onPanResponderRelease: (_event, gesture) => current.current.onResize(clampWidth(origin.current + gesture.dx)),
    onPanResponderTerminationRequest: () => false,
  }).panHandlers, []);
  const keyboard = Platform.OS === "web" ? { tabIndex: 0 as const, "aria-valuemin": 48, "aria-valuemax": 1600, "aria-valuenow": width, "aria-valuetext": `${width} pixels`, onKeyDown: (event: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    onResize(event.key === "Home" ? 48 : event.key === "End" ? 1600 : clampWidth(width + (event.key === "ArrowRight" ? 16 : -16)));
  } } : {};
  return <Box style={{ width, flexShrink: 0, position: "relative" }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Sort by ${name}`} onPress={onSort} className="web:focus-visible:ring-2 web:focus-visible:ring-[#147D78]" style={{ padding: 8, paddingRight: 14 }}><Text size="xs" numberOfLines={1} className={muted + " font-semibold"} style={{ fontSize: 12 }}>{name}{sortLabel}</Text></Pressable>
    <View {...resize} {...keyboard} accessibilityRole="adjustable" accessibilityLabel={`Resize ${name} column`} accessibilityHint="Drag horizontally or use left and right arrow keys to change column width" accessibilityValue={{ min: 48, max: 1600, now: width }} className="web:cursor-col-resize web:touch-none web:select-none web:focus-visible:ring-2 web:focus-visible:ring-[#147D78]" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 12, alignItems: "center", justifyContent: "center" }}><Box className="bg-outline-300 dark:bg-[#637386]" style={{ width: 2, height: 18 }} /></View>
  </Box>;
}

export function snapshotRows(stream: string, fields: RecordRow): RecordRow[] {
  let items = Array.isArray(fields.items) ? fields.items.filter(isRecord) : [];
  if (stream === "hardware" && !Array.isArray(fields.items)) items = Object.entries(fields).flatMap(([category, values]) => Array.isArray(values) ? values.filter(isRecord).map((row) => ({ ...row, category })) : []);
  return items.map((row) => {
    if (stream === "filesystems" && typeof row.capacity_bytes === "number" && row.capacity_bytes > 0 && Number.isFinite(row.capacity_bytes) && typeof row.free_bytes === "number" && Number.isFinite(row.free_bytes)) return { ...row, usage_percent: Math.max(0, Math.min(100, (row.capacity_bytes - row.free_bytes) / row.capacity_bytes * 100)) };
    return row;
  });
}

function rowKey(row: RecordRow): string {
  return JSON.stringify([row.category, row.pid, row.name, row.mount_point, row.device, row.unit, row.sensor]);
}
function rowName(row: RecordRow): string {
  return String(row.mount_point ?? row.sensor ?? row.device ?? row.name ?? row.unit ?? "Item") + (row.pid != null ? ` (PID ${row.pid})` : "");
}
function cellText(row: RecordRow, key: string): string {
  const value = row[key];
  if (value == null) return "—";
  if (key === "pid") return String(value);
  if (key === "value" && typeof value === "number" && row.unit === "millidegrees_celsius") return measurementText(value / 1000, "°C");
  if (key === "value" && typeof value === "number" && row.unit === "rpm") return measurementText(value, "rpm");
  if (typeof value === "number") return measurementText(value, key.endsWith("_bytes") ? "bytes" : key.endsWith("_bytes_per_second") ? "bytes/s" : key.endsWith("_percent") ? "%" : undefined);
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ");
  return typeof value === "boolean" ? value ? "Yes" : "No" : typeof value === "object" ? JSON.stringify(value) : String(value);
}

export const WidgetSnapshot = React.memo(function WidgetSnapshot({ sample, stream, storageKey = `${sample.app_id}:${stream}` }: { sample: Sample; stream: string; storageKey?: string }) {
  const localKey = `hyperhive.support.columns:${storageKey}`;
  const [widths, setWidths] = React.useState<Record<string, number>>(() => {
    try { return Platform.OS === "web" ? parseColumnWidths(window.localStorage.getItem(localKey)) : {}; }
    catch { return {}; }
  });
  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const timer = setTimeout(() => {
      try { window.localStorage.setItem(localKey, JSON.stringify(widths)); }
      catch { /* Storage can be blocked; resizing still works for this session. */ }
    }, 150);
    return () => clearTimeout(timer);
  }, [localKey, widths]);
  const [search, setSearch] = React.useState("");
  const [allColumns, setAllColumns] = React.useState(false);
  const [sort, setSort] = React.useState<{ key: string; descending: boolean } | null>(stream === "top_processes" ? { key: "cpu_percent", descending: true } : null);
  const [selected, setSelected] = React.useState<{ key: string; name: string; instance: string | null } | null>(null);
  const fields = isRecord(sample.value) && "fields" in sample.value && isRecord(sample.value.fields) ? sample.value.fields : {};
  const rows = snapshotRows(stream, fields);
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const primary = (preferredColumns[stream] ?? keys.slice(0, 4)).filter((key) => keys.includes(key));
  const columns = allColumns || !primary.length ? [...primary, ...keys.filter((key) => !primary.includes(key))] : primary;
  const query = search.toLowerCase();
  const filtered = query ? rows.filter((row) => Object.keys(row).some((key) => cellText(row, key).toLowerCase().includes(query))) : [...rows];
  if (sort) filtered.sort((a, b) => {
    const first = a[sort.key], second = b[sort.key];
    if (first == null) return second == null ? 0 : 1;
    if (second == null) return -1;
    const order = typeof first === "number" && typeof second === "number" ? first - second : String(first).localeCompare(String(second), undefined, { numeric: true });
    return sort.descending ? -order : order;
  });
  const detail = selected?.instance === sample.instance_id ? rows.find((row) => rowKey(row) === selected.key) : undefined;
  const width = (key: string) => {
    if (typeof widths[key] === "number") return widths[key];
    if (stream === "top_processes") return ({ pid: 60, name: 115, cpu_percent: 75, resident_memory_bytes: 95 } as Record<string, number>)[key] ?? 125;
    if (stream === "hardware" && key === "sensor") return 190;
    if (stream === "hardware" && key === "value") return 100;
    return ["name", "unit", "device", "ip_addresses", "mount_point"].includes(key) ? 200 : 125;
  };
  const tableWidth = columns.reduce((sum, key) => sum + width(key), 0);
  const metadata = Object.fromEntries(Object.entries(fields).filter(([key, value]) => key !== "items" && !Array.isArray(value)));
  return <Box style={{ flex: 1, minHeight: 0, gap: 6 }}>
    <Box className="flex-row items-center gap-2"><TextInput accessibilityLabel={`Search ${stream}`} placeholder="Filter rows…" value={search} onChangeText={setSearch} className="flex-1 min-w-0 rounded border border-outline-200 dark:border-[#26364A] text-typography-900 dark:text-[#E8EBF0]" style={{ height: 32, paddingHorizontal: 8, fontSize: 12 }} /><Text size="xs" className={muted}>{filtered.length}/{rows.length} rows</Text>{primary.length && keys.length > primary.length ? <Action compact label={allColumns ? "Key columns" : "All columns"} onPress={() => setAllColumns(!allColumns)} /> : null}</Box>
    <Text size="xs" className={muted} style={{ fontSize: 11 }}>Updated {new Date(sample.received_at).toLocaleTimeString()} · {sample.instance_id ?? "App"} · Select a row for live details</Text>
    <ScrollView horizontal nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}><Box style={{ flex: 1, minWidth: Math.max(320, tableWidth) }}>
      <Box className="flex-row border-b border-outline-200 dark:border-[#26364A]">{columns.map((key) => <SnapshotColumn key={key} name={label(key)} width={width(key)} sortLabel={sort?.key === key ? sort.descending ? " ↓" : " ↑" : ""} onSort={() => setSort({ key, descending: sort?.key === key ? !sort.descending : false })} onResize={(value) => setWidths((previous) => ({ ...previous, [key]: value }))} />)}</Box>
      <FlatList testID="snapshot-table" data={filtered} keyExtractor={rowKey} initialNumToRender={20} maxToRenderPerBatch={20} windowSize={5} nestedScrollEnabled style={{ flex: 1 }} renderItem={({ item, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${rowName(item)}`} onPress={() => setSelected({ key: rowKey(item), name: rowName(item), instance: sample.instance_id })} className={"flex-row items-center border-b border-outline-100 dark:border-[#26364A] web:hover:bg-background-100 dark:web:hover:bg-[#1D3044] web:focus-visible:ring-2 web:focus-visible:ring-[#147D78] " + (index % 2 ? "bg-background-50 dark:bg-[#152334]" : "")} style={{ minHeight: 44 }}>
        {columns.map((key) => <Box key={key} style={{ width: width(key), flexShrink: 0, padding: 8, gap: 4 }}><Text size="xs" numberOfLines={1} className={ink + " leading-[18px]"} style={{ fontSize: 12 }}>{cellText(item, key)}</Text>{key === "usage_percent" && typeof item[key] === "number" ? <Box accessibilityRole="progressbar" accessibilityLabel={`${rowName(item)} filesystem usage`} accessibilityValue={{ min: 0, max: 100, now: item[key] }} className="bg-background-200 dark:bg-[#26364A]" style={{ height: 6, borderRadius: 3, overflow: "hidden" }}><Box style={{ height: 6, width: `${item[key]}%`, backgroundColor: item[key] >= 90 ? "#D35445" : item[key] >= 75 ? "#B7791F" : "#147D78" }} /></Box> : null}</Box>)}
      </Pressable>} ListEmptyComponent={<Text size="xs" className={muted} style={{ padding: 12 }}>{rows.length ? "No rows match your filter." : "No items in the latest snapshot."}</Text>} />
    </Box></ScrollView>
    {!rows.length && Object.keys(metadata).length ? <WidgetDetails value={metadata} /> : null}
    {selected ? <SupportDialog title={selected.name} onClose={() => setSelected(null)} footer={<Action label="Close" onPress={() => setSelected(null)} />}>
      <Text size="xs" className={muted}>Latest snapshot · {new Date(sample.received_at).toLocaleString()} · {sample.instance_id ?? "App"}</Text>
      {detail ? <WidgetDetails value={detail} /> : <Text className={muted}>This item is no longer present in the latest snapshot.</Text>}
    </SupportDialog> : null}
  </Box>;
});
