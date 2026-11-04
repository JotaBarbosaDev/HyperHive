import type { NetworkGraph, NetworkGraphEdge, NetworkGraphFlow, NetworkGraphNode, NetworkPositions, NetworkRate, NetworkTraffic } from "@/services/network-graph";

const CARD_WIDTH = 250;
const CARD_HEIGHT = 54;
const CARD_GAP = 8;
const BOX_PADDING = 12;
const BOX_HEADER = 40;
const MACHINE_HEADER = 58;
const BOX_GAP = 20;
const COLUMN_GAP = 150;
// Above every box depth, so a card dropped over a nested box stays visible and grabbable.
const CARD_Z = 3;

export type NetworkFilter = {
  query: string;
  host: string;
  hiddenTypes: string[];
};

// Each division is one box on the board and one toggle in the toolbar.
export const NETWORK_DIVISIONS = [
  { id: "proxy", label: "Proxied domains", types: ["proxy"] },
  { id: "redirection", label: "Redirects", types: ["redirection"] },
  { id: "stream", label: "Streams", types: ["stream"] },
  { id: "domain", label: "DNS aliases", types: ["domain"] },
  { id: "upstream", label: "Upstream pools", types: ["upstream"] },
  { id: "celld", label: "Celld fleets", types: ["celld_fleet", "celld_member"] },
  { id: "docker", label: "Docker", types: ["container"] },
  { id: "k8s", label: "Kubernetes", types: ["k8s_cluster", "k8s_ingress", "k8s_service"] },
  { id: "wireguard", label: "WireGuard", types: ["wireguard", "wireguard_peer"] },
  { id: "unknown", label: "External / unknown", types: ["unknown"] },
  { id: "machines", label: "Machines", types: ["host", "interface", "bridge", "vm", "vm_nic"] },
];

// Each preset is the list of divisions it hides.
export const NETWORK_PRESETS = [
  { id: "all", label: "All", hidden: [] as string[] },
  { id: "routes", label: "Routes", hidden: ["wireguard", "domain"] },
  { id: "compute", label: "Compute", hidden: ["proxy", "redirection", "stream", "domain", "upstream", "unknown", "wireguard"] },
  { id: "vpn", label: "VPN", hidden: ["proxy", "redirection", "stream", "domain", "upstream", "unknown", "celld", "docker", "k8s"] },
];

// Undefined means the division toggles match no preset.
export const networkPresetFor = (hidden: string[]) => {
  const ids = new Set(hidden);
  return NETWORK_PRESETS.find((preset) => preset.hidden.length === ids.size && preset.hidden.every((id) => ids.has(id)));
};

const COLLAPSED_KEY = "network-map-collapsed";

// Per browser, and storage can be blocked or hold anything.
export const readNetworkCollapsed = () => {
  try {
    return list(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]"));
  } catch {
    return [];
  }
};

export const writeNetworkCollapsed = (ids: string[]) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids));
  } catch {
    // The boxes still collapse; they just reopen on the next visit.
  }
};

// A collapsed box must never hide a match.
export const networkActiveCollapsed = (collapsed: string[], query: string, host: string) => (query.trim() || host ? [] : collapsed);

export const MATCH_LABELS: Record<string, string> = {
  dns_alias: "DNS alias",
  hostname: "Hostname lookup",
  ip: "IP address",
  loopback: "Loopback (master host)",
  domain: "Domain",
  upstream: "Upstream pool",
  celld_port: "Celld port",
  docker_port: "Docker port",
  k8s_port: "Kubernetes port",
  k8s_ingress: "Ingress host",
  none: "No match",
};

export const STATUS_LABELS: Record<string, string> = {
  up: "Up",
  down: "Down",
  disabled: "Disabled",
  unknown: "Unknown",
};

export const networkMatchLabel = (match: string) => MATCH_LABELS[match] ?? match;
export const networkStatusLabel = (status: string) => STATUS_LABELS[status] ?? status;

export const networkDivisions = (graph: NetworkGraph) => {
  const types = new Set(graph.nodes.map((node) => node.type));
  return NETWORK_DIVISIONS.filter((division) => division.types.some((type) => types.has(type)));
};
export const networkHosts = (graph: NetworkGraph) => [...new Set(graph.nodes.filter((node) => node.type === "host").map((node) => node.host))].sort();

const searchText = (node: NetworkGraphNode) => `${node.label} ${node.id} ${node.host} ${JSON.stringify(node.details)}`.toLowerCase();

const CONTAINMENT_EDGES = new Set(["has_interface", "has_bridge", "bridges", "attached", "runs", "vpn", "has_nic", "k8s_member"]);

// Walks each direction separately, so tracing a VM shows the routes into it,
// not every sibling behind the same proxy or bridge. Forward walks follow routes
// only: reaching a host must not pull in everything that host contains.
const traceRoutes = (seeds: Set<string>, edges: NetworkGraphEdge[]) => {
  const walk = (from: "source" | "target", to: "source" | "target") => {
    const next = new Map<string, string[]>();
    for (const edge of edges) {
      if (from === "source" && CONTAINMENT_EDGES.has(edge.type)) continue;
      next.set(edge[from], [...(next.get(edge[from]) ?? []), edge[to]]);
    }
    const seen = new Set(seeds);
    const queue = [...seeds];
    while (queue.length) {
      for (const id of next.get(queue.pop()!) ?? []) {
        if (!seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
      }
    }
    return seen;
  };
  return new Set([...walk("source", "target"), ...walk("target", "source")]);
};

export const filterNetworkGraph = (graph: NetworkGraph, filter: NetworkFilter) => {
  const query = filter.query.trim().toLowerCase();
  let nodes = graph.nodes;
  if (query || filter.host) {
    const seeds = new Set(graph.nodes.filter((node) => (!filter.host || node.host === filter.host) && (!query || searchText(node).includes(query))).map((node) => node.id));
    const visible = traceRoutes(seeds, graph.edges);
    nodes = graph.nodes.filter((node) => visible.has(node.id));
  }
  const hidden = new Set(filter.hiddenTypes);
  nodes = nodes.filter((node) => !hidden.has(node.type));
  const ids = new Set(nodes.map((node) => node.id));
  return { nodes, edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
};

// generatedAt changes on every response and positions are compared on their own.
const graphContent = ({ nodes, edges, flows, warnings }: NetworkGraph) => JSON.stringify([nodes, edges, flows, warnings]);
export const networkGraphUnchanged = (a: NetworkGraph, b: NetworkGraph) => graphContent(a) === graphContent(b);

export const networkEdgeId = (edge: NetworkGraphEdge) => `${edge.source}|${edge.target}|${edge.type}|${edge.match}`;

const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const records = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
const target = (host: unknown, port: unknown) => (host ? `${host}${port ? `:${port}` : ""}` : "upstream pool");
const notUp = (node: NetworkGraphNode) => (node.status === "up" ? "" : ` · ${networkStatusLabel(node.status)}`);

// The card says what the node is, so nothing needs a second node to explain it.
export const networkCardText = (node: NetworkGraphNode) => {
  const { details } = node;
  const domains = list(details.domains);
  const more = domains.length > 1 ? ` +${domains.length - 1}` : "";
  switch (node.type) {
    case "proxy": {
      const first = (Array.isArray(details.targets) ? details.targets[0] : {}) as Record<string, unknown>;
      return { title: domains[0] ?? node.label, subtitle: `→ ${target(first.host, first.port)}${more}${notUp(node)}` };
    }
    case "redirection":
      return { title: domains[0] ?? node.label, subtitle: `→ ${details.target}${more}${notUp(node)}` };
    case "stream":
      return { title: `${node.label} ${details.tcp ? "TCP" : ""}${details.tcp && details.udp ? "+" : ""}${details.udp ? "UDP" : ""}`.trim(), subtitle: `→ ${target(details.host, details.port)}${notUp(node)}` };
    case "domain":
      return { title: node.label, subtitle: `→ ${list(details.aliasAddresses).join(", ")}` };
    case "upstream":
      return { title: node.label, subtitle: `${details.method ?? "pool"}${details.context ? ` · ${details.context}` : ""}` };
    case "vm":
      return { title: node.label, subtitle: `${list(details.addresses)[0] ?? "no address"}${notUp(node)}` };
    case "wireguard_peer":
      return { title: node.label, subtitle: `${details.address ?? ""}${notUp(node)}` };
    case "celld_fleet":
      return { title: node.label, subtitle: `:${details.httpPort} · ${details.members} member${details.members === 1 ? "" : "s"}${notUp(node)}` };
    case "celld_member":
      return { title: node.label, subtitle: `${details.address || "no address"}:${details.httpPort}${notUp(node)}` };
    case "container": {
      // Docker lists a port once per address family, and unpublished ports as 0.
      const ports = [...new Set(records(details.ports).map((port) => port.publicPort).filter(Boolean))];
      return { title: node.label, subtitle: `${details.image} · ${ports.map((port) => `:${port}`).join(",") || "no published ports"}${notUp(node)}` };
    }
    case "k8s_ingress": {
      const rules = records(details.rules);
      const extra = rules.length > 1 ? ` +${rules.length - 1}` : "";
      return { title: String(rules[0]?.host || node.label), subtitle: rules.length ? `→ ${rules[0].service}:${rules[0].port}${extra}` : "no rules" };
    }
    case "k8s_service": {
      const first = records(details.ports)[0];
      const port = first?.nodePort || first?.port;
      return { title: `${details.namespace}/${node.label}`, subtitle: `${details.serviceType}${port ? ` · :${port}` : ""}` };
    }
    case "vm_nic":
      return { title: String(details.vm), subtitle: [details.mac, details.model].filter(Boolean).join(" · ") };
    case "unknown":
      return { title: node.label, subtitle: list(details.addresses).join(", ") || "no match" };
    default:
      return { title: node.label, subtitle: networkStatusLabel(node.status) };
  }
};

export type NetworkBoardNode = {
  id: string;
  type: "card" | "box";
  position: { x: number; y: number };
  width: number;
  height: number;
  parentId?: string;
  zIndex?: number;
  extent?: [[number, number], [number, number]];
  selectable?: boolean;
  focusable?: boolean;
  ariaLabel?: string;
  data: { node?: NetworkGraphNode; title: string; subtitle?: string; kind?: "section" | "machine" | "network"; collapsed?: boolean };
};

// source and target are where the line is drawn; originals are the graph edges it stands for.
export type NetworkBoardEdge = { id: string; source: string; target: string; dashed: boolean; originals: NetworkGraphEdge[] };

// hidden maps each piece inside a collapsed box to its direct parent.
type Fold = { collapsed: Set<string>; hidden: Map<string, string> };

type Placed = { width: number; height: number; pieces: number; emit: (x: number, y: number, parentId?: string) => NetworkBoardNode[] };

const placeCard = (node: NetworkGraphNode): Placed => {
  const text = networkCardText(node);
  return {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    pieces: 1,
    emit: (x, y, parentId) => [{ id: node.id, type: "card", position: { x, y }, width: CARD_WIDTH, height: CARD_HEIGHT, zIndex: CARD_Z, ...(parentId ? { parentId } : {}), ariaLabel: `${text.title}, ${node.type}, ${text.subtitle}`, data: { node, ...text } }],
  };
};

const placeBox = (id: string, boxData: NetworkBoardNode["data"], allChildren: Placed[], fold: Fold, node?: NetworkGraphNode): Placed => {
  const collapsed = fold.collapsed.has(id);
  const pieces = allChildren.reduce((sum, child) => sum + child.pieces, 0);
  if (collapsed) for (const child of allChildren) for (const piece of child.emit(0, 0, id)) fold.hidden.set(piece.id, piece.parentId!);
  const children = collapsed ? [] : allChildren;
  // These two subtitles do not say how much is inside, which is all a collapsed box has left to show.
  const uncounted = boxData.kind === "machine" || node?.type === "k8s_cluster";
  const subtitle = collapsed && uncounted ? [boxData.subtitle, `${pieces} item${pieces === 1 ? "" : "s"}`].filter(Boolean).join(" · ") : boxData.subtitle;
  const data = { ...boxData, subtitle, collapsed };
  const header = data.kind === "machine" ? MACHINE_HEADER : BOX_HEADER;
  const inner = Math.max(CARD_WIDTH, ...children.map((child) => child.width));
  const width = inner + BOX_PADDING * 2;
  const height = header + BOX_PADDING + children.reduce((sum, child) => sum + child.height + CARD_GAP, children.length ? -CARD_GAP : 0);
  return {
    width,
    height,
    pieces: pieces + 1,
    emit: (x, y, parentId) => {
      const out: NetworkBoardNode[] = [{ id, type: "box", position: { x, y }, width, height, ...(parentId ? { parentId } : {}), selectable: !!node, focusable: !!node, ariaLabel: `${data.title}${data.subtitle ? `, ${data.subtitle}` : ""}`, data: { ...data, node } }];
      let top = header;
      for (const child of children) {
        out.push(...child.emit(BOX_PADDING, top, id));
        top += child.height + CARD_GAP;
      }
      return out;
    },
  };
};

const byLabel = (a: NetworkGraphNode, b: NetworkGraphNode) => a.label.localeCompare(b.label);

const placeMachine = (host: string, nodes: NetworkGraphNode[], fold: Fold) => {
  const self = nodes.find((node) => node.type === "host");
  const vms = nodes.filter((node) => node.type === "vm").sort(byLabel);
  const networks = nodes.filter((node) => node.type === "bridge").sort(byLabel);
  // The VM card already stands for its primary NIC.
  const nics = nodes.filter((node) => node.type === "vm_nic" && !node.details.primary).sort(byLabel);
  const children = networks.map((network) => {
    const members = vms.filter((vm) => vm.details.network === network.label);
    return placeBox(network.id, { title: network.label, subtitle: `${members.length} VM${members.length === 1 ? "" : "s"}`, kind: "network" }, [...members, ...nics.filter((nic) => nic.details.network === network.label)].map(placeCard), fold, network);
  });
  // VMs on a network missing from this view, or with none at all, sit directly on the machine.
  const networked = new Set(networks.map((network) => network.label));
  children.push(...vms.filter((vm) => !networked.has(String(vm.details.network))).map(placeCard));
  children.push(...nodes.filter((node) => node.type === "celld_member").sort(byLabel).map(placeCard));
  const containers = nodes.filter((node) => node.type === "container").sort(byLabel);
  if (containers.length) children.push(placeBox(`docker:${host}`, { title: "Docker", subtitle: `${containers.length} container${containers.length === 1 ? "" : "s"}`, kind: "network" }, containers.map(placeCard), fold));
  const interfaces = nodes.filter((node) => node.type === "interface").map((node) => node.label).sort();
  const offline = self?.status === "down" ? "Offline" : "";
  const role = self?.details.master ? "Master" : "";
  return placeBox(self?.id ?? `machine:${host}`, { title: host, subtitle: [offline, role, interfaces.join(", ")].filter(Boolean).join(" · "), kind: "machine" }, children, fold, self);
};

const stackColumn = (x: number, boxes: Placed[]) => {
  let y = 0;
  const out: NetworkBoardNode[] = [];
  for (const box of boxes) {
    out.push(...box.emit(x, y));
    y += box.height + BOX_GAP;
  }
  return { nodes: out, height: Math.max(0, y - BOX_GAP) };
};

// Absolute card centres, so a column can be ordered to run parallel to the next one.
const centres = (nodes: NetworkBoardNode[]) => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const top = (node: NetworkBoardNode): number => node.position.y + (node.parentId ? top(byId.get(node.parentId)!) : 0);
  return new Map(nodes.map((node) => [node.id, top(node) + (node.type === "card" ? node.height / 2 : BOX_HEADER / 2)]));
};

const orderByTargets = (nodes: NetworkGraphNode[], edges: NetworkGraphEdge[], rows: Map<string, number>) => {
  const row = (node: NetworkGraphNode) => {
    const targets = edges.filter((edge) => edge.source === node.id).map((edge) => rows.get(edge.target)).filter((value): value is number => value !== undefined);
    return targets.length ? Math.min(...targets) : Number.MAX_SAFE_INTEGER;
  };
  return [...nodes].sort((a, b) => row(a) - row(b) || a.label.localeCompare(b.label));
};

const section = (id: string, title: string, cards: NetworkGraphNode[], fold: Fold) => placeBox(`section:${id}`, { title, subtitle: String(cards.length), kind: "section" }, cards.map(placeCard), fold);

// Containment replaces lines: a VM sits inside its network, a network inside its machine.
// Only real routes stay as edges, and columns run entry points → pools → machines.
export const networkBoard = (nodes: NetworkGraphNode[], edges: NetworkGraphEdge[], collapsed: string[] = []) => {
  const ofType = (...types: string[]) => nodes.filter((node) => types.includes(node.type));
  const routed = new Set(edges.filter((edge) => edge.type === "routes").map((edge) => edge.source));

  const machineNodes = new Map<string, NetworkGraphNode[]>();
  for (const node of ofType("host", "interface", "bridge", "vm", "vm_nic", "celld_member", "container")) machineNodes.set(node.host, [...(machineNodes.get(node.host) ?? []), node]);
  const hosts = [...machineNodes.keys()].sort((a, b) => {
    const master = (host: string) => (machineNodes.get(host)!.some((node) => node.details.master) ? 0 : 1);
    return master(a) - master(b) || a.localeCompare(b);
  });
  const machines = (fold: Fold) => hosts.map((host) => placeMachine(host, machineNodes.get(host)!, fold));

  const peers = ofType("wireguard_peer").sort(byLabel);
  const server = ofType("wireguard")[0];
  const unknown = ofType("unknown").sort(byLabel);
  // An alias nothing could match already has its card, with its address, under External.
  const unmatched = new Set(unknown.map((node) => node.label));
  const aliases = ofType("domain").filter((node) => node.details.aliasAddresses && !routed.has(node.id) && !unmatched.has(node.label));

  const cluster = ofType("k8s_cluster")[0];
  const middle = (rows: Map<string, number>, fold: Fold) => [
    ...(ofType("upstream").length ? [section("upstream", "Upstream pools", orderByTargets(ofType("upstream"), edges, rows), fold)] : []),
    ...(ofType("celld_fleet").length ? [section("celld", "Celld fleets", orderByTargets(ofType("celld_fleet"), edges, rows), fold)] : []),
    ...(cluster ? [placeBox(cluster.id, { title: "Kubernetes", subtitle: `${cluster.details.ready}/${cluster.details.total} nodes`, kind: "section" }, [...orderByTargets(ofType("k8s_ingress"), edges, rows), ...orderByTargets(ofType("k8s_service"), edges, rows)].map(placeCard), fold, cluster)] : []),
    ...(unknown.length ? [section("unknown", "External / unknown", unknown, fold)] : []),
  ];

  // Cards are ordered by the fully open board, so collapsing a box never reshuffles the others.
  const open: Fold = { collapsed: new Set(), hidden: new Map() };
  const machineRows = centres(stackColumn(0, machines(open)).nodes);
  const rows = new Map(machineRows);
  for (const [id, y] of centres(stackColumn(0, middle(machineRows, open)).nodes)) rows.set(id, y);

  const fold: Fold = { collapsed: new Set(collapsed), hidden: new Map() };
  const machineColumn = stackColumn(0, machines(fold));
  const middleColumn = stackColumn(0, middle(machineRows, fold));

  const entries = [
    ["proxy", "Proxied domains", ofType("proxy")],
    ["redirection", "Redirects", ofType("redirection")],
    ["stream", "Streams", ofType("stream")],
    ["domain", "DNS aliases", aliases],
  ] as const;
  const entryColumn = stackColumn(0, [
    ...entries.filter(([, , cards]) => cards.length).map(([id, title, cards]) => section(id, title, orderByTargets([...cards], edges, rows), fold)),
    // VPN clients are entry points too, and this box has no routes to draw.
    ...(server || peers.length ? [placeBox(server?.id ?? "section:wireguard", { title: "WireGuard", subtitle: String(peers.length), kind: "section" }, peers.map(placeCard), fold, server)] : []),
  ]);

  const columns = [entryColumn, middleColumn, machineColumn].filter((column) => column.nodes.length);
  const out: NetworkBoardNode[] = [];
  let x = 0;
  for (const column of columns) {
    const top = column.nodes.filter((node) => !node.parentId);
    for (const node of top) node.position.x = x;
    out.push(...column.nodes);
    x += Math.max(...top.map((node) => node.width)) + COLUMN_GAP;
  }

  const shown = new Set(out.map((node) => node.id));
  const visibleEnd = (id: string) => {
    let end = id;
    while (fold.hidden.has(end)) end = fold.hidden.get(end)!;
    return end;
  };
  const routes = edges.filter((edge) => ["forwards", "resolves", "redirects", "celld_member", "k8s_route"].includes(edge.type) && shown.has(visibleEnd(edge.source)) && shown.has(visibleEnd(edge.target)));
  const lines = new Map<string, NetworkGraphEdge[]>();
  for (const edge of routes) {
    const ends = { source: visibleEnd(edge.source), target: visibleEnd(edge.target) };
    if (ends.source === ends.target) continue;
    lines.set(networkFlowKey(ends), [...(lines.get(networkFlowKey(ends)) ?? []), edge]);
  }
  const boardEdges = [...lines.values()].flatMap((group): NetworkBoardEdge[] => {
    const source = visibleEnd(group[0].source);
    const target = visibleEnd(group[0].target);
    const line = (id: string, originals: NetworkGraphEdge[]) => ({ id, source, target, dashed: originals.every((edge) => edge.match === "none"), originals });
    // Parallel lines that never moved stay separate: each still has its own type and match.
    const moved = group.some((edge) => edge.source !== source || edge.target !== target);
    return moved && group.length > 1 ? [line(`merged|${source}|${target}`, group)] : group.map((edge) => line(networkEdgeId(edge), [edge]));
  });
  return { nodes: out, edges: boardEdges, routes, folded: fold.hidden, width: Math.max(0, x - COLUMN_GAP), height: Math.max(0, ...columns.map((column) => column.height)) };
};

// Puts moved pieces where they were saved. Box sizes are not saved: a box always fits its
// pieces, in both directions, and a piece stays below its box header. React Flow's expandParent
// is not used because it only ever grows a box.
export const networkPlacedBoard = <T extends { nodes: NetworkBoardNode[] }>(board: T, positions: NetworkPositions) => {
  const parents = new Map(board.nodes.map((node) => [node.id, node]));
  const nodes = board.nodes.map((node): NetworkBoardNode => {
    const parent = node.parentId ? parents.get(node.parentId) : undefined;
    const header = parent?.data.kind === "machine" ? MACHINE_HEADER : BOX_HEADER;
    return { ...node, position: positions[node.id] ?? node.position, ...(parent ? { extent: [[BOX_PADDING, header], [Infinity, Infinity]] } : {}) };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Parents come first in the list, so walking it backwards fits the innermost boxes first.
  // A box with no pieces is never reached and keeps its default size.
  const fitted = new Set<string>();
  for (const node of [...nodes].reverse()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (!parent) continue;
    const start = fitted.has(parent.id);
    fitted.add(parent.id);
    parent.width = Math.max(start ? parent.width : 0, node.position.x + node.width + BOX_PADDING);
    parent.height = Math.max(start ? parent.height : 0, node.position.y + node.height + BOX_PADDING);
  }
  const top = nodes.filter((node) => !node.parentId);
  const left = Math.min(0, ...top.map((node) => node.position.x));
  const up = Math.min(0, ...top.map((node) => node.position.y));
  const right = Math.max(0, ...top.map((node) => node.position.x + node.width));
  const down = Math.max(0, ...top.map((node) => node.position.y + node.height));
  return { ...board, nodes, left, top: up, width: right - left, height: down - up };
};

export type NetworkGuide = { x1: number; y1: number; x2: number; y2: number };

// Pulls a dragged piece onto the nearest edge or centre of any other piece, on each axis, and
// returns the guide lines to draw. Guides are in board coordinates; the position stays relative
// to the piece's parent, so pieces in different boxes still line up on screen. A piece never
// snaps to the boxes around it or the pieces inside it: those move or resize with it.
export const networkSnap = (board: { nodes: NetworkBoardNode[] }, id: string, position: { x: number; y: number }, threshold: number) => {
  const byId = new Map(board.nodes.map((node) => [node.id, node]));
  const moved = byId.get(id);
  if (!moved) return { position, guides: [] as NetworkGuide[] };
  const parents = (node: NetworkBoardNode) => {
    const chain: NetworkBoardNode[] = [];
    for (let up = node.parentId ? byId.get(node.parentId) : undefined; up; up = up.parentId ? byId.get(up.parentId) : undefined) chain.push(up);
    return chain;
  };
  const around = parents(moved);
  const originX = around.reduce((sum, node) => sum + node.position.x, 0);
  const originY = around.reduce((sum, node) => sum + node.position.y, 0);
  const others = board.nodes.filter((node) => node !== moved && !around.includes(node) && !parents(node).includes(moved)).map((node) => {
    const chain = [node, ...parents(node)];
    return { x: chain.reduce((sum, item) => sum + item.position.x, 0), y: chain.reduce((sum, item) => sum + item.position.y, 0), width: node.width, height: node.height };
  });
  const nearest = (axis: "x" | "y", size: "width" | "height", start: number, min: number) => {
    let best: { delta: number; line: number; other: (typeof others)[number] } | undefined;
    for (const other of others) {
      for (const line of [other[axis], other[axis] + other[size] / 2, other[axis] + other[size]]) {
        for (const anchor of [0, moved[size] / 2, moved[size]]) {
          const delta = line - (start + anchor);
          if (Math.abs(delta) <= threshold && start + delta >= min && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line, other };
        }
      }
    }
    return best;
  };
  const [minX, minY] = moved.extent?.[0] ?? [-Infinity, -Infinity];
  const snapX = nearest("x", "width", originX + position.x, originX + minX);
  const snapY = nearest("y", "height", originY + position.y, originY + minY);
  const x = originX + position.x + (snapX?.delta ?? 0);
  const y = originY + position.y + (snapY?.delta ?? 0);
  const guides: NetworkGuide[] = [];
  if (snapX) guides.push({ x1: snapX.line, x2: snapX.line, y1: Math.min(y, snapX.other.y), y2: Math.max(y + moved.height, snapX.other.y + snapX.other.height) });
  if (snapY) guides.push({ y1: snapY.line, y2: snapY.line, x1: Math.min(x, snapY.other.x), x2: Math.max(x + moved.width, snapY.other.x + snapY.other.width) });
  return { position: { x: x - originX, y: y - originY }, guides };
};

// Edges on the routes through a node. For a box, that means routes through anything inside it.
// Tracing uses the real edges, so a collapsed box does not join every route that crosses it,
// and a route running between two pieces inside one still continues out the other side.
export const networkRouteEdges = (board: { nodes: NetworkBoardNode[]; edges: NetworkBoardEdge[]; routes: NetworkGraphEdge[]; folded: Map<string, string> }, id: string) => {
  const parents = new Map(board.folded);
  for (const node of board.nodes) if (node.parentId) parents.set(node.id, node.parentId);
  const seeds = new Set([id]);
  for (const piece of parents.keys()) {
    for (let up: string | undefined = piece; up; up = parents.get(up)) if (up === id) seeds.add(piece);
  }
  const route = traceRoutes(seeds, board.routes);
  return new Set(board.edges.filter((edge) => edge.originals.some((original) => route.has(original.source) && route.has(original.target))).map((edge) => edge.id));
};

export const networkNodeRoute = (node: NetworkGraphNode): string | null => {
  switch (node.type) {
    case "host":
      return `/dashboard/${encodeURIComponent(node.host)}`;
    case "vm":
      return "/vms";
    case "proxy":
      return "/proxy";
    case "redirection":
      return "/redirection";
    case "stream":
      return "/streams";
    case "upstream":
      return "/upstreams";
    case "wireguard":
    case "wireguard_peer":
      return "/wireguard";
    case "celld_fleet":
    case "celld_member":
      return "/celld-fleet";
    case "domain":
      return node.details.aliasAddresses ? "/dns" : null;
    default:
      return null;
  }
};

const detailText = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

export const networkDetailRows = (node: NetworkGraphNode) =>
  Object.entries(node.details)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => ({ key, value: Array.isArray(value) && value.every((item) => typeof item === "string") ? value.join(", ") : detailText(value) }));

export const networkRateText = (bytesPerSecond: number) => {
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bytesPerSecond;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

const directedRate = (rate: NetworkRate, out: string, back: string) =>
  [rate.sent >= 1 ? `${out} ${networkRateText(rate.sent)}` : "", rate.received >= 1 ? `${back} ${networkRateText(rate.received)}` : ""].filter(Boolean).join("  ");

// Arrows follow the line: → towards the target, ← back from it.
export const networkEdgeRateText = (rate: NetworkEdgeRate) => `${directedRate(rate, "→", "←")}${rate.shared ? " · shared" : ""}`;
export const networkNodeRateText = (rate?: NetworkRate) => (rate ? directedRate(rate, "↑", "↓") : "");

export type NetworkEdgeRate = NetworkRate & { shared: boolean };

export const networkFlowKey = (edge: { source: string; target: string }) => `${edge.source}|${edge.target}`;

// A socket does not say which proxy opened it, so routes into one target on the same
// port report the same number. `shared` keeps that from reading as separate traffic.
export const networkEdgeRates = (flows: NetworkGraphFlow[] = [], traffic: NetworkTraffic | null) => {
  const rates = new Map<string, NetworkEdgeRate>();
  if (!traffic) return rates;
  for (const flow of flows) {
    const moving = flow.endpoints.filter((endpoint) => traffic.endpoints[endpoint]);
    if (!moving.length) continue;
    const shared = flows.some((other) => other.target === flow.target && other.source !== flow.source && other.endpoints.some((endpoint) => moving.includes(endpoint)));
    rates.set(networkFlowKey(flow), {
      sent: moving.reduce((sum, endpoint) => sum + traffic.endpoints[endpoint].sent, 0),
      received: moving.reduce((sum, endpoint) => sum + traffic.endpoints[endpoint].received, 0),
      shared,
    });
  }
  return rates;
};

// Logarithmic, because a busy line moves a million times more than an idle one.
export const networkEdgeWidth = (rate: NetworkRate) => 1.5 + Math.min(5, Math.log10(1 + (rate.sent + rate.received) / 1000));

// Each row reads as a sentence in the side panel, so the match method stays visible.
export const networkNodeLinks = (graph: NetworkGraph, id: string, traffic: NetworkTraffic | null = null) => {
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const rates = networkEdgeRates(graph.flows, traffic);
  const rateText = (edge: NetworkGraphEdge) => {
    const rate = rates.get(networkFlowKey(edge));
    if (rate) return networkEdgeRateText(rate);
    // What a machine contains has no line, so its own counters describe the link.
    return edge.source === id && CONTAINMENT_EDGES.has(edge.type) ? networkNodeRateText(traffic?.nodes[edge.target]) : "";
  };
  return graph.edges
    .filter((edge) => edge.source === id || edge.target === id)
    .map((edge) => ({
      key: networkEdgeId(edge),
      direction: edge.source === id ? ("out" as const) : ("in" as const),
      peer: labels.get(edge.source === id ? edge.target : edge.source) ?? "",
      type: edge.type,
      match: edge.match ? networkMatchLabel(edge.match) : "",
      rate: rateText(edge),
    }));
};

// Every NIC of a VM, primary included, for its side panel.
export const networkVmNics = (graph: NetworkGraph, id: string, traffic: NetworkTraffic | null = null) => {
  const nics = new Set(graph.edges.filter((edge) => edge.source === id && edge.type === "has_nic").map((edge) => edge.target));
  return graph.nodes.filter((node) => nics.has(node.id)).map((node) => ({ id: node.id, mac: String(node.details.mac), network: String(node.details.network ?? ""), model: String(node.details.model ?? ""), rate: networkNodeRateText(traffic?.nodes[node.id]) }));
};

export type NetworkHistorySource = { label: string; keys: string[] };

const OWN_TRAFFIC_TYPES = new Set(["vm", "vm_nic", "wireguard_peer", "interface"]);
const ROUTE_TRAFFIC_TYPES = new Set(["celld_member", "container", "k8s_ingress", "k8s_service"]);
const MAX_HISTORY_KEYS = 64;

// The saved series behind a line: the same endpoints its live rate adds up.
export const networkLineHistorySource = (graph: NetworkGraph, edge: { source: string; target: string }): NetworkHistorySource | null => {
  const flow = graph.flows.find((item) => networkFlowKey(item) === networkFlowKey(edge));
  return flow?.endpoints.length ? { label: "Line", keys: flow.endpoints.slice(0, MAX_HISTORY_KEYS) } : null;
};

// A host has no counter of its own, and adding its interfaces would count bridged traffic twice.
export const networkNodeHistorySources = (graph: NetworkGraph, node: NetworkGraphNode): NetworkHistorySource[] => {
  if (OWN_TRAFFIC_TYPES.has(node.type)) return [{ label: node.label, keys: [node.id] }];
  if (node.type === "host") {
    const interfaces = new Set(graph.edges.filter((edge) => edge.source === node.id && edge.type === "has_interface").map((edge) => edge.target));
    return graph.nodes.filter((item) => interfaces.has(item.id)).map((item) => ({ label: item.label, keys: [item.id] }));
  }
  // These have no counter of their own: each charts the routes into it, a fleet all its members.
  const members = new Set(ROUTE_TRAFFIC_TYPES.has(node.type) ? [node.id] : graph.edges.filter((edge) => edge.source === node.id && edge.type === "celld_member").map((edge) => edge.target));
  const keys = [...new Set(graph.flows.filter((flow) => (ROUTE_TRAFFIC_TYPES.has(node.type) || node.type === "celld_fleet" ? members.has(flow.target) : flow.source === node.id)).flatMap((flow) => flow.endpoints))];
  return keys.length ? [{ label: node.label, keys: keys.slice(0, MAX_HISTORY_KEYS) }] : [];
};

export const networkBytesText = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};
