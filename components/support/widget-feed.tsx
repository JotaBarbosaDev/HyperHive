import React from "react";
import * as Clipboard from "expo-clipboard";
import { FlatList, Platform, Pressable, ScrollView, TextInput } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { Sample } from "@/types/support";
import { Action, Failure, ink, muted } from "./support-ui";
import { eventSummary, sampleText } from "./widget-format";
import { SupportDialog } from "./support-dialogs";
import { WidgetDetails } from "./widget-details";

const logColors: Record<string, string> = { debug: "#8A94A8", info: "#6ED5C4", warn: "#F0CC80", error: "#F4A293", fatal: "#FF8D9B" };
const mono = { fontFamily: "monospace", fontSize: 12 };

function EventDetails({ sample }: { sample: Sample }) {
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const event = typeof sample.value === "object" && "name" in sample.value ? sample.value : null;
  const fields = event?.name === "Network link changed" ? { ...event.fields, previous: event.fields.previous === null ? "Not present" : event.fields.previous, state: event.fields.state === null ? "Not present" : event.fields.state } : event?.name === "Mounts changed" ? Object.fromEntries(Object.entries(event.fields).map(([key, value]) => [key, ["added", "removed"].includes(key) && Array.isArray(value) ? value.map((mount) => Array.isArray(mount) ? { device: mount[0], mount_point: mount[1], filesystem_type: mount[2] } : mount) : value])) : event?.fields;
  return <Box className="gap-4">
    <Text selectable className={ink + " web:break-words"}>{eventSummary(sample.value) || "See reported fields below."}</Text>
    <WidgetDetails value={{ sender: sample.instance_id ?? "App (no named instance)", source_time: new Date(sample.timestamp).toLocaleString(), received_at: new Date(sample.received_at).toLocaleString(), stream: sample.stream, event_id: sample.id }} />
    <Box className="gap-2"><Text className={ink + " font-semibold"}>Reported fields</Text>{event && Object.keys(event.fields).length ? <WidgetDetails value={fields} /> : <Text className={muted}>No structured fields were reported.</Text>}</Box>
    <Action compact label={copied ? "Event JSON copied" : "Copy event JSON"} onPress={() => { void Clipboard.setStringAsync(JSON.stringify(sample, null, 2)).then(() => { setCopied(true); setError(null); }).catch(() => setError("Unable to copy. Select the details and copy them manually.")); }} />
    <Failure message={error} />
  </Box>;
}

const FeedLine = React.memo(function FeedLine({ sample, kind, wrap, onInspect, selected }: { sample: Sample; kind: "logs" | "events"; wrap: boolean; onInspect?: (id: number) => void; selected?: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const value = sample.value;
  const time = new Date(sample.received_at).toLocaleTimeString(undefined, { hour12: false });
  if (kind === "logs") {
    const severity = typeof value === "object" && "severity" in value ? value.severity : "info";
    const line = <Text size="xs" selectable={!onInspect} className={"leading-[18px] " + (wrap ? "" : "web:whitespace-pre")} style={{ ...mono, color: "#E8EBF0", paddingHorizontal: 8 }}><Text size="xs" className="leading-[18px]" style={{ ...mono, color: "#8A94A8" }}>{time} </Text><Text size="xs" className="leading-[18px]" style={{ ...mono, color: logColors[severity] }}>{severity.toUpperCase().padEnd(5)} </Text>{sample.instance_id ? <Text size="xs" className="leading-[18px]" style={{ ...mono, color: "#8A94A8" }}>[{sample.instance_id}] </Text> : null}{typeof value === "object" && "message" in value ? value.message : sampleText(value)}</Text>;
    return onInspect ? <Pressable accessibilityRole="button" accessibilityLabel={`Inspect log ${sample.id}`} accessibilityState={{ selected }} onPress={() => onInspect(sample.id)} className="web:focus-visible:ring-2 web:focus-visible:ring-[#6ED5C4]" style={{ paddingVertical: 5, backgroundColor: selected ? "#153B3B" : "transparent", borderLeftWidth: 2, borderLeftColor: selected ? "#6ED5C4" : "transparent" }}>{line}</Pressable> : line;
  }
  const event = typeof value === "object" && "name" in value ? value : null;
  return <Box className="border-b border-outline-100 dark:border-[#26364A]" style={{ paddingVertical: 3, paddingHorizontal: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${onInspect ? "Inspect" : expanded ? "Collapse" : "Expand"} event ${sample.id}`} accessibilityState={onInspect ? { selected } : { expanded }} onPress={() => onInspect ? onInspect(sample.id) : setExpanded(!expanded)} className="gap-1 web:focus-visible:ring-2 web:focus-visible:ring-[#147D78]" style={{ paddingVertical: 6, paddingHorizontal: 4, minHeight: 44, ...(selected ? { borderLeftWidth: 2, borderLeftColor: "#147D78" } : {}) }}>
      <Box className="flex-row items-center gap-2"><Text size="xs" className={ink + " flex-1 font-semibold"} style={{ fontSize: 12 }}>{event?.name ?? "Event"}</Text><Text size="xs" className={muted}>›</Text></Box>
      <Text size="xs" className={ink + " web:break-words"} style={{ fontSize: 12 }} numberOfLines={2}>{eventSummary(value) || "Open for reported fields"}</Text>
      <Text size="xs" className={muted} style={{ fontSize: 11 }}>{new Date(sample.received_at).toLocaleDateString()} · {time} · {sample.instance_id ?? "App"}</Text>
    </Pressable>
    {expanded ? <SupportDialog title={event?.name ?? "Event details"} onClose={() => setExpanded(false)} footer={<Action label="Close event details" onPress={() => setExpanded(false)} />}><EventDetails sample={sample} /></SupportDialog> : null}
  </Box>;
});

export function WidgetFeed({ samples, kind, retentionMs, detailed = false }: { samples: Sample[]; kind: "logs" | "events"; retentionMs: number; detailed?: boolean }) {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [copyState, setCopyState] = React.useState("");
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [following, setFollowing] = React.useState(true);
  const [wrap, setWrap] = React.useState(detailed || Platform.OS !== "web");
  const list = React.useRef<FlatList<Sample>>(null);
  const lastOffset = React.useRef(0);
  const lastContentHeight = React.useRef(0);
  const records = samples.filter((sample) => Date.parse(sample.received_at) + retentionMs > Date.now() && (!search || [sampleText(sample.value), sample.instance_id ?? ""].join(" ").toLowerCase().includes(search.toLowerCase())));
  const selected = records.find((sample) => sample.id === selectedId);
  const inspect = React.useCallback((id: number) => { setSelectedId(id); setCopyState(""); setCopyError(null); }, []);
  const copy = async (value: string, label: string) => {
    try { await Clipboard.setStringAsync(value); setCopyState(label); setCopyError(null); }
    catch { setCopyError("Unable to copy. Select the details and copy them manually."); }
  };
  const rows = <FlatList ref={list} testID={`feed-${kind}`} data={records} extraData={selectedId} keyExtractor={(sample) => String(sample.id)} renderItem={({ item }) => <FeedLine sample={item} kind={kind} wrap={wrap} onInspect={detailed ? inspect : undefined} selected={selectedId === item.id} />} initialNumToRender={30} maxToRenderPerBatch={30} windowSize={5} nestedScrollEnabled className={kind === "logs" && !wrap ? "web:min-w-max" : ""} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 5 }}
    onContentSizeChange={() => { if (following) list.current?.scrollToEnd({ animated: false }); }}
    onScroll={(event) => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; if (contentOffset.y < lastOffset.current - 2 && contentSize.height === lastContentHeight.current) setFollowing(false); else if (contentSize.height - contentOffset.y - layoutMeasurement.height < 24) setFollowing(true); lastOffset.current = contentOffset.y; lastContentHeight.current = contentSize.height; }} scrollEventThrottle={100}
    ListEmptyComponent={<Text size="xs" className="leading-[18px]" style={{ ...mono, padding: 8, color: kind === "logs" ? "#8A94A8" : "#637386" }}>{search ? "No loaded entries match." : "No retained entries."}</Text>} />;
  return <Box style={{ flex: 1, minHeight: 0, gap: 4 }}>
    <Box className="flex-row flex-wrap items-center gap-1">
      <TextInput accessibilityLabel={`Search loaded ${kind}`} placeholder={`Search loaded ${kind}`} value={search} onChangeText={setSearch} className="flex-1 text-typography-900 dark:text-[#E8EBF0] border-b border-outline-200" style={{ minWidth: 80, fontSize: 11, height: 24, paddingHorizontal: 3 }} />
      {kind === "logs" ? <Action compact label={wrap ? "No wrap" : "Wrap"} selected={wrap} onPress={() => { lastOffset.current = 0; lastContentHeight.current = 0; setWrap(!wrap); }} /> : null}
      {!following ? <Action compact label="Follow live" onPress={() => { setFollowing(true); list.current?.scrollToEnd({ animated: false }); }} /> : null}
    </Box>
    <Box style={{ flex: 1, minHeight: 0, borderRadius: 5, overflow: "hidden", ...(kind === "logs" ? { backgroundColor: "#0A1620" } : {}) }}>
      {kind === "logs" && !wrap ? <ScrollView horizontal nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>{rows}</ScrollView> : rows}
    </Box>
    {detailed && selected && kind === "events" ? <Box testID="event-entry-details" className="border border-outline-200 dark:border-[#26364A] rounded-lg" style={{ maxHeight: "55%", minHeight: 100 }}>
      <Box className="flex-row items-center gap-2 p-3 border-b border-outline-200 dark:border-[#26364A]"><Text className={ink + " font-semibold flex-1"}>{typeof selected.value === "object" && "name" in selected.value ? selected.value.name : "Event details"}</Text><Action compact label="Close event details" onPress={() => setSelectedId(null)} /></Box>
      <ScrollView style={{ flexShrink: 1 }}><Box className="p-3"><EventDetails key={selected.id} sample={selected} /></Box></ScrollView>
    </Box> : null}
    {detailed && selected && kind === "logs" ? <Box testID="log-entry-details" className="border border-outline-200 dark:border-[#26364A] rounded-lg" style={{ maxHeight: "45%", minHeight: 100 }}>
      <Box className="flex-row flex-wrap items-center gap-2 p-3 border-b border-outline-200 dark:border-[#26364A]"><Text className={ink + " font-semibold flex-1"}>Entry #{selected.id}</Text><Action compact label="Copy message" onPress={() => { void copy(typeof selected.value === "object" && "message" in selected.value ? selected.value.message : sampleText(selected.value), "Message copied"); }} /><Action compact label="Copy JSON" onPress={() => { void copy(JSON.stringify(selected, null, 2), "JSON copied"); }} /><Action compact label="Close entry details" onPress={() => setSelectedId(null)} /></Box>
      <ScrollView style={{ flexShrink: 1 }}><Box className="p-3 gap-3"><WidgetDetails value={{ ...(typeof selected.value === "object" ? selected.value : { value: selected.value }), sender: selected.instance_id ?? "App", timestamp: selected.timestamp, received_at: selected.received_at, stream: selected.stream, app_id: selected.app_id }} />{copyState ? <Text accessibilityLiveRegion="polite" className={muted}>{copyState}</Text> : null}<Failure message={copyError} /></Box></ScrollView>
    </Box> : null}
  </Box>;
}

export function WidgetTable({ samples }: { samples: Sample[] }) {
  const [search, setSearch] = React.useState("");
  const [newestFirst, setNewestFirst] = React.useState(true);
  const records = samples.filter((sample) => [sampleText(sample.value), sample.instance_id ?? ""].join(" ").toLowerCase().includes(search.toLowerCase()));
  if (newestFirst) records.reverse();
  return <Box style={{ flex: 1, minHeight: 0, gap: 3 }}>
    <Box className="flex-row flex-wrap items-center gap-1"><TextInput accessibilityLabel="Search loaded samples" placeholder="Search loaded samples" value={search} onChangeText={setSearch} className="flex-1 text-typography-900 dark:text-[#E8EBF0] border-b border-outline-200" style={{ minWidth: 80, fontSize: 11, height: 24 }} /><Action compact label={newestFirst ? "Newest first" : "Oldest first"} onPress={() => setNewestFirst(!newestFirst)} /></Box>
    <ScrollView horizontal nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}><Box style={{ minWidth: 320, flex: 1 }}>
    <Box className="flex-row border-b border-outline-200 dark:border-[#26364A]" style={{ paddingVertical: 3 }}><Text size="xs" className={muted} style={{ width: 106, fontSize: 10 }}>Received</Text><Text size="xs" className={muted} style={{ width: 70, fontSize: 10 }}>Sender</Text><Text size="xs" className={muted} style={{ flex: 1, fontSize: 10 }}>Value</Text></Box>
    <FlatList testID="sample-table" data={records} keyExtractor={(sample) => String(sample.id)} initialNumToRender={30} maxToRenderPerBatch={30} windowSize={5} nestedScrollEnabled style={{ flex: 1 }} renderItem={({ item, index }) => <Box className={index % 2 ? "bg-background-50 dark:bg-[#152334]" : ""} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 3 }}>
      <Text size="xs" selectable accessibilityLabel={`Received ${new Date(item.received_at).toLocaleString()}`} className={muted + " leading-[18px]"} style={{ width: 106, fontSize: 10 }}>{new Date(item.received_at).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</Text>
      <Text size="xs" selectable className={muted + " leading-[18px]"} style={{ width: 70, fontSize: 10 }}>{item.instance_id ?? "App"}</Text><Text size="xs" selectable className={ink + " leading-[18px]"} style={{ flex: 1, minWidth: 0, ...mono }}>{sampleText(item.value)}</Text>
    </Box>} ListEmptyComponent={<Text size="xs" className={muted} style={{ fontSize: 11 }}>No loaded samples match.</Text>} />
    </Box></ScrollView>
  </Box>;
}
