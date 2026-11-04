import React from "react";
import { Background, BaseEdge, Controls, EdgeLabelRenderer, getBezierPath, Handle, MiniMap, Position, ReactFlow, useNodesState, type Edge, type EdgeProps, type Node, type NodeChange, type NodeProps, type ReactFlowInstance, ViewportPortal } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "expo-router";
import { NetworkHistoryChart } from "@/components/network/network-history.web";
import { SupportSidePanel } from "@/components/support/support-side-panel";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ensureHyperHiveWebsocket, subscribeToHyperHiveWebsocket } from "@/services/websocket-client";
import { parseHyperHiveSocketPayload } from "@/utils/socketMessages";
import { getNetworkGraph, getNetworkTraffic, resetNetworkLayout, saveNetworkLayout, type NetworkGraph, type NetworkGraphEdge, type NetworkGraphNode, type NetworkPositions, type NetworkTraffic } from "@/services/network-graph";
import {
  filterNetworkGraph,
  NETWORK_PRESETS,
  networkActiveCollapsed,
  networkBoard,
  networkDetailRows,
  networkDivisions,
  networkEdgeRates,
  networkGraphUnchanged,
  networkEdgeRateText,
  networkEdgeWidth,
  networkFlowKey,
  networkHosts,
  networkLineHistorySource,
  networkNodeHistorySources,
  networkNodeLinks,
  networkNodeRateText,
  networkNodeRoute,
  networkPlacedBoard,
  networkPresetFor,
  networkRouteEdges,
  networkStatusLabel,
  networkVmNics,
  readNetworkCollapsed,
  writeNetworkCollapsed,
  type NetworkBoardEdge,
  type NetworkBoardNode,
  type NetworkEdgeRate,
  networkSnap,
  type NetworkGuide,
} from "@/utils/network-graph";

const STATUS_COLOR: Record<string, string> = { up: "#16A34A", down: "#DC2626", disabled: "#94A3B8", unknown: "#64748B" };
const ACTIVE_COLOR = "#0D9488";
const border = "border-outline-200 dark:border-[#26364A]";
const ink = "text-typography-900 dark:text-[#E8EBF0]";
const muted = "text-typography-600 dark:text-[#8A94A8]";
const control = `rounded-lg border ${border} bg-background-0 dark:bg-[#101B2B] ${ink} focus-visible:ring-2 focus-visible:ring-[#147D78]`;
// Teal text needs a darker shade on light surfaces to stay readable at card size.
const rateText = "text-[#0F766E] dark:text-[#2DD4BF]";
const chipOn = `rounded-full border border-[#147D78] bg-[#147D78]/10 ${ink} focus-visible:ring-2 focus-visible:ring-[#147D78]`;
const chipOff = `rounded-full border border-dashed ${border} ${muted} focus-visible:ring-2 focus-visible:ring-[#147D78]`;
const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

const TRAFFIC_POLL_MS = 2000;
const GRAPH_POLL_MS = 30_000;
const GRAPH_CHANGE_DEBOUNCE_MS = 500;
// Arrow keys move a piece one step per press, so saves wait for a pause.
const LAYOUT_SAVE_DELAY_MS = 400;
const SNAP_DISTANCE_PX = 8;

type BoardData = NetworkBoardNode["data"];

// Rates reach the cards through context: changing the board itself would reset the view.
const NodeRates = React.createContext<NetworkTraffic["nodes"]>({});

// Through context for the same reason: the handler must not be part of a node's data.
// Null while a search or host filter is on, because those keep every box open.
const ToggleBox = React.createContext<((id: string) => void) | null>(null);

const hiddenHandle = { opacity: 0, pointerEvents: "none" } as const;

function Dot({ status }: { status?: string }) {
  return <span role="img" aria-label={networkStatusLabel(status ?? "unknown")} title={networkStatusLabel(status ?? "unknown")} style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: STATUS_COLOR[status ?? "unknown"] ?? STATUS_COLOR.unknown }} />;
}

// Its own component so a traffic poll re-renders only this text, not every card.
function CardRate({ id }: { id: string }) {
  const rate = networkNodeRateText(React.useContext(NodeRates)[id]);
  return rate ? <span className={rateText} style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{rate}</span> : null;
}

function BoardCard({ data, selected }: NodeProps<Node<BoardData>>) {
  const greyed = (data.node?.type.startsWith("celld_") || data.node?.type === "container") && data.node.status !== "up";
  const edge = selected ? "border-[#147D78] ring-2 ring-[#147D78]/40" : data.node?.status === "down" && !greyed ? "border-red-600" : `${border} hover:border-[#147D78]`;
  return <div title={`${data.title}\n${data.subtitle ?? ""}`} className={`rounded-lg border bg-background-0 dark:bg-[#101B2B] ${edge}`} style={{ width: "100%", height: "100%", padding: "7px 10px", boxSizing: "border-box", cursor: "pointer", opacity: greyed ? 0.6 : 1, transition: "border-color 150ms ease-out" }}>
    <Handle type="target" position={Position.Left} isConnectable={false} style={hiddenHandle} />
    <div className={ink} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}><Dot status={data.node?.status} /><span style={clip}>{data.title}</span></div>
    <div className={muted} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, marginTop: 3 }}>
      <span style={clip}>{data.subtitle}</span>
      <CardRate id={data.node?.id ?? ""} />
    </div>
    <Handle type="source" position={Position.Right} isConnectable={false} style={hiddenHandle} />
  </div>;
}

const BOX_STYLE = {
  section: { background: "rgba(100,116,139,0.08)" },
  machine: { background: "rgba(20,125,120,0.08)" },
  network: { background: "rgba(59,130,246,0.08)" },
};

function BoardBox({ id, data }: NodeProps<Node<BoardData>>) {
  const kind = data.kind ?? "section";
  const toggle = React.useContext(ToggleBox);
  return <div className={`rounded-xl border ${border}`} style={{ width: "100%", height: "100%", boxSizing: "border-box", cursor: data.node ? "pointer" : "grab", ...BOX_STYLE[kind] }}>
    <Handle type="target" position={Position.Left} isConnectable={false} style={{ ...hiddenHandle, top: 20 }} />
    <div style={{ padding: "9px 12px 0" }}>
      <div className={ink} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: kind === "network" ? 12 : 14, fontWeight: 600 }}>
        {/* Stops at the button: the node would otherwise select itself and open the side panel. */}
        <button type="button" disabled={!toggle} className={`nodrag nopan ${muted} ${toggle ? "" : "opacity-50"}`} aria-expanded={!data.collapsed} aria-label={`${data.collapsed ? "Expand" : "Collapse"} ${data.title}`} onClick={(event) => { event.stopPropagation(); toggle?.(id); }} onKeyDown={(event) => event.stopPropagation()} style={{ width: 20, height: 20, padding: 0, flexShrink: 0, border: "none", background: "none", color: "inherit", cursor: toggle ? "pointer" : "default", fontSize: 12, lineHeight: "20px" }}><span aria-hidden>{data.collapsed ? "▸" : "▾"}</span></button>
        {kind === "machine" ? <Dot status={data.node?.status} /> : null}
        <span style={clip}>{data.title}</span>
        {kind !== "machine" ? <span className={muted} style={{ fontSize: 11, fontWeight: 400, flexShrink: 0 }}>{data.subtitle}</span> : null}
      </div>
      {kind === "machine" ? <div className={muted} title={data.subtitle} style={{ ...clip, fontSize: 11, marginTop: 3 }}>{data.subtitle}</div> : null}
    </div>
    <Handle type="source" position={Position.Right} isConnectable={false} style={{ ...hiddenHandle, top: 20 }} />
  </div>;
}

// Boxes stay faint so the overview shows where the down cards are.
const minimapColor = (node: Node) => (node.type === "box" ? "rgba(100,116,139,0.18)" : STATUS_COLOR[(node.data as BoardData).node?.status ?? "unknown"] ?? STATUS_COLOR.unknown);

function Legend() {
  return <div className={muted} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, fontSize: 12 }}>
    {["up", "down", "disabled", "unknown"].map((status) => <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot status={status} />{networkStatusLabel(status)}</span>)}
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span aria-hidden style={{ width: 20, borderTop: "2px dashed currentColor" }} />Unmatched target</span>
  </div>;
}

const nodeTypes = { card: BoardCard, box: BoardBox };

const LABEL_GAP = 10;
const LABEL_WIDTH = 140;
const LABEL_ROW = 34;

type TrafficEdgeData = { label?: string; row?: number };

// Labels sit in the gap beside the source: a line's midpoint can land on a card in the
// next column, and lines sharing a target would stack their labels there.
function TrafficEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data }: EdgeProps<Edge<TrafficEdgeData>>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <>
    <BaseEdge path={path} style={style} interactionWidth={20} />
    {data?.label ? <EdgeLabelRenderer>
      <div className={`rounded bg-background-0 dark:bg-[#101B2B] ${ink}`} style={{ position: "absolute", zIndex: 1001, transform: `translate(${sourceX + LABEL_GAP}px, ${sourceY + (data.row ?? 0) * LABEL_ROW}px) translateY(-50%)`, maxWidth: LABEL_WIDTH, padding: "2px 6px", fontSize: 11, lineHeight: "14px", fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}>{data.label}</div>
    </EdgeLabelRenderer> : null}
  </>;
}

const edgeTypes = { traffic: TrafficEdge };

const flowEdge = (edge: NetworkBoardEdge, route: Set<string> | null, rate: NetworkEdgeRate | undefined, row: number): Edge => {
  const lit = route?.has(edge.id);
  const faded = route && !lit;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "traffic",
    focusable: false,
    // A lit or busy route draws above the boxes, which otherwise sit over the lines.
    zIndex: lit ? 1000 : rate ? 900 : 0,
    data: rate && !faded ? { label: networkEdgeRateText(rate), row } : {},
    style: {
      // Dashed marks a target nothing in HyperHive could be matched to.
      ...(edge.dashed ? { strokeDasharray: "6 4" } : {}),
      ...(rate ? { stroke: ACTIVE_COLOR, strokeWidth: networkEdgeWidth(rate) } : {}),
      ...(lit ? { stroke: "#2DD4BF", strokeWidth: Math.max(2, rate ? networkEdgeWidth(rate) : 0) } : {}),
      opacity: faded ? 0.12 : 1,
    },
  };
};

function Panel({ graph, node, traffic, onClose }: { graph: NetworkGraph; node: NetworkGraphNode; traffic: NetworkTraffic | null; onClose: () => void }) {
  const router = useRouter();
  const route = networkNodeRoute(node);
  const links = networkNodeLinks(graph, node.id, traffic);
  const rate = networkNodeRateText(traffic?.nodes[node.id]);
  const rows = networkDetailRows(node);
  const nics = networkVmNics(graph, node.id, traffic);
  return <SupportSidePanel title={node.label} subtitle={`${node.type.replace("_", " ")} · ${networkStatusLabel(node.status)}${node.host ? ` · ${node.host}` : ""}`} onClose={onClose}>
    <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", minHeight: 0 }}>
      {route ? <button onClick={() => router.push(route as never)} className={`${control} self-start`} style={{ padding: "8px 12px", cursor: "pointer" }}>Open page</button> : null}
      {rate ? <p className={ink} style={{ margin: 0, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>Live traffic: {rate}</p> : null}
      <NetworkHistoryChart key={node.id} sources={networkNodeHistorySources(graph, node)} />
      {rows.length ? <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(90px,auto) 1fr", gap: "6px 12px", fontSize: 13 }}>
        {rows.map((row) => <React.Fragment key={row.key}><dt className={muted}>{row.key}</dt><dd className={ink} style={{ margin: 0, overflowWrap: "anywhere" }}>{row.value}</dd></React.Fragment>)}
      </dl> : null}
      {nics.length ? <section>
        <h3 className={ink} style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>NICs</h3>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          {nics.map((nic) => <li key={nic.id} className={ink} style={{ overflowWrap: "anywhere" }}>
            {nic.mac} <span className={muted}>({[nic.network, nic.model].filter(Boolean).join(", ")})</span>{nic.rate ? <span className={rateText} style={{ fontVariantNumeric: "tabular-nums" }}> {nic.rate}</span> : null}
          </li>)}
        </ul>
      </section> : null}
      {links.length ? <section>
        <h3 className={ink} style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>Links</h3>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          {links.map((link) => <li key={link.key} className={ink} style={{ overflowWrap: "anywhere" }}>
            {link.direction === "out" ? "→" : "←"} {link.peer} <span className={muted}>({link.type.replace("_", " ")}{link.match ? `, matched by ${link.match}` : ""})</span>{link.rate ? <span className={rateText} style={{ fontVariantNumeric: "tabular-nums" }}> {link.rate}</span> : null}
          </li>)}
        </ul>
      </section> : null}
    </div>
  </SupportSidePanel>;
}

function LinePanel({ graph, edge, rate, onClose }: { graph: NetworkGraph; edge: NetworkGraphEdge; rate?: NetworkEdgeRate; onClose: () => void }) {
  const label = (id: string) => graph.nodes.find((node) => node.id === id)?.label ?? id;
  const source = networkLineHistorySource(graph, edge);
  return <SupportSidePanel title={`${label(edge.source)} → ${label(edge.target)}`} subtitle={source ? source.keys.join(", ") : "Line"} onClose={onClose}>
    <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", minHeight: 0 }}>
      {rate ? <p className={ink} style={{ margin: 0, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>Live traffic: {networkEdgeRateText(rate)}</p> : null}
      <NetworkHistoryChart key={networkFlowKey(edge)} sources={source ? [source] : []} />
    </div>
  </SupportSidePanel>;
}

export function NetworkMap() {
  const { resolvedMode } = useAppTheme();
  const [graph, setGraph] = React.useState<NetworkGraph | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [host, setHost] = React.useState("");
  const [hiddenDivisions, setHiddenDivisions] = React.useState<string[]>([]);
  const [collapsed, setCollapsed] = React.useState(readNetworkCollapsed);
  const [selectedId, setSelectedId] = React.useState("");
  const [selectedEdgeId, setSelectedEdgeId] = React.useState("");
  const [hoverId, setHoverId] = React.useState("");
  const [traffic, setTraffic] = React.useState<NetworkTraffic | null>(null);
  const [trafficFailed, setTrafficFailed] = React.useState(false);
  const [positions, setPositions] = React.useState<NetworkPositions>({});
  const [guides, setGuides] = React.useState<NetworkGuide[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const flow = React.useRef<ReactFlowInstance | null>(null);
  const canvas = React.useRef<HTMLDivElement>(null);
  const fitted = React.useRef("");
  // Counts the loads that should fit the view; a silent reload leaves it alone.
  const [fitLoads, setFitLoads] = React.useState(0);
  const shownGraph = React.useRef<NetworkGraph | null>(null);
  const loadsRunning = React.useRef(0);
  const silentReload = React.useRef<AbortController | null>(null);
  const reloadAgain = React.useRef(false);
  // A layout write is on its way: unsaved is already empty, but the server does not have it yet.
  const layoutWrites = React.useRef(0);
  const unsaved = React.useRef<NetworkPositions>({});
  const lastEdges = React.useRef(new Map<string, { key: string; edge: Edge }>());
  const draggingId = React.useRef("");
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    silentReload.current?.abort();
    loadsRunning.current += 1;
    setLoading(true);
    try {
      const next = await getNetworkGraph(signal);
      shownGraph.current = next;
      setGraph(next);
      setPositions({ ...next.positions, ...unsaved.current });
      setFitLoads((count) => count + 1);
      setError("");
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Could not load the network graph.");
    } finally {
      loadsRunning.current -= 1;
    }
    setLoading(false);
  }, []);

  const reloadSilently = React.useCallback(async () => {
    if (silentReload.current) {
      // The reply on its way may predate whatever caused this trigger.
      reloadAgain.current = true;
      return;
    }
    if (loadsRunning.current || layoutWrites.current || draggingId.current || Object.keys(unsaved.current).length) return;
    const controller = new AbortController();
    silentReload.current = controller;
    try {
      const next = await getNetworkGraph(controller.signal);
      if (controller.signal.aborted) return;
      const shown = shownGraph.current;
      if (!shown || !networkGraphUnchanged(shown, next)) {
        shownGraph.current = next;
        setGraph(next);
      }
      // Nothing shown yet means the first load failed, so this one is the first load.
      if (!shown) {
        setFitLoads((count) => count + 1);
        setError("");
      }
      const placed = { ...next.positions, ...unsaved.current };
      setPositions((current) => (JSON.stringify(current) === JSON.stringify(placed) ? current : placed));
    } catch {
      // The last graph stays on screen and the next trigger retries.
    } finally {
      silentReload.current = null;
      if (reloadAgain.current) {
        reloadAgain.current = false;
        void reloadSilently();
      }
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  React.useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden) {
        try {
          setTraffic(await getNetworkTraffic(controller.signal));
          setTrafficFailed(false);
        } catch {
          if (controller.signal.aborted) return;
          // Old rates on screen would read as current.
          setTraffic(null);
          setTrafficFailed(true);
        }
      }
      timer = setTimeout(() => void poll(), TRAFFIC_POLL_MS);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      if (!document.hidden) void reloadSilently();
      timer = setTimeout(poll, GRAPH_POLL_MS);
    };
    timer = setTimeout(poll, GRAPH_POLL_MS);
    return () => {
      clearTimeout(timer);
      reloadAgain.current = false;
      silentReload.current?.abort();
    };
  }, [reloadSilently]);

  React.useEffect(() => {
    let closed = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToHyperHiveWebsocket((payload) => {
      void parseHyperHiveSocketPayload(payload).then((messages) => {
        if (closed || !messages.some((message) => (message as { type?: unknown } | null)?.type === "NetworkChanged")) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => void reloadSilently(), GRAPH_CHANGE_DEBOUNCE_MS);
      });
    });
    ensureHyperHiveWebsocket().catch((err) => {
      console.error("Error starting WebSocket:", err);
    });
    return () => {
      closed = true;
      clearTimeout(debounce);
      unsubscribe();
    };
  }, [reloadSilently]);

  // A node that came back later must not reopen its panel.
  React.useEffect(() => {
    if (graph && selectedId && !graph.nodes.some((node) => node.id === selectedId)) setSelectedId("");
  }, [graph, selectedId]);

  const hiddenTypes = React.useMemo(() => (graph ? networkDivisions(graph).filter((division) => hiddenDivisions.includes(division.id)).flatMap((division) => division.types) : []), [graph, hiddenDivisions]);
  const defaultBoard = React.useMemo(() => {
    const visible = graph ? filterNetworkGraph(graph, { query, host, hiddenTypes }) : { nodes: [], edges: [] };
    return networkBoard(visible.nodes, visible.edges, networkActiveCollapsed(collapsed, query, host));
  }, [graph, query, host, hiddenTypes, collapsed]);
  const board = React.useMemo(() => networkPlacedBoard(defaultBoard, positions), [defaultBoard, positions]);
  // Collapsing stays out of this key: it must leave the view where it is.
  const fitKey = JSON.stringify([fitLoads, query, host, hiddenDivisions]);

  React.useEffect(() => {
    // This also runs mid-drag, so what React Flow tracks on a node has to survive it.
    setNodes((current) => {
      const live = new Map(current.map((node) => [node.id, node]));
      return (board.nodes as unknown as Node[]).map((node) => {
        const was = live.get(node.id);
        // React Flow re-renders any node whose object changes, so an unmoved piece keeps its object.
        if (was && was.data === node.data && was.width === node.width && was.height === node.height && was.position.x === node.position.x && was.position.y === node.position.y) return was;
        return { ...node, selected: was?.selected, dragging: was?.dragging, measured: was?.measured };
      });
    });
    // Moving a piece or a silent reload must leave the view where it is.
    if (fitted.current === fitKey) return;
    fitted.current = fitKey;
    // Fit the width and start at the top: fitting the height makes tall boards unreadable.
    const width = canvas.current?.clientWidth ?? 0;
    const zoom = board.width && width ? Math.min(1, (width - 32) / board.width) : 1;
    requestAnimationFrame(() => void flow.current?.setViewport({ x: 16 - board.left * zoom, y: 16 - board.top * zoom, zoom }));
  }, [board, fitKey, setNodes]);

  const saveLayout = React.useCallback(async () => {
    const moved = unsaved.current;
    if (!Object.keys(moved).length) return;
    unsaved.current = {};
    layoutWrites.current += 1;
    try {
      await saveNetworkLayout(moved);
      setError("");
    } catch {
      // Kept for the next save, under anything moved since.
      unsaved.current = { ...moved, ...unsaved.current };
      setError("Could not save the layout. It will be saved again with your next move.");
    } finally {
      layoutWrites.current -= 1;
    }
  }, []);

  // Leaving the page must not lose a move still waiting for its save.
  React.useEffect(() => () => {
    clearTimeout(saveTimer.current);
    void saveLayout();
  }, [saveLayout]);

  const resetLayout = async () => {
    if (!window.confirm("Put every piece back in its default place? This changes the map for everyone.")) return;
    clearTimeout(saveTimer.current);
    unsaved.current = {};
    silentReload.current?.abort();
    layoutWrites.current += 1;
    try {
      await resetNetworkLayout();
      setPositions({});
      setError("");
    } catch {
      setError("Could not reset the layout.");
    } finally {
      layoutWrites.current -= 1;
    }
  };

  const focusId = hoverId || selectedId;
  const edgeRates = React.useMemo(() => networkEdgeRates(graph?.flows, traffic), [graph, traffic]);
  const edges = React.useMemo(() => {
    const route = focusId ? networkRouteEdges(defaultBoard, focusId) : null;
    // Lines leaving one card would share a label spot, so each busy one takes the next row.
    const rows = new Map<string, number>();
    const next = new Map<string, { key: string; edge: Edge }>();
    const built = defaultBoard.edges.map((edge) => {
      // Traffic is counted per original line, and a merged line has no single number.
      const rate = edge.originals.length === 1 ? edgeRates.get(networkFlowKey(edge.originals[0])) : undefined;
      const row = rows.get(edge.source) ?? 0;
      if (rate && (!route || route.has(edge.id))) rows.set(edge.source, row + 1);
      const fresh = flowEdge(edge, route, rate, row);
      const key = JSON.stringify(fresh);
      // A poll or hover changes few lines; the rest keep their object, so React Flow skips them.
      const kept = lastEdges.current.get(edge.id);
      const entry = kept?.key === key ? kept : { key, edge: fresh };
      next.set(edge.id, entry);
      return entry.edge;
    });
    lastEdges.current = next;
    return built;
  }, [defaultBoard, focusId, edgeRates]);
  const handleNodesChange = React.useCallback((incoming: NodeChange[]) => {
    const dragged = incoming.filter((change) => change.type === "position" && change.position);
    let changes = incoming;
    // One piece only: a group keeps its shape. An arrow key must not snap, or it could never leave a line.
    const only = dragged.length === 1 ? dragged[0] : undefined;
    if (only?.type === "position" && only.position && (only.dragging || draggingId.current === only.id)) {
      const snap = networkSnap(board, only.id, only.position, SNAP_DISTANCE_PX / (flow.current?.getZoom() ?? 1));
      changes = incoming.map((change) => (change === only ? { ...only, position: snap.position } : change));
      draggingId.current = only.dragging ? only.id : "";
      setGuides(only.dragging ? snap.guides : []);
    }
    onNodesChange(changes);
    const moved: NetworkPositions = {};
    const finished: NetworkPositions = {};
    for (const change of changes) {
      // Keyboard activation only reports a selection change; a repeat click only reports onNodeClick.
      if (change.type === "select" && change.selected) setSelectedId(change.id);
      if (change.type === "position" && change.position) {
        moved[change.id] = change.position;
        // A finished drag and an arrow key say false; a drag in progress is only shown, not saved.
        if (!change.dragging) finished[change.id] = change.position;
      }
    }
    if (!Object.keys(moved).length) return;
    // A reply already on its way predates this move and would put the piece back.
    silentReload.current?.abort();
    // Every step goes through the board, so boxes fit their pieces during a drag too.
    setPositions((current) => ({ ...current, ...moved }));
    if (!Object.keys(finished).length) return;
    Object.assign(unsaved.current, finished);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveLayout(), LAYOUT_SAVE_DELAY_MS);
  }, [board, onNodesChange, saveLayout]);

  const selected = graph?.nodes.find((node) => node.id === selectedId);
  const selectedEdge = board.edges.find((edge) => edge.id === selectedEdgeId)?.originals[0];
  const preset = networkPresetFor(hiddenDivisions);
  const hostCount = graph ? networkHosts(graph).length : 0;
  const downCount = graph?.nodes.filter((node) => node.status === "down").length ?? 0;
  const toggleBox = React.useCallback((id: string) => {
    setCollapsed((ids) => {
      const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
      writeNetworkCollapsed(next);
      return next;
    });
  }, []);
  const toggleDivision = (id: string) => setHiddenDivisions((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  return <div className="bg-background-0 dark:bg-[#070D19]" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 16, gap: 12, height: "100%" }}>
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <div style={{ marginRight: 8 }}>
        <h1 className={ink} style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Network map</h1>
        {graph ? <p className={muted} style={{ fontSize: 12, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
          {hostCount} {hostCount === 1 ? "host" : "hosts"} · {graph.nodes.length} {graph.nodes.length === 1 ? "item" : "items"}
          {downCount ? <span className="text-red-700 dark:text-red-300"> · {downCount} down</span> : null}
        </p> : null}
      </div>
      <input type="search" aria-label="Search the network map" placeholder="Search domain, VM, IP…" value={query} onChange={(event) => setQuery(event.target.value)} className={control} style={{ padding: "8px 10px", minWidth: 220, flex: "1 1 220px", maxWidth: 360 }} />
      <select aria-label="Filter by host" value={host} onChange={(event) => setHost(event.target.value)} className={control} style={{ padding: "8px 10px" }}>
        <option value="">All hosts</option>
        {graph ? networkHosts(graph).map((name) => <option key={name} value={name}>{name}</option>) : null}
      </select>
      <select aria-label="Layers" value={preset?.id ?? "custom"} onChange={(event) => setHiddenDivisions(NETWORK_PRESETS.find((item) => item.id === event.target.value)?.hidden ?? [])} className={control} style={{ padding: "8px 10px" }}>
        {NETWORK_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        {preset ? null : <option value="custom" disabled>Custom</option>}
      </select>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <button onClick={() => void load()} disabled={loading} className={control} style={{ padding: "8px 12px", cursor: loading ? "default" : "pointer" }}>{loading ? "Loading…" : "Refresh"}</button>
        <button onClick={() => void resetLayout()} disabled={!Object.keys(positions).length} className={`${control} ${Object.keys(positions).length ? "" : "opacity-50"}`} style={{ padding: "8px 12px", cursor: Object.keys(positions).length ? "pointer" : "default" }}>Reset layout</button>
      </div>
    </header>
    {graph ? <div role="group" aria-label="Show divisions" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {networkDivisions(graph).map((division) => {
        const shown = !hiddenDivisions.includes(division.id);
        return <button key={division.id} aria-pressed={shown} onClick={() => toggleDivision(division.id)} className={shown ? chipOn : chipOff} style={{ padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>{division.label}</button>;
      })}
    </div> : null}
    {error ? <div role="alert" className="rounded-lg border border-red-600 text-red-700 dark:text-red-300" style={{ padding: "8px 12px", fontSize: 13 }}>{error}</div> : null}
    {graph?.warnings.length ? <details role="status" className="rounded-lg border border-amber-500 text-amber-800 dark:text-amber-300" style={{ padding: "8px 12px", fontSize: 13 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>This graph is incomplete ({graph.warnings.length})</summary>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18, maxHeight: 120, overflowY: "auto" }}>{graph.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </details> : null}
    <div ref={canvas} className={`rounded-xl border ${border}`} style={{ flex: 1, minHeight: 420, overflow: "hidden", position: "relative" }}>
      {!graph && loading ? <p role="status" className={muted} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", margin: 0, zIndex: 1, pointerEvents: "none" }}>Loading the network map…</p> : null}
      {graph && !board.nodes.length ? <p className={muted} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", margin: 0, zIndex: 1, pointerEvents: "none" }}>{graph.nodes.length ? "Nothing matches these filters." : "No network data yet."}</p> : null}
      <ToggleBox.Provider value={query.trim() || host ? null : toggleBox}>
      <NodeRates.Provider value={traffic?.nodes ?? {}}>
      <ReactFlow onInit={(instance) => { flow.current = instance as unknown as ReactFlowInstance; }} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={handleNodesChange} onNodeClick={(_, node) => { if (node.data.node) setSelectedId(node.id); }} onNodeMouseEnter={(_, node) => { if (node.data.node || node.data.collapsed) setHoverId(node.id); }} onNodeMouseLeave={() => setHoverId("")} onEdgeClick={(_, edge) => { if (defaultBoard.edges.find((line) => line.id === edge.id)?.originals.length !== 1) return; setSelectedId(""); setSelectedEdgeId(edge.id); }} onPaneClick={() => { setSelectedId(""); setSelectedEdgeId(""); }} colorMode={resolvedMode === "dark" ? "dark" : "light"} selectNodesOnDrag={false} nodesConnectable={false} edgesFocusable={false} onlyRenderVisibleElements panOnScroll zoomOnScroll={false} minZoom={0.2} proOptions={{ hideAttribution: true }}>
        <Background gap={24} />
        <ViewportPortal>
          <svg aria-hidden width={1} height={1} style={{ position: "absolute", overflow: "visible", pointerEvents: "none", zIndex: 2000 }}>
            {guides.map((guide) => <line key={`${guide.x1},${guide.y1},${guide.x2},${guide.y2}`} {...guide} stroke="#3B82F6" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />)}
          </svg>
        </ViewportPortal>
        <Controls position="bottom-left" showInteractive={false} />
        {board.nodes.length ? <MiniMap pannable ariaLabel="Network map overview" nodeColor={minimapColor} nodeStrokeWidth={0} style={{ width: 160, height: 100 }} /> : null}
      </ReactFlow>
      </NodeRates.Provider>
      </ToggleBox.Provider>
    </div>
    <footer style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Legend />
      <span role="status" className="text-amber-800 dark:text-amber-300" style={{ fontSize: 12 }}>{trafficFailed ? "Live traffic unavailable" : traffic?.warnings.length ? `Live traffic incomplete: ${traffic.warnings.join(", ")}` : ""}</span>
    </footer>
    {graph && selected ? <Panel graph={graph} node={selected} traffic={traffic} onClose={() => setSelectedId("")} /> : null}
    {graph && selectedEdge && !selected ? <LinePanel graph={graph} edge={selectedEdge} rate={edgeRates.get(networkFlowKey(selectedEdge))} onClose={() => setSelectedEdgeId("")} /> : null}
  </div>;
}
