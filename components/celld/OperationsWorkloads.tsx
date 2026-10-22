import React from "react";
import { Pressable, Text, View } from "react-native";
import { RefreshCw, X } from "lucide-react-native";
import { getCelldObservability } from "@/services/celld";
import { usePollingResource } from "@/hooks/usePollingResource";
import { bytes, numberValue, timestamp, unavailable } from "./observability";
import {
  Empty,
  Notice,
  OpsButton,
  OpsField,
  OpsText,
  Panel,
  SectionIntro,
  Tone,
  useOperationsTheme,
} from "./OperationsUI";
import {
  selectWorkloads,
  workloadInventory,
  type WorkloadEntry,
  type WorkloadScope,
} from "./operations-workloads";
import type { InspectTarget } from "./OperationsOverview";

export function FleetWorkloads({
  token,
  fleetId,
  initialNode,
  onNodeChange,
  onNavigate,
}: {
  token: string;
  fleetId: string;
  initialNode?: string;
  onNodeChange?: (node: string) => void;
  onNavigate?: InspectTarget;
}) {
  const { ops, s } = useOperationsTheme();
  const loader = React.useCallback(
    (auth: string, signal: AbortSignal) =>
      getCelldObservability(auth, fleetId, signal),
    [fleetId],
  );
  const { data, error, isRefreshing, refresh, updatedAt } = usePollingResource(
    loader,
    token,
    false,
    2000,
  );
  const [scope, setScope] = React.useState<WorkloadScope>("runtime");
  const [search, setSearch] = React.useState("");
  const [node, setNode] = React.useState(initialNode ?? "");
  const [kind, setKind] = React.useState("");
  const [sort, setSort] = React.useState<"name" | "memory" | "cpu">("name");
  const [offset, setOffset] = React.useState(0);
  const [selected, setSelected] = React.useState<string | null>(null);
  React.useEffect(() => {
    setNode(initialNode ?? "");
  }, [initialNode]);
  React.useEffect(() => {
    setOffset(0);
  }, [scope, search, node, kind, sort]);
  const rows = React.useMemo(
    () => workloadInventory(data ?? { fleet_id: fleetId }, scope),
    [data, fleetId, scope],
  );
  const kinds = React.useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.workload.kind)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [rows],
  );
  const filtered = React.useMemo(
    () =>
      selectWorkloads(
        rows,
        search,
        scope === "runtime" ? node : "",
        kind,
        sort,
      ),
    [rows, search, node, scope, kind, sort],
  );
  const pageOffset = offset >= filtered.length ? 0 : offset;
  const inspected = rows.find((row) => row.key === selected);
  const changeNode = (value: string) => {
    setNode(value);
    onNodeChange?.(value);
  };
  const inspect = (tab: "logs" | "metrics", row: WorkloadEntry) => {
    const to = Date.now();
    onNavigate?.(tab, {
      from: to - 3600000,
      to,
      limit: 200,
      node: row.node,
      workload: row.workload.id,
    });
  };
  return (
    <View style={s.stack}>
      <SectionIntro
        title="Workloads"
        detail="Find runtime instances, inspect resource use and follow their logs."
        actions={
          <OpsButton
            label="Refresh workloads"
            icon={RefreshCw}
            disabled={isRefreshing}
            onPress={() => {
              void refresh();
            }}
          />
        }
      />
      <Notice error>{error}</Notice>
      <Notice error>{data?.error}</Notice>
      {data?.historical ? (
        <Notice>
          Historical fleet · retained workload observations are read-only.
        </Notice>
      ) : null}
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View style={s.row}>
          <OpsButton
            label="Runtime inventory"
            active={scope === "runtime"}
            onPress={() => {
              setScope("runtime");
              setKind("");
              setSelected(null);
            }}
          />
          <OpsButton
            label="Configuration & bindings"
            active={scope === "configuration"}
            onPress={() => {
              setScope("configuration");
              setKind("");
              setSelected(null);
            }}
          />
        </View>
        <OpsText muted>
          Last response{" "}
          {updatedAt?.toLocaleTimeString("en-GB") ?? "Waiting"}
        </OpsText>
      </View>
      <View style={[s.panel, { padding: 14, gap: 12 }]}>
        <View style={[s.row, { alignItems: "flex-end" }]}>
          <OpsField
            label="Find workloads"
            value={search}
            onChange={setSearch}
            search
            placeholder="Name, type, parent, version or state…"
          />
          {scope === "runtime" ? (
            <OpsField
              label="Filter workload nodes"
              value={node}
              onChange={changeNode}
              placeholder="All nodes"
            />
          ) : null}
          <OpsButton
            label="Reset workload filters"
            onPress={() => {
              setSearch("");
              changeNode("");
              setKind("");
              setSort("name");
            }}
          />
        </View>
        <View style={s.row}>
          <OpsText muted>Type</OpsText>
          <OpsButton
            label="All types"
            active={!kind}
            onPress={() => setKind("")}
          />
          {kinds.map((value) => (
            <OpsButton
              key={value}
              label={value}
              active={kind === value}
              onPress={() => setKind(value)}
            />
          ))}
        </View>
        {scope === "runtime" ? (
          <View style={s.row}>
            <OpsText muted>Sort</OpsText>
            {(
              [
                ["name", "Name"],
                ["memory", "Memory / heap"],
                ["cpu", "CPU"],
              ] as const
            ).map(([value, label]) => (
              <OpsButton
                key={value}
                label={label}
                active={sort === value}
                onPress={() => setSort(value)}
              />
            ))}
          </View>
        ) : null}
      </View>
      <OpsText muted>
        {scope === "runtime"
          ? `${filtered.length} of ${rows.length} reported entries · kept separate by node. Pools and cells are a decomposition, not additive fleet totals.`
          : "Configuration describes deployment bindings, not runtime instances or execution counts."}
        {data?.incomplete ? " Observation coverage is partial." : ""}
      </OpsText>
      {scope === "runtime" ? (
        (data?.nodes ?? [])
          .filter(
            (report) =>
              report.error &&
              (!node.trim() ||
                (report.node_id ?? "")
                  .toLowerCase()
                  .includes(node.trim().toLowerCase())),
          )
          .map((report, i) => (
            <Notice error key={report.node_id ?? i}>
              {report.node_id ?? "Unknown node"}: {report.error}
            </Notice>
          ))
      ) : (
        <Notice error>{data?.deployment?.error}</Notice>
      )}
      {inspected ? (
        <Panel
          title={`Inspect workload · ${inspected.workload.id ?? unavailable}`}
          aside={
            <OpsButton
              label="Close workload inspector"
              icon={X}
              onPress={() => setSelected(null)}
            />
          }
        >
          <View style={{ padding: 16, gap: 14 }}>
            <View style={s.row}>
              <Tone value={inspected.workload.state ?? "unknown"} />
              <OpsText mono>{inspected.workload.kind ?? unavailable}</OpsText>
              <OpsText muted>Observed {timestamp(inspected.observed)}</OpsText>
            </View>
            <View style={s.row}>
              {Object.entries(inspected.workload).map(([key, value]) => (
                <View
                  key={key}
                  style={{
                    flexBasis: 180,
                    flexGrow: 1,
                    gap: 4,
                    padding: 10,
                    backgroundColor: ops.bg,
                  }}
                >
                  <OpsText muted>{key.replace(/_/g, " ")}</OpsText>
                  <OpsText mono style={{ flexShrink: 1 }}>
                    {key.endsWith("bytes")
                      ? bytes(typeof value === "number" ? value : undefined)
                      : String(value)}
                  </OpsText>
                </View>
              ))}
            </View>
            <OpsText muted>
              Placement:{" "}
              {inspected.node ??
                (scope === "configuration"
                  ? "Deployment configuration"
                  : unavailable)}{" "}
              · Collection: {inspected.observationState ?? "unknown"}
            </OpsText>
            {onNavigate && inspected.workload.id ? (
              <View style={s.row}>
                <OpsButton
                  label="Workload logs"
                  onPress={() => inspect("logs", inspected)}
                />
                <OpsButton
                  label="Workload metrics"
                  onPress={() => inspect("metrics", inspected)}
                />
              </View>
            ) : null}
          </View>
        </Panel>
      ) : null}
      <Panel
        title={
          scope === "runtime"
            ? "Runtime workloads"
            : "Deployment configuration & bindings"
        }
        aside={<OpsText muted>{filtered.length} entries</OpsText>}
      >
        {filtered.slice(pageOffset, pageOffset + 50).map((row) => (
          <WorkloadRow
            key={row.key}
            row={row}
            runtime={scope === "runtime"}
            selected={selected === row.key}
            onPress={() =>
              setSelected((old) => (old === row.key ? null : row.key))
            }
          />
        ))}
        {!filtered.length ? (
          <Empty
            title={
              !data && !error
                ? "Loading workload inventory…"
                : rows.length
                  ? "No matching workloads"
                  : "No workloads reported"
            }
            detail={
              rows.length
                ? "Change the search, node or type filter to see more entries."
                : scope === "runtime"
                  ? "Runtime inventory appears after agents report workload observations."
                  : "No deployment bindings have been reported."
            }
          />
        ) : null}
        {filtered.length > 50 ? (
          <View
            style={[s.row, { padding: 12, justifyContent: "space-between" }]}
          >
            <OpsText muted>
              {pageOffset + 1}–{Math.min(pageOffset + 50, filtered.length)} of{" "}
              {filtered.length}
            </OpsText>
            <View style={s.row}>
              <OpsButton
                label="Previous workloads"
                disabled={pageOffset === 0}
                onPress={() => setOffset(Math.max(0, pageOffset - 50))}
              />
              <OpsButton
                label="Next workloads"
                disabled={pageOffset + 50 >= filtered.length}
                onPress={() => setOffset(pageOffset + 50)}
              />
            </View>
          </View>
        ) : null}
      </Panel>
    </View>
  );
}
const WorkloadRow = React.memo(function WorkloadRow({
  row,
  runtime,
  selected,
  onPress,
}: {
  row: WorkloadEntry;
  runtime: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { ops, s } = useOperationsTheme(),
    workload = row.workload;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Inspect workload ${workload.id ?? "unknown"} on ${row.node ?? "configuration"}`}
      accessibilityState={{ expanded: selected }}
      onPress={onPress}
      style={({ hovered, pressed }: any) => ({
        padding: 16,
        gap: 10,
        borderBottomWidth: 1,
        borderColor: ops.line,
        backgroundColor: selected
          ? ops.selected
          : hovered || pressed
            ? ops.raised
            : ops.panel,
      })}
    >
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View style={[s.row, { flex: 1, minWidth: 0 }]}>
          <Text
            selectable
            style={[s.mono, { fontWeight: "600", fontSize: 14, flexShrink: 1 }]}
          >
            {workload.id ?? unavailable}
          </Text>
          <OpsText muted>{workload.kind ?? unavailable}</OpsText>
        </View>
        <Tone value={workload.state ?? "unknown"} />
      </View>
      <View style={s.row}>
        {runtime ? (
          <>
            <OpsText mono>{row.node ?? unavailable}</OpsText>
            <Tone value={row.observationState ?? "pending"} />
          </>
        ) : null}
        <OpsText muted>
          Parent {workload.parent ?? "—"} · Version{" "}
          {workload.version ?? unavailable}
        </OpsText>
      </View>
      {runtime ? (
        <View style={s.row}>
          {workload.live !== undefined || workload.retiring !== undefined ? (
            <OpsText>
              Live {numberValue(workload.live)} · Retiring{" "}
              {numberValue(workload.retiring)}
            </OpsText>
          ) : null}
          {workload.cpu_percent !== undefined ? (
            <OpsText>CPU {numberValue(workload.cpu_percent)}%</OpsText>
          ) : null}
          {workload.memory_bytes !== undefined ? (
            <OpsText>Memory {bytes(workload.memory_bytes)}</OpsText>
          ) : null}
          {workload.heap_bytes !== undefined ? (
            <OpsText>Heap {bytes(workload.heap_bytes)}</OpsText>
          ) : null}
          {workload.cells !== undefined ? (
            <OpsText>Cells {numberValue(workload.cells)}</OpsText>
          ) : null}
          {workload.requests !== undefined ? (
            <OpsText>Requests {numberValue(workload.requests)}</OpsText>
          ) : null}
          {workload.cpu_percent === undefined &&
          workload.memory_bytes === undefined &&
          workload.heap_bytes === undefined ? (
            <OpsText muted>Resource use not reported</OpsText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});
