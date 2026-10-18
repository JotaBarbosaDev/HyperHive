import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react-native";
import { downloadCelldLogs } from "@/services/celld";
import { useCelldObservations } from "@/hooks/useCelldObservations";
import type { CelldObservation, CelldObservationQuery } from "@/types/celld";
import {
  bytes,
  duration,
  numberValue,
  timestamp,
  unavailable,
} from "./observability";
import {
  Empty,
  Notice,
  OpsButton,
  OpsField,
  OpsText,
  Panel,
  SectionIntro,
  Stat,
  Tone,
  useOperationsTheme,
} from "./OperationsUI";
import { parseQueryDraft, queryDraft, MAX_WINDOW_MS } from "./operations-query";
import { LogTerminal } from "./OperationsLogConsole";
import { ResourceChart } from "./OperationsCharts";

export function FleetRecords({
  token,
  fleetId,
  kind,
  initialTrace,
  initialQuery,
  onTrace,
  onStateChange,
}: {
  token: string;
  fleetId: string;
  kind: "logs" | "events" | "metrics" | "trace";
  initialTrace?: string;
  initialQuery?: CelldObservationQuery;
  onTrace: (id: string, query: CelldObservationQuery) => void;
  onStateChange?: (query: CelldObservationQuery, traceId?: string) => void;
}) {
  const { ops, s } = useOperationsTheme();
  const [advanced, setAdvanced] = React.useState(false);
  const [wrap, setWrap] = React.useState(true);
  const [query, setQuery] = React.useState<CelldObservationQuery>(
    () =>
      initialQuery ?? {
        from: Date.now() - 3600000,
        to: Date.now(),
        limit: 200,
        ...(kind === "logs" ? { source: "otlp" } : {}),
      },
  );
  const [draft, setDraft] = React.useState(() => queryDraft(query));
  const [trace, setTrace] = React.useState(initialTrace ?? "");
  const [traceDraft, setTraceDraft] = React.useState(initialTrace ?? "");
  const [follow, setFollow] = React.useState(kind === "logs" && !initialQuery);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [recordOffset, setRecordOffset] = React.useState(0);
  const [notice, setNotice] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const mounted = React.useRef(true);
  const exportRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      exportRef.current?.abort();
    };
  }, []);
  const { page, requests, error, busy, more, reload, transport } = useCelldObservations(
    token,
    fleetId,
    kind,
    query,
    follow,
    kind === "trace" ? trace : undefined,
  );
  React.useEffect(() => {
    const length = page?.records.length ?? 0;
    if (follow)
      setRecordOffset(Math.max(0, Math.floor((length - 1) / 100) * 100));
    else if (recordOffset >= length) setRecordOffset(0);
  }, [page?.records.length, recordOffset, follow]);
  const exportWindowKey = JSON.stringify(query);
  React.useEffect(() => {
    exportRef.current?.abort();
    setExporting(false);
    setNotice("");
  }, [exportWindowKey]);
  const change = (key: string, value: string) => {
    setDraft((old) => ({ ...old, [key]: value }));
    setLocalError(null);
    if (key === "from" || key === "to") setFollow(false);
  };
  const commit = (next: CelldObservationQuery) => {
    setLocalError(null);
    setNotice("");
    setRecordOffset(0);
    setFollow(false);
    setDraft(queryDraft(next));
    if (JSON.stringify(next) === JSON.stringify(query)) reload();
    else setQuery(next);
  };
  const apply = () => {
    try {
      const next = parseQueryDraft(draft);
      const id = traceDraft.trim();
      if (kind === "trace" && !/^[a-f0-9]{32}$/.test(id))
        throw new Error(
          "Enter a trace ID with 32 lowercase hexadecimal characters.",
        );
      setTrace(id);
      commit(next);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Check the filter values.",
      );
      setAdvanced(true);
    }
  };
  const preset = (hours: number) => {
    const to = Date.now(),
      from = to - hours * 3600000;
    commit({ ...query, from, to });
    setDraft({
      ...draft,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    });
  };
  const toggleFollow = () => {
    setLocalError(null);
    setNotice("");
    setFollow((old) => !old);
  };
  const clearFilters = () => {
    const to = Math.max(query.to, page?.to ?? query.to);
    commit({
      from: Math.max(query.from, to - MAX_WINDOW_MS),
      to,
      limit: query.limit ?? 200,
      ...(kind === "logs" ? { source: query.source } : {}),
    });
  };
  const effectiveQuery = {
    ...query,
    from: Math.max(
      query.from,
      Math.max(query.to, page?.to ?? query.to) - MAX_WINDOW_MS,
    ),
    to: Math.max(query.to, page?.to ?? query.to),
  };
  const rememberRef = React.useRef(onStateChange);
  rememberRef.current = onStateChange;
  const sessionKey = JSON.stringify(follow ? query : effectiveQuery);
  React.useEffect(() => {
    rememberRef.current?.(
      follow ? query : effectiveQuery,
      kind === "trace" ? trace : undefined,
    );
  }, [sessionKey, trace, kind, follow]);
  const openTrace = React.useCallback(
    (id: string) =>
      onTrace(id, {
        limit: query.limit,
        from: Math.max(
          query.from,
          Math.max(query.to, page?.to ?? query.to) - MAX_WINDOW_MS,
        ),
        to: Math.max(query.to, page?.to ?? query.to),
      }),
    [onTrace, query, page?.to],
  );
  const download = async () => {
    const request = new AbortController();
    exportRef.current = request;
    setExporting(true);
    setLocalError(null);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      request.abort();
    }, 20000);
    try {
      const content = await downloadCelldLogs(
        token,
        fleetId,
        effectiveQuery,
        request.signal,
      );
      if (request.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([content], { type: "application/x-ndjson" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `celld-${fleetId.replace(/[^a-zA-Z0-9_-]/g, "_")}-logs.ndjson`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        "Downloaded a bounded export: up to 2,000 lines / 1 MiB. It may not contain all matching logs.",
      );
    } catch (err) {
      if (
        mounted.current &&
        exportRef.current === request &&
        (!request.signal.aborted || timedOut)
      )
        setLocalError(
          timedOut
            ? "Export timed out. Try again."
            : err instanceof Error
              ? err.message
              : "Export failed.",
        );
    } finally {
      clearTimeout(timeout);
      if (mounted.current && exportRef.current === request) setExporting(false);
    }
  };
  const labels = {
    logs: [
      "Logs",
      "Your application output, separate from celld runtime logs. Expand a message to inspect its context.",
    ],
    events: ["Events", "Process lifecycle activity across your fleet."],
    metrics: ["Metrics", "Resource history and observed request performance."],
    trace: ["Trace explorer", "Correlate spans and logs for one request."],
  };
  const records = page?.records ?? [];
  const draftPending =
    JSON.stringify(draft) !== JSON.stringify(queryDraft(effectiveQuery)) ||
    (kind === "trace" && traceDraft.trim() !== trace);
  // Follow advances the applied window; keep untouched date fields in sync.
  React.useEffect(() => {
    if (!page) return;
    setDraft((old) => ({
      ...old,
      from:
        old.from === new Date(query.from).toISOString() || follow
          ? new Date(effectiveQuery.from).toISOString()
          : old.from,
      to:
        old.to === new Date(query.to).toISOString() || follow
          ? new Date(effectiveQuery.to).toISOString()
          : old.to,
    }));
  }, [page?.to, follow, query.from, query.to]);
  const spanStart = Math.min(
    ...records
      .filter(
        (r) => r.record?.kind === "span" && r.record.time_ms !== undefined,
      )
      .map((r) => r.record!.time_ms!),
  );
  const spanEnd = Math.max(
    ...records
      .filter(
        (r) => r.record?.kind === "span" && r.record.time_ms !== undefined,
      )
      .map((r) => r.record!.time_ms! + (r.record!.duration_us ?? 0) / 1000),
  );
  return (
    <View style={s.stack}>
      <SectionIntro
        title={labels[kind][0]}
        detail={labels[kind][1]}
        actions={
          <View style={s.row}>
            <OpsButton
              label="Reload window"
              icon={RefreshCw}
              disabled={busy || (kind === "trace" && !trace)}
              onPress={reload}
            />
            {kind === "logs" || kind === "events" ? (
              <OpsButton
                label={follow ? "Pause follow" : "Follow live"}
                active={follow}
                icon={follow ? Pause : Play}
                onPress={toggleFollow}
              />
            ) : null}
          </View>
        }
      />
      <View style={[s.panel, { padding: 14, gap: 12 }]}>
        {kind === "logs" ? (
          <View style={{ gap: 8 }}>
            <View style={s.row}>
              <OpsText muted>Show logs from</OpsText>
              {[
                ["Application", "otlp"],
                ["celld", "process"],
                ["Containers", "container"],
                ["All logs", ""],
              ].map(([label, source]) => (
                <OpsButton
                  key={label}
                  label={label}
                  active={(query.source ?? "") === source}
                  onPress={() => {
                    commit({
                      ...effectiveQuery,
                      source: source || undefined,
                      workload: undefined,
                    });
                    setFollow(follow);
                  }}
                />
              ))}
            </View>
            <OpsText muted>
              {query.source === "otlp"
                ? "Application · console.log, console.info, console.warn and console.error from your code."
                : query.source === "process"
                  ? "celld · runtime output from stdout and stderr."
                  : query.source === "container"
                    ? "Containers · output from containers running in this fleet."
                    : "Each message is labelled with its origin. Choose Application to hide celld runtime output."}
            </OpsText>
            {query.source === "otlp" && query.workload ? (
              <OpsText muted>
                Some application messages have no workload. Clear the Workload
                filter to include them.
              </OpsText>
            ) : null}
          </View>
        ) : null}
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View style={s.row}>
            <OpsText muted>Time range</OpsText>
            {[
              ["Last 15 min", 0.25],
              ["Last hour", 1],
              ["Last 24 hours", 24],
              ["Last 7 days", 168],
            ].map(([label, hours]) => (
              <OpsButton
                key={label}
                label={String(label)}
                active={
                  !follow && query.to - query.from === Number(hours) * 3600000
                }
                onPress={() => preset(Number(hours))}
              />
            ))}
          </View>
          <OpsButton
            label={advanced ? "Hide filters" : "More filters"}
            icon={Filter}
            active={advanced}
            onPress={() => setAdvanced(!advanced)}
          />
        </View>
        <View style={[s.row, { alignItems: "flex-end" }]}>
          {kind !== "metrics" ? (
            <OpsField
              search
              label="Search message"
              value={draft.text ?? ""}
              onChange={(v) => change("text", v)}
              onSubmit={apply}
              placeholder="Case-sensitive text…"
              maxLength={256}
            />
          ) : null}
          <OpsField
            label="Node"
            value={draft.node ?? ""}
            onChange={(v) => change("node", v)}
            onSubmit={apply}
            placeholder="All nodes"
          />
          <OpsField
            label="Workload"
            value={draft.workload ?? ""}
            onChange={(v) => change("workload", v)}
            onSubmit={apply}
            placeholder="All workloads"
          />
          <OpsButton label="Apply filters" active onPress={apply} />
          <OpsButton label="Clear filters" onPress={clearFilters} />
        </View>
        {kind === "trace" ? (
          <OpsField
            onSubmit={apply}
            standalone
            label="Trace ID"
            value={traceDraft}
            onChange={(value) => {
              setTraceDraft(value);
              setLocalError(null);
            }}
            placeholder="32 lowercase hexadecimal characters"
            maxLength={32}
          />
        ) : null}
        {advanced ? (
          <View
            style={{
              gap: 12,
              borderTopWidth: 1,
              borderColor: ops.line,
              paddingTop: 12,
            }}
          >
            <View style={s.row}>
              {[
                "from",
                "to",
                ...(kind === "metrics" ? [] : ["source", "severity"]),
                "limit",
              ].map((key) => (
                <OpsField
                  onSubmit={apply}
                  key={key}
                  label={
                    key === "from"
                      ? "From (UTC)"
                      : key === "to"
                        ? "To (UTC)"
                        : key === "severity"
                          ? "Severity (exact match)"
                          : key === "source"
                            ? "Source (exact match or process)"
                            : "Page size (1–500)"
                  }
                  value={draft[key] ?? ""}
                  onChange={(v) => change(key, v)}
                  placeholder={
                    key === "severity"
                      ? "e.g. ERROR"
                      : key === "source"
                        ? "otlp, process, stdout, stderr…"
                        : undefined
                  }
                />
              ))}
            </View>
            <OpsText muted>
              Custom dates use ISO UTC, e.g. 2026-10-18T12:00:00Z. Maximum
              interval: 7 days. Changes apply with Apply filters; quick time
              ranges apply immediately.
            </OpsText>
          </View>
        ) : null}
        <View style={s.row}>
          <OpsText muted>
            Applied window · {timestamp(effectiveQuery.from)} →{" "}
            {timestamp(effectiveQuery.to)}
          </OpsText>
          {query.node ? <OpsText mono>node={query.node}</OpsText> : null}
          {query.workload ? (
            <OpsText mono>workload={query.workload}</OpsText>
          ) : null}
          {query.text ? <OpsText mono>text={query.text}</OpsText> : null}
          {query.source ? <OpsText mono>source={query.source}</OpsText> : null}
          {query.severity ? (
            <OpsText mono>severity={query.severity}</OpsText>
          ) : null}
        </View>
      </View>
      {draftPending && !follow ? (
        <OpsText muted>
          Unapplied filter changes · press Enter or Apply filters to search.
        </OpsText>
      ) : null}
      <Notice error>
        {localError ?? (kind === "trace" && !trace ? null : error)}
      </Notice>
      <Notice error>{page?.error}</Notice>
      <Notice>{notice}</Notice>
      {follow ? (
        <Notice>
          {transport === "polling"
            ? "Polling fallback · this client or API does not support live streams. Updates every 2 seconds."
            : transport === "reconnecting"
              ? "Reconnecting live stream · existing messages are retained."
              : transport === "connecting"
                ? "Connecting live stream…"
                : "Live stream · messages arrive as they are collected."}
          {" "}Latest 2,000 records retained.
        </Notice>
      ) : null}
      {page?.incomplete ? (
        <OpsText muted>
          Partial observation coverage · results are not guaranteed fleet
          totals.
        </OpsText>
      ) : null}
      {kind === "metrics" ? (
        <>
          <Panel
            title="Observed requests"
            aside={
              <Tone
                value={
                  requests?.observed === false ? "unavailable" : "server spans"
                }
              />
            }
          >
            <View style={{ padding: 14, gap: 12 }}>
              <OpsText muted>
                Server spans across the selected interval, node and workload.
                These are observations, not fleet totals or percentiles.
              </OpsText>
              <Notice error>{requests?.error}</Notice>
              {requests?.observed === false ? (
                <Notice>
                  No request observations available in this interval.
                </Notice>
              ) : null}
              <View style={s.row}>
                <Stat label="Requests" value={numberValue(requests?.count)} />
                <Stat
                  label="Errors"
                  value={numberValue(requests?.errors)}
                  color={requests?.errors ? ops.red : undefined}
                />
                <Stat
                  label="Requests / second"
                  value={numberValue(requests?.rate_per_second)}
                />
                <Stat
                  label="Mean duration"
                  value={duration(requests?.mean_duration_us)}
                />
                <Stat
                  label="Max duration"
                  value={duration(requests?.max_duration_us)}
                />
              </View>
              {requests?.incomplete ? (
                <OpsText muted>Request summary has partial coverage.</OpsText>
              ) : null}
            </View>
          </Panel>
          <ResourceChart
            rows={records}
            metric="cpu_percent_x100"
            label="Process CPU"
            format={(v) =>
              v === undefined ? unavailable : `${numberValue(v / 100)}%`
            }
            from={effectiveQuery.from}
            to={effectiveQuery.to}
          />
          <ResourceChart
            rows={records}
            metric="rss_bytes"
            label="Resident memory"
            format={bytes}
            from={effectiveQuery.from}
            to={effectiveQuery.to}
          />
        </>
      ) : (
        <Panel
          title={
            kind === "logs"
              ? "Log stream"
              : kind === "events"
                ? "Lifecycle events"
                : "Spans & correlated logs"
          }
          aside={
            <View style={s.row}>
              <Tone value={follow ? "following" : "paused"} />
              <OpsText muted>{records.length} records</OpsText>
              {kind === "trace" ? (
                <OpsButton
                  label={wrap ? "Wrap: on" : "Wrap: off"}
                  active={wrap}
                  onPress={() => setWrap(!wrap)}
                />
              ) : (
                <OpsText muted>Terminal · full messages</OpsText>
              )}
              {kind === "logs" && Platform.OS === "web" ? (
                <OpsButton
                  label={exporting ? "Exporting…" : "Export NDJSON"}
                  icon={Download}
                  disabled={exporting || follow}
                  onPress={() => {
                    void download();
                  }}
                />
              ) : null}
            </View>
          }
        >
          {kind === "trace" &&
          page &&
          !records.some((r) => r.record?.kind === "span") ? (
            <View style={{ padding: 12 }}>
              <Notice>
                No spans available in this interval. A log may have a trace ID
                without a corresponding span.
              </Notice>
            </View>
          ) : null}
          {kind === "logs" || kind === "events" ? (
            <LogTerminal key={JSON.stringify(query)} rows={records} onTrace={openTrace} />
          ) : (
            <>
              <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
                <View style={{ flex: 1, minWidth: 940 }}>
                  <View
                    style={[s.tr, { minHeight: 33, backgroundColor: ops.bg }]}
                  >
                    {[
                      ["", 22],
                      ["Time (local)", 112],
                      ["Level / kind", 90],
                      ["Node / source", 170],
                    ].map(([label, width]) => (
                      <Text
                        key={label}
                        style={[s.th, { width: Number(width) }]}
                      >
                        {label}
                      </Text>
                    ))}
                    <Text style={[s.th, { flex: 1 }]}>
                      {kind === "trace" ? "Operation / timing" : "Message"}
                    </Text>
                  </View>
                  {records
                    .slice(recordOffset, recordOffset + 100)
                    .map((row) => (
                      <RecordRow
                        key={row.id}
                        row={row}
                        onTrace={openTrace}
                        wrap={wrap}
                        traceRange={
                          kind === "trace" ? [spanStart, spanEnd] : undefined
                        }
                      />
                    ))}
                </View>
              </ScrollView>
            </>
          )}
          {!records.length ? (
            <Empty
              title={
                busy
                  ? "Loading observations…"
                  : page
                    ? "No matching records"
                    : "Waiting for observations"
              }
              detail={
                kind === "trace" && !trace
                  ? "Enter a trace ID and apply filters, or open a trace from a log."
                  : "Try a wider time range or remove a filter."
              }
            />
          ) : null}
          <View
            style={[s.row, { padding: 12, justifyContent: "space-between" }]}
          >
            <OpsText muted>
              {kind === "logs" || kind === "events"
                ? records.length
                : records.length
                  ? `${recordOffset + 1}–${Math.min(recordOffset + 100, records.length)} of ${records.length}`
                  : "0"}{" "}
              buffered · max 2,000
            </OpsText>
            {kind !== "logs" && kind !== "events" && records.length > 100 ? (
              <View style={s.row}>
                <OpsButton
                  label="Previous rows"
                  disabled={follow || recordOffset === 0}
                  onPress={() =>
                    setRecordOffset((old) => Math.max(0, old - 100))
                  }
                />
                <OpsButton
                  label="Next rows"
                  disabled={follow || recordOffset + 100 >= records.length}
                  onPress={() => setRecordOffset((old) => old + 100)}
                />
              </View>
            ) : null}
          </View>
        </Panel>
      )}
      {busy ? (
        <Text accessibilityLiveRegion="polite" style={s.muted}>
          Loading observations…
        </Text>
      ) : null}
      {page?.next_cursor ? (
        <OpsButton label="Load next page" disabled={busy} onPress={more} />
      ) : null}
      {page?.truncated ? (
        <Notice>
          {page.next_cursor
            ? "More observations are available. Load the next page to continue this window."
            : "Results were limited without a continuation cursor. Narrow the interval or filters."}
        </Notice>
      ) : null}
    </View>
  );
}

const RecordRow = React.memo(function RecordRow({
  row,
  onTrace,
  wrap,
  traceRange,
}: {
  row: CelldObservation;
  onTrace: (id: string) => void;
  wrap: boolean;
  traceRange?: number[];
}) {
  const { ops, s } = useOperationsTheme();
  const [expanded, setExpanded] = React.useState(false);
  const record = row.record;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const failed =
    record?.failed || ["ERROR", "FATAL"].includes(record?.severity ?? "");
  const timed =
    record?.kind === "span" &&
    record.time_ms !== undefined &&
    record.duration_us !== undefined &&
    traceRange &&
    Number.isFinite(traceRange[0]);
  const spanWidth = timed
    ? Math.max(0.001, traceRange![1] - traceRange![0])
    : 1;
  const spanLeft = timed
    ? Math.max(
        0,
        Math.min(100, ((record!.time_ms! - traceRange![0]) / spanWidth) * 100),
      )
    : 0;
  return (
    <View style={{ borderBottomWidth: 1, borderColor: ops.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Inspect ${record?.kind ?? "record"}: ${record?.body ?? row.id}`}
        onPress={() => setExpanded(!expanded)}
        style={({ hovered, pressed }: any) => [
          s.tr,
          {
            borderBottomWidth: 0,
            alignItems: "flex-start",
            paddingVertical: 10,
            backgroundColor: expanded
              ? ops.raised
              : hovered || pressed
                ? ops.raised
                : undefined,
            borderLeftWidth: 2,
            borderLeftColor: failed ? ops.red : "transparent",
          },
        ]}
      >
        <Chevron
          size={14}
          color={ops.muted}
          style={{ width: 22, marginTop: 3 }}
        />
        <View style={{ width: 112 }}>
          <OpsText muted mono>
            {record?.time_ms === undefined
              ? unavailable
              : new Date(record.time_ms).toLocaleTimeString("en-GB", {
                  hour12: false,
                })}
          </OpsText>
        </View>
        <View style={{ width: 90, paddingTop: 3 }}>
          <Tone
            value={
              record?.severity ??
              (record?.failed ? "failed" : (record?.kind ?? "unknown"))
            }
          />
        </View>
        <View style={{ width: 170 }}>
          <OpsText mono>{row.node ?? unavailable}</OpsText>
          <OpsText muted>
            {record?.source ?? unavailable}
            {record?.workload ? ` · ${record.workload}` : ""}
          </OpsText>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text
            selectable
            numberOfLines={wrap ? undefined : 1}
            style={[s.mono, { color: failed ? ops.red : ops.text }]}
          >
            {record?.body ?? (record?.kind === "span" ? "Span" : unavailable)}
          </Text>
          {record?.kind === "span" ? (
            <View style={s.row}>
              <OpsText muted mono>
                {duration(record.duration_us)}
              </OpsText>
              <OpsText muted>
                {record.parent_span_id
                  ? `Parent ${record.parent_span_id}`
                  : "Root / parent unavailable"}
              </OpsText>
            </View>
          ) : null}
          {timed ? (
            <View
              style={{
                height: 9,
                backgroundColor: ops.bg,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: `${spanLeft}%`,
                  width: `${Math.min(100 - spanLeft, Math.max(0.5, (record!.duration_us! / 1000 / spanWidth) * 100))}%`,
                  height: 9,
                  backgroundColor: failed ? ops.red : ops.accent,
                  borderRadius: 2,
                }}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
      {expanded ? (
        <View
          style={{
            padding: 16,
            paddingLeft: 46,
            gap: 10,
            backgroundColor: ops.bg,
          }}
        >
          <OpsText muted>
            Event time {timestamp(record?.time_ms)} · Received{" "}
            {timestamp(row.received_ms)}
          </OpsText>
          <OpsText mono>Record {row.id}</OpsText>
          <OpsText mono>
            Workload {record?.workload ?? unavailable} · Generation{" "}
            {row.generation ?? unavailable}
          </OpsText>
          {record?.span_id ? (
            <OpsText mono>
              Span {record.span_id} · Parent{" "}
              {record.parent_span_id ?? unavailable} · Failed{" "}
              {record.failed === undefined
                ? unavailable
                : record.failed
                  ? "Yes"
                  : "No"}
            </OpsText>
          ) : null}
          {Object.entries(record?.attributes ?? {}).map(([key, value]) => (
            <View key={key} style={s.row}>
              <OpsText muted mono>
                {key}
              </OpsText>
              <OpsText mono>
                {typeof value === "string" ? value : JSON.stringify(value)}
              </OpsText>
            </View>
          ))}
          {record?.trace_id ? (
            <View style={s.row}>
              <OpsText mono>{record.trace_id}</OpsText>
              <OpsButton
                label="Open trace"
                onPress={() => onTrace(record.trace_id!)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});
