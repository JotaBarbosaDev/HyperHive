import React from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowRight, RefreshCw, X } from "lucide-react-native";
import { getCelldObservability } from "@/services/celld";
import { usePollingResource } from "@/hooks/usePollingResource";
import type {
  CelldObservability,
  CelldObservationQuery,
  CelldSnapshot,
} from "@/types/celld";
import { bytes, numberValue, timestamp, unavailable } from "./observability";
import {
  Cell,
  Disclosure,
  Empty,
  Notice,
  OpsButton,
  OpsField,
  OpsText,
  Panel,
  SectionIntro,
  Stat,
  Table,
  Tone,
  useOperationsTheme,
} from "./OperationsUI";

export type InspectTarget = (
  tab: "logs" | "metrics",
  query: CelldObservationQuery,
) => void;
const percent = (value?: number) =>
  value === undefined ? unavailable : `${numberValue(value)}%`;
function NodeInspector({
  node,
  onClose,
  onNavigate,
  onWorkloads,
}: {
  node: CelldSnapshot;
  onClose: () => void;
  onNavigate?: InspectTarget;
  onWorkloads?: (node?: string) => void;
}) {
  const { ops, s } = useOperationsTheme();
  const navigate = (tab: "logs" | "metrics") => {
    const to = Date.now();
    onNavigate?.(tab, {
      from: to - 3600000,
      to,
      node: node.node_id,
      limit: 200,
    });
  };
  return (
    <Panel
      title={`Inspect node · ${node.node_id ?? unavailable}`}
      aside={<OpsButton label="Close inspector" icon={X} onPress={onClose} />}
    >
      <View style={{ padding: 16, gap: 14 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Tone value={node.state ?? "pending"} />
          <View style={s.row}>
            {onNavigate ? (
              <>
                <OpsButton
                  label="Node logs"
                  icon={ArrowRight}
                  onPress={() => navigate("logs")}
                />
                <OpsButton
                  label="Node metrics"
                  icon={ArrowRight}
                  onPress={() => navigate("metrics")}
                />
              </>
            ) : null}
          </View>
        </View>
        <Notice error>{node.error}</Notice>
        <OpsText muted>
          Observed {timestamp(node.collected_ms)} · Last attempt{" "}
          {timestamp(node.attempted_ms)} · Dropped records{" "}
          {numberValue(node.dropped)}
        </OpsText>
        <View style={s.row}>
          {Object.entries(node.resources ?? {}).map(([key, value]) => (
            <View
              key={key}
              style={{
                flexBasis: 180,
                flexGrow: 1,
                padding: 10,
                backgroundColor: ops.bg,
                gap: 4,
              }}
            >
              <OpsText muted>
                {(
                  {
                    sampled_ms: "Resource sample",
                    rss_bytes: "Resident memory",
                    cpu_percent_x100: "Process CPU",
                    owned_cells: "Owned cells",
                    resident_cells: "Resident cells",
                  } as Record<string, string>
                )[key] ?? key.replace(/_/g, " ")}
              </OpsText>
              <OpsText mono>
                {key.endsWith("_ms")
                  ? timestamp(typeof value === "number" ? value : undefined)
                  : typeof value === "boolean"
                    ? value
                      ? "Yes"
                      : "No"
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : key === "cpu_percent_x100"
                        ? percent(
                            typeof value === "number" ? value / 100 : undefined,
                          )
                        : key.endsWith("bytes")
                          ? bytes(typeof value === "number" ? value : undefined)
                          : numberValue(value)}
              </OpsText>
            </View>
          ))}
        </View>
      </View>
      <View
        style={{
          padding: 16,
          borderTopWidth: 1,
          borderColor: ops.line,
          gap: 10,
        }}
      >
        <OpsText>
          {node.workloads?.length ?? 0} workload entries reported on this node.
        </OpsText>
        {onWorkloads ? (
          <OpsButton
            label="Node workloads"
            onPress={() => onWorkloads(node.node_id)}
          />
        ) : null}
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={s.title}>Collection capabilities</Text>
        {node.capabilities?.length ? (
          node.capabilities.map((cap) => (
            <View key={cap.name} style={{ gap: 3 }}>
              <View style={s.row}>
                <OpsText>{cap.name.replace(/_/g, " ")}</OpsText>
                <Tone value={cap.state} />
              </View>
              {cap.detail ? <OpsText muted>{cap.detail}</OpsText> : null}
            </View>
          ))
        ) : (
          <OpsText muted>No capability information reported.</OpsText>
        )}
      </View>
    </Panel>
  );
}
function Storage({ data }: { data: CelldObservability }) {
  const { ops, s } = useOperationsTheme();
  const storage = data.storage;
  const usage =
    storage?.bytes !== undefined && storage.fleet_budget_bytes
      ? Math.min(100, (storage.bytes / storage.fleet_budget_bytes) * 100)
      : undefined;
  return (
    <Disclosure
      defaultOpen={Boolean(storage?.error)}
      title="History storage & retention"
      aside={
        <OpsText muted>
          {bytes(storage?.bytes)} / {bytes(storage?.fleet_budget_bytes)}
        </OpsText>
      }
    >
      <Notice error>{storage?.error}</Notice>
      <View style={{ height: 5, backgroundColor: ops.bg, borderRadius: 3 }}>
        {usage !== undefined ? (
          <View
            style={{
              height: 5,
              width: `${usage}%`,
              backgroundColor: ops.accent,
              borderRadius: 3,
            }}
          />
        ) : null}
      </View>
      <OpsText muted>
        Fleet {bytes(storage?.bytes)} / {bytes(storage?.fleet_budget_bytes)} ·
        Global {bytes(storage?.global_bytes)} /{" "}
        {bytes(storage?.global_budget_bytes)} · Up to{" "}
        {numberValue(storage?.retention_days)} days; quotas can shorten
        retention.
      </OpsText>
      <View style={s.row}>
        <OpsText>Dropped {numberValue(storage?.dropped)}</OpsText>
        <OpsText>
          Rejected batches {numberValue(storage?.rejected_batches)}
        </OpsText>
        <OpsText>
          Pruned segments {numberValue(storage?.pruned_segments)}
        </OpsText>
      </View>
    </Disclosure>
  );
}
export function FleetOverview({
  token,
  fleetId,
  onNavigate,
  onWorkloads,
}: {
  token: string;
  fleetId: string;
  onNavigate?: InspectTarget;
  onWorkloads?: (node?: string) => void;
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
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const nodes = data?.nodes ?? [];
  const matchesNode = (node: CelldSnapshot) =>
    `${node.node_id ?? ""} ${node.state ?? "pending"}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  const inspected = nodes.find(
    (node, i) => (node.node_id ?? `unknown-${i}`) === selected,
  );
  const memory = nodes.filter(
    (node) => node.resources?.rss_bytes !== undefined,
  );
  const cells = nodes.filter(
    (node) => node.resources?.owned_cells !== undefined,
  );
  return (
    <View style={s.stack}>
      <SectionIntro
        title="Fleet overview"
        detail="Fleet health, node resources and collection coverage."
        actions={
          <OpsButton
            label="Refresh overview"
            icon={RefreshCw}
            disabled={isRefreshing}
            onPress={() => {
              void refresh();
            }}
          />
        }
      />
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <OpsText muted>
          Last response{" "}
          {updatedAt?.toLocaleTimeString("en-GB") ?? "Waiting"}
        </OpsText>
        <Tone value={error ? "unavailable" : data ? "connected" : "pending"} />
      </View>
      <Notice error>{error}</Notice>
      {error && data ? (
        <Notice>
          Showing the last successful report. Resource timestamps identify its
          age.
        </Notice>
      ) : null}
      <Notice error>{data?.error}</Notice>
      {data?.historical ? (
        <Notice>Historical fleet · retained observations are read-only.</Notice>
      ) : null}
      {data ? (
        <>
          <View style={s.row}>
            <Stat
              label="Reporting nodes"
              value={`${nodes.filter((n) => n.state === "fresh").length} / ${nodes.length}`}
              detail={`${nodes.filter((node) => node.state === "pending" || !node.state).length} pending · fresh / known nodes`}
              color={ops.green}
            />
            <Stat
              label="Nodes needing attention"
              value={String(
                nodes.filter((n) =>
                  ["partial", "stale", "offline"].includes(n.state ?? ""),
                ).length,
              )}
              detail="Partial, stale or offline"
              color={ops.amber}
            />
            <Stat
              label="Reported resident memory"
              value={
                memory.length
                  ? bytes(
                      memory.reduce(
                        (sum, n) => sum + n.resources!.rss_bytes!,
                        0,
                      ),
                    )
                  : unavailable
              }
              detail={`${memory.length} of ${nodes.length} nodes reporting`}
            />
            <Stat
              label="Reported owned cells"
              value={
                cells.length
                  ? numberValue(
                      cells.reduce(
                        (sum, n) => sum + n.resources!.owned_cells!,
                        0,
                      ),
                    )
                  : unavailable
              }
              detail={`${cells.length} of ${nodes.length} nodes reporting`}
            />
          </View>
          {data.incomplete ? (
            <Notice>
              Observed data has partial coverage. Counts and resource sums are
              not guaranteed fleet totals.
            </Notice>
          ) : null}
          <Panel
            title="Nodes"
            aside={<OpsText muted>Select a node to inspect</OpsText>}
          >
            <View style={{ padding: 12 }}>
              <OpsField
                standalone
                label="Find a node"
                value={search}
                onChange={setSearch}
                placeholder="Filter by node ID or state…"
                search
              />
            </View>
            <Table
              headings={[
                "Node",
                "Status",
                "Process CPU",
                "Resident memory",
                "Owned / resident cells",
                "Last observed",
              ]}
              widths={[1.4, 1, 1, 1.2, 1.4, 1.8]}
              minWidth={970}
            >
              {nodes
                .map((node, i) => ({ node, i }))
                .filter(({ node }) => matchesNode(node))
                .map(({ node, i }) => (
                  <Pressable
                    key={node.node_id ?? i}
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect node ${node.node_id ?? i}`}
                    accessibilityState={{
                      selected: (node.node_id ?? `unknown-${i}`) === selected,
                    }}
                    onPress={() => setSelected(node.node_id ?? `unknown-${i}`)}
                    style={({ hovered, pressed }: any) => [
                      s.tr,
                      {
                        backgroundColor:
                          (node.node_id ?? `unknown-${i}`) === selected
                            ? ops.selected
                            : hovered || pressed
                              ? ops.raised
                              : ops.panel,
                      },
                    ]}
                  >
                    <Cell flex={1.4} mono>
                      {node.node_id ?? unavailable}
                    </Cell>
                    <View style={{ flex: 1 }}>
                      <Tone value={node.state ?? "pending"} />
                      {node.error ? (
                        <OpsText style={{ color: ops.red, fontSize: 11 }}>
                          {node.error}
                        </OpsText>
                      ) : null}
                    </View>
                    <Cell mono>
                      {percent(
                        node.resources?.cpu_percent_x100 === undefined
                          ? undefined
                          : node.resources.cpu_percent_x100 / 100,
                      )}
                    </Cell>
                    <Cell flex={1.2} mono>
                      {bytes(node.resources?.rss_bytes)}
                    </Cell>
                    <Cell flex={1.4} mono>
                      {numberValue(node.resources?.owned_cells)} /{" "}
                      {numberValue(node.resources?.resident_cells)}
                    </Cell>
                    <Cell flex={1.8} mono>
                      {timestamp(node.collected_ms)}
                    </Cell>
                  </Pressable>
                ))}
            </Table>
            {!nodes.length ? (
              <Empty
                title="Waiting for node observations"
                detail="Nodes appear after the fleet's agents send their first resource sample."
              />
            ) : !nodes.some(matchesNode) ? (
              <Empty
                title="No matching nodes"
                detail="Try a different node ID or state."
              />
            ) : null}
            <View style={{ padding: 12 }}>
              <OpsText muted>
                {data.cpu_aggregation ??
                  "CPU is per process: 100% equals one core. Resident cells are a subset of owned cells."}
              </OpsText>
            </View>
          </Panel>
          {inspected ? (
            <NodeInspector
              node={inspected}
              onClose={() => setSelected(null)}
              onNavigate={inspected.node_id ? onNavigate : undefined}
              onWorkloads={onWorkloads}
            />
          ) : null}
          <Panel
            title="Workload inventory"
            aside={
              onWorkloads ? (
                <OpsButton
                  label="Open workloads"
                  onPress={() => onWorkloads()}
                />
              ) : undefined
            }
          >
            <View style={{ padding: 16, gap: 12 }}>
              <View style={s.row}>
                <OpsText>
                  {nodes.reduce(
                    (sum, node) => sum + (node.workloads?.length ?? 0),
                    0,
                  )}{" "}
                  runtime entries reported
                </OpsText>
                <OpsText muted>
                  Across {nodes.filter((node) => node.workloads?.length).length}{" "}
                  nodes
                </OpsText>
                <OpsText>
                  {data.deployment?.workloads?.length ?? 0} configuration
                  bindings reported
                </OpsText>
              </View>
              <OpsText muted>
                Open Workloads to search by name, node and type, inspect
                resources, or follow workload logs. Runtime entries and
                deployment bindings are kept separate.
              </OpsText>
              <Notice error>{data.deployment?.error}</Notice>
            </View>
          </Panel>
          <Storage data={data} />
        </>
      ) : (
        <Empty
          title={error ? "Overview unavailable" : "Connecting to fleet…"}
          detail={
            error
              ? "Refresh to retry loading node observations."
              : "Waiting for the first observation report."
          }
        />
      )}
    </View>
  );
}
