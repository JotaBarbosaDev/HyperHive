import React from "react";
import { FlatList, Platform, Pressable, ScrollView, TextInput } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { Sample } from "@/types/support";
import { Action, ink, muted } from "./support-ui";
import { sampleText } from "./widget-format";

const logColors: Record<string, string> = { debug: "#8A94A8", info: "#6ED5C4", warn: "#F0CC80", error: "#F4A293", fatal: "#FF8D9B" };
const mono = { fontFamily: "monospace", fontSize: 12 };

const FeedLine = React.memo(function FeedLine({ sample, kind, wrap }: { sample: Sample; kind: "logs" | "events"; wrap: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const value = sample.value;
  const time = new Date(sample.received_at).toLocaleTimeString(undefined, { hour12: false });
  if (kind === "logs") {
    const severity = typeof value === "object" && "severity" in value ? value.severity : "info";
    return <Text size="xs" selectable className={"leading-[18px] " + (wrap ? "" : "web:whitespace-pre")} style={{ ...mono, color: "#E8EBF0", paddingHorizontal: 8 }}><Text size="xs" className="leading-[18px]" style={{ ...mono, color: "#8A94A8" }}>{time} </Text><Text size="xs" className="leading-[18px]" style={{ ...mono, color: logColors[severity] }}>{severity.toUpperCase().padEnd(5)} </Text>{sample.instance_id ? <Text size="xs" className="leading-[18px]" style={{ ...mono, color: "#8A94A8" }}>[{sample.instance_id}] </Text> : null}{typeof value === "object" && "message" in value ? value.message : sampleText(value)}</Text>;
  }
  const event = typeof value === "object" && "name" in value ? value : null;
  return <Box className="border-b border-outline-100 dark:border-[#26364A]" style={{ paddingVertical: 3, paddingHorizontal: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} event ${sample.id}`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} className="flex-row items-center gap-2 web:focus-visible:ring-2 web:focus-visible:ring-[#147D78]">
      <Text size="xs" className={muted} style={{ ...mono, fontSize: 10 }}>{time}</Text><Text size="xs" className={ink + " flex-1"} style={{ fontSize: 12 }} numberOfLines={1}>{event?.name ?? sampleText(value)}</Text><Text size="xs" className={muted} style={{ fontSize: 10 }}>{sample.instance_id ?? "App"} {expanded ? "▾" : "▸"}</Text>
    </Pressable>
    {expanded ? <Text size="xs" selectable className={ink + " leading-[18px]"} style={{ ...mono, padding: 6 }}>{new Date(sample.received_at).toLocaleString()}{"\n"}{event ? JSON.stringify(event.fields, null, 2) : sampleText(value)}</Text> : null}
  </Box>;
});

export function WidgetFeed({ samples, kind, retentionMs }: { samples: Sample[]; kind: "logs" | "events"; retentionMs: number }) {
  const [search, setSearch] = React.useState("");
  const [paused, setPaused] = React.useState<Sample[] | null>(null);
  const [following, setFollowing] = React.useState(true);
  const [wrap, setWrap] = React.useState(Platform.OS !== "web");
  const list = React.useRef<FlatList<Sample>>(null);
  const lastOffset = React.useRef(0);
  const lastContentHeight = React.useRef(0);
  React.useEffect(() => {
    if (!paused?.length) return;
    const nextExpiry = Math.min(...paused.map((sample) => Date.parse(sample.received_at) + retentionMs).filter((time) => time > Date.now()));
    if (!Number.isFinite(nextExpiry)) return;
    const timer = setTimeout(() => setPaused((current) => current?.filter((sample) => Date.parse(sample.received_at) + retentionMs > Date.now()) ?? null), Math.min(86400000, Math.max(1, nextExpiry - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [paused, retentionMs]);
  const records = (paused ?? samples).filter((sample) => Date.parse(sample.received_at) + retentionMs > Date.now() && (!search || [sampleText(sample.value), sample.instance_id ?? ""].join(" ").toLowerCase().includes(search.toLowerCase())));
  const rows = <FlatList ref={list} testID={`feed-${kind}`} data={records} keyExtractor={(sample) => String(sample.id)} renderItem={({ item }) => <FeedLine sample={item} kind={kind} wrap={wrap} />} initialNumToRender={30} maxToRenderPerBatch={30} windowSize={5} nestedScrollEnabled className={kind === "logs" && !wrap ? "web:min-w-max" : ""} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 5 }}
    onContentSizeChange={() => { if (following && !paused) list.current?.scrollToEnd({ animated: false }); }}
    onScroll={(event) => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; if (contentOffset.y < lastOffset.current - 2 && contentSize.height === lastContentHeight.current) setFollowing(false); else if (contentSize.height - contentOffset.y - layoutMeasurement.height < 24) setFollowing(true); lastOffset.current = contentOffset.y; lastContentHeight.current = contentSize.height; }} scrollEventThrottle={100}
    ListEmptyComponent={<Text size="xs" className="leading-[18px]" style={{ ...mono, padding: 8, color: kind === "logs" ? "#8A94A8" : "#637386" }}>{search ? "No loaded entries match." : "No retained entries."}</Text>} />;
  return <Box style={{ flex: 1, minHeight: 0, gap: 4 }}>
    <Box className="flex-row flex-wrap items-center gap-1">
      <TextInput accessibilityLabel={`Search loaded ${kind}`} placeholder={`Search loaded ${kind}`} value={search} onChangeText={setSearch} className="flex-1 text-typography-900 dark:text-[#E8EBF0] border-b border-outline-200" style={{ minWidth: 80, fontSize: 11, height: 24, paddingHorizontal: 3 }} />
      <Action compact label={paused ? "Resume" : "Pause"} selected={!!paused} onPress={() => { setPaused(paused ? null : [...samples]); setFollowing(!!paused); }} />
      {kind === "logs" ? <Action compact label={wrap ? "No wrap" : "Wrap"} selected={wrap} onPress={() => { lastOffset.current = 0; lastContentHeight.current = 0; setWrap(!wrap); }} /> : null}
      {!following && !paused ? <Action compact label="Follow live" onPress={() => { setFollowing(true); list.current?.scrollToEnd({ animated: false }); }} /> : null}
    </Box>
    <Box style={{ flex: 1, minHeight: 0, borderRadius: 5, overflow: "hidden", ...(kind === "logs" ? { backgroundColor: "#0A1620" } : {}) }}>
      {kind === "logs" && !wrap ? <ScrollView horizontal nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>{rows}</ScrollView> : rows}
    </Box>
    {paused ? <Text size="xs" className={muted} style={{ fontSize: 10 }}>View paused · incoming entries continue in the background</Text> : null}
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
