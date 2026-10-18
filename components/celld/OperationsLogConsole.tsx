import React from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { CelldObservation } from "@/types/celld";
import { timestamp, unavailable } from "./observability";
import { OpsButton, OpsText, useOperationsTheme } from "./OperationsUI";
const breakText =
  Platform.OS === "web"
    ? ({
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      } as any)
    : {};

// Dense terminal rows keep the full message selectable; controls live in details.
export const LogMessage = React.memo(function LogMessage({
  row,
  onTrace,
}: {
  row: CelldObservation;
  onTrace: (id: string) => void;
}) {
  const { ops, s } = useOperationsTheme();
  const [expanded, setExpanded] = React.useState(false);
  const [copyState, setCopyState] = React.useState("");
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const record = row.record;
  const body = record?.body ?? unavailable;
  React.useEffect(() => {
    setCopyState("");
  }, [body]);
  const severity = record?.severity ?? record?.kind ?? "unknown";
  const failed = ["error", "fatal"].includes(severity.toLowerCase());
  const origin = record?.source === "otlp"
    ? "Application"
    : record?.source === "stdout" || record?.source === "stderr"
      ? `celld · ${record.source}`
      : record?.source === "container"
        ? "Container"
        : record?.source ?? unavailable;
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(body);
      if (mounted.current) setCopyState("Message copied.");
    } catch {
      if (mounted.current)
        setCopyState(
          "Clipboard unavailable. Select the message and copy it manually.",
        );
    }
  };
  const time = record?.time_ms == null
    ? "--:--:--"
    : new Date(record.time_ms).toLocaleTimeString(undefined, { hour12: false });
  const levelColor = failed ? ops.red : severity.toLowerCase() === "warn" ? ops.amber : ops.muted;
  return (
    <View style={{ minWidth: 0, backgroundColor: expanded ? ops.panel : "transparent" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", minWidth: 0, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`Inspect ${record?.kind ?? "record"}: ${body}`}
          onPress={() => setExpanded((old) => !old)}
          style={{ width: 22, minHeight: 20, alignItems: "center" }}
        >
          <Text style={{ color: expanded ? ops.accent : ops.muted, fontSize: 12, lineHeight: 20 }}>{expanded ? "▾" : "▸"}</Text>
        </Pressable>
        <Text selectable style={[s.mono, { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 20 }, breakText]}>
          <Text style={{ color: ops.muted }}>{time} </Text>
          <Text style={{ color: levelColor }}>{severity.toUpperCase().padEnd(5)} </Text>
          <Text style={{ color: ops.accent }}>{origin} </Text>
          <Text selectable accessibilityLabel="Full message" style={[{ color: failed ? ops.red : ops.text }, breakText]}>{body}</Text>
        </Text>
      </View>
      {expanded ? (
        <View
          style={{
            padding: 12,
            gap: 8,
            borderWidth: 1,
            borderColor: ops.line,
            borderRadius: 4,
            minWidth: 0,
          }}
        >
          <View style={s.row}>
            <OpsButton label="Copy message" onPress={() => { void copy(); }} />
            {record?.trace_id ? <OpsButton label="Open trace" onPress={() => onTrace(record.trace_id!)} /> : null}
            <OpsText mono>{row.node ?? unavailable}</OpsText>
          </View>
          {copyState ? <Text accessibilityLiveRegion="polite" style={s.muted}>{copyState}</Text> : null}
          <OpsText muted>
            Event time {timestamp(record?.time_ms)} · Received{" "}
            {timestamp(row.received_ms)}
          </OpsText>
          <OpsText mono style={breakText}>
            Source {record?.source ?? unavailable} · Record {row.id}
          </OpsText>
          <OpsText mono style={breakText}>
            Generation {row.generation ?? unavailable} · Workload{" "}
            {record?.workload ?? unavailable}
          </OpsText>
          {record?.trace_id ? (
            <OpsText mono style={breakText}>
              Trace {record.trace_id}
            </OpsText>
          ) : null}
          {record?.span_id ? (
            <OpsText mono style={breakText}>
              Span {record.span_id}
            </OpsText>
          ) : null}
          {Object.entries(record?.attributes ?? {}).map(([key, value]) => (
            <View key={key} style={{ gap: 2, minWidth: 0 }}>
              <OpsText muted mono>
                {key}
              </OpsText>
              <OpsText mono style={breakText}>
                {typeof value === "string"
                  ? value
                  : JSON.stringify(value, null, 2)}
              </OpsText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});


// Keep fetching independent from scroll position: reading history must never
// pull the reader back down. Reaching the end reattaches the viewport to new rows.
export function LogTerminal({ rows, onTrace }: {
  rows: CelldObservation[];
  onTrace: (id: string) => void;
}) {
  const { ops, s } = useOperationsTheme();
  const { height } = useWindowDimensions();
  const scroll = React.useRef<ScrollView>(null);
  const pinned = React.useRef(true);
  const [atBottom, setAtBottom] = React.useState(true);
  const tail = rows.at(-1)?.id;
  const scrollToTail = React.useCallback(() => {
    if (pinned.current) scroll.current?.scrollToEnd({ animated: false });
  }, []);
  React.useLayoutEffect(scrollToTail, [tail, rows.length, scrollToTail]);
  return (
    <View style={{ minWidth: 0 }}>
      <View style={[s.row, { justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderColor: ops.line }]}>
        <OpsText muted>{atBottom ? "At latest · auto-scroll on" : "Reading history · auto-scroll paused"}</OpsText>
        <OpsButton label="Jump to latest" disabled={atBottom} onPress={() => {
          pinned.current = true;
          setAtBottom(true);
          scrollToTail();
        }} />
      </View>
      <ScrollView
        ref={scroll}
        testID="log-terminal"
        accessibilityLabel="Log terminal"
        nestedScrollEnabled
        focusable
        accessibilityHint="Scroll up to read history. Jump to latest to resume auto-scroll."
        scrollEventThrottle={16}
        onContentSizeChange={scrollToTail}
        onLayout={scrollToTail}
        onScroll={({ nativeEvent: { contentOffset, layoutMeasurement, contentSize } }) => {
          const bottom = contentSize.height - contentOffset.y - layoutMeasurement.height <= 32;
          pinned.current = bottom;
          setAtBottom(bottom);
        }}
        style={[{ height: Math.max(220, Math.min(460, height * 0.5)), backgroundColor: ops.bg }, Platform.OS === "web" ? { overscrollBehavior: "contain" } as any : {}]}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {rows.map(row => <LogMessage key={row.id} row={row} onTrace={onTrace} />)}
      </ScrollView>
    </View>
  );
}
