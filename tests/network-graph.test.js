jest.mock("../services/api-client", () => ({ apiFetch: jest.fn(async () => ({ nodes: [] })) }));
import { apiFetch } from "../services/api-client";
import { getNetworkGraph, getNetworkTrafficHistory, resetNetworkLayout, saveNetworkLayout } from "../services/network-graph";
import {
  filterNetworkGraph,
  NETWORK_PRESETS,
  networkActiveCollapsed,
  networkBoard,
  networkCardText,
  networkDetailRows,
  networkDivisions,
  networkEdgeEnds,
  networkEdgeRates,
  networkEdgeRateText,
  networkEdgeWidth,
  networkGraphUnchanged,
  networkBytesText,
  networkHosts,
  networkLineHistorySource,
  networkNodeHistorySources,
  networkNodeLinks,
  networkNodeRateText,
  networkNodeRoute,
  networkPlacedBoard,
  networkPresetFor,
  networkRateText,
  networkRouteEdges,
  networkSnap,
  networkVmNics,
  readNetworkCollapsed,
  writeNetworkCollapsed,
} from "../utils/network-graph";

const node = (id, type, host = "", over = {}) => ({ id, type, label: id, host, status: "up", details: {}, ...over });
const edge = (source, target, type = "forwards", match = "") => ({ source, target, type, match });

const graph = {
  generatedAt: "2026-11-04T12:00:00Z",
  warnings: [],
  nodes: [
    node("domain:a.example", "domain"),
    node("proxy:1", "proxy", "alpha"),
    node("host:alpha", "host", "alpha"),
    node("bridge:alpha:br0", "bridge", "alpha"),
    node("vm:alpha:web", "vm", "alpha", { details: { addresses: ["192.0.2.5"] } }),
    node("vm:alpha:other", "vm", "alpha"),
    node("host:beta", "host", "beta"),
    node("vm:beta:db", "vm", "beta"),
    node("unknown:203.0.113.7", "unknown"),
  ],
  edges: [
    edge("domain:a.example", "proxy:1", "routes"),
    edge("proxy:1", "vm:alpha:web", "forwards", "ip"),
    edge("proxy:1", "unknown:203.0.113.7", "forwards", "none"),
    edge("host:alpha", "bridge:alpha:br0", "has_bridge"),
    edge("bridge:alpha:br0", "vm:alpha:web", "attached"),
    edge("bridge:alpha:br0", "vm:alpha:other", "attached"),
    edge("host:beta", "vm:beta:db", "runs"),
  ],
};

const ids = (result) => result.nodes.map((item) => item.id).sort();

describe("network graph filters", () => {
  it("shows everything with no filter", () => {
    const result = filterNetworkGraph(graph, { query: "", host: "", hiddenTypes: [] });
    expect(result.nodes).toHaveLength(graph.nodes.length);
    expect(result.edges).toHaveLength(graph.edges.length);
  });

  it("traces a domain through to its VM without its siblings", () => {
    const result = filterNetworkGraph(graph, { query: "A.EXAMPLE", host: "", hiddenTypes: [] });
    expect(ids(result)).toEqual(["domain:a.example", "proxy:1", "unknown:203.0.113.7", "vm:alpha:web"]);
  });

  it("traces a VM back to its domain and host, matching details", () => {
    const result = filterNetworkGraph(graph, { query: "192.0.2.5", host: "", hiddenTypes: [] });
    expect(ids(result)).toEqual(["bridge:alpha:br0", "domain:a.example", "host:alpha", "proxy:1", "vm:alpha:web"]);
    expect(ids(result)).not.toContain("vm:alpha:other");
  });

  it("stops at a host instead of pulling in everything on it", () => {
    const routed = { ...graph, edges: [...graph.edges, edge("domain:a.example", "host:alpha", "resolves", "ip")] };
    const result = ids(filterNetworkGraph(routed, { query: "a.example", host: "", hiddenTypes: [] }));
    expect(result).toContain("host:alpha");
    expect(result).not.toContain("vm:alpha:other");
  });

  it("filters by host and keeps the routes in", () => {
    expect(ids(filterNetworkGraph(graph, { query: "", host: "beta", hiddenTypes: [] }))).toEqual(["host:beta", "vm:beta:db"]);
    expect(ids(filterNetworkGraph(graph, { query: "", host: "alpha", hiddenTypes: [] }))).toContain("domain:a.example");
  });

  it("drops hidden types and their edges", () => {
    const result = filterNetworkGraph(graph, { query: "", host: "", hiddenTypes: ["proxy"] });
    expect(ids(result)).not.toContain("proxy:1");
    expect(result.edges.some((item) => item.source === "proxy:1" || item.target === "proxy:1")).toBe(false);
  });

  it("returns nothing for a search with no match", () => {
    expect(filterNetworkGraph(graph, { query: "nope", host: "", hiddenTypes: [] }).nodes).toEqual([]);
  });

  it("lists hosts and only the divisions in use", () => {
    expect(networkHosts(graph)).toEqual(["alpha", "beta"]);
    expect(networkDivisions(graph).map((division) => division.id)).toEqual(["proxy", "domain", "unknown", "machines"]);
  });
});

describe("network board", () => {
  const rich = {
    nodes: [
      node("domain:a.example", "domain", "", { details: { aliasAddresses: ["10.0.0.1"] } }),
      node("domain:home.lan", "domain", "", { details: { aliasAddresses: ["192.0.2.5"] } }),
      node("proxy:1", "proxy", "alpha", { label: "a.example", details: { domains: ["a.example", "b.example"], targets: [{ host: "web.home", port: 80 }] } }),
      node("host:alpha", "host", "alpha", { details: { master: true } }),
      node("interface:alpha:eth0", "interface", "alpha", { label: "eth0" }),
      node("bridge:alpha:br0", "bridge", "alpha", { label: "br0" }),
      node("vm:alpha:web", "vm", "alpha", { label: "web", details: { network: "br0", addresses: ["192.0.2.5"] } }),
      node("vm:alpha:loose", "vm", "alpha", { label: "loose", details: { network: "" } }),
      node("host:beta", "host", "beta", { status: "down", details: {} }),
      node("wireguard:master", "wireguard", "alpha"),
      node("wireguard:peer:1", "wireguard_peer", "alpha", { label: "laptop", details: { address: "10.8.0.2/32" } }),
      node("unknown:x", "unknown"),
    ],
    edges: [
      edge("domain:a.example", "proxy:1", "routes"),
      edge("domain:a.example", "host:alpha", "resolves", "ip"),
      edge("domain:home.lan", "vm:alpha:web", "resolves", "dns_alias"),
      edge("proxy:1", "vm:alpha:web", "forwards", "ip"),
      edge("proxy:1", "unknown:x", "forwards", "none"),
      edge("host:alpha", "interface:alpha:eth0", "has_interface"),
      edge("host:alpha", "bridge:alpha:br0", "has_bridge"),
      edge("bridge:alpha:br0", "vm:alpha:web", "attached"),
      edge("host:alpha", "wireguard:master", "vpn"),
      edge("wireguard:master", "wireguard:peer:1", "vpn"),
    ],
  };
  const board = networkBoard(rich.nodes, rich.edges);
  const find = (id) => board.nodes.find((item) => item.id === id);

  it("shows each thing once", () => {
    expect(find("domain:a.example")).toBeUndefined();
    expect(find("interface:alpha:eth0")).toBeUndefined();
    expect(new Set(board.nodes.map((item) => item.id)).size).toBe(board.nodes.length);
    expect(board.nodes.filter((item) => item.data.title === "alpha")).toHaveLength(1);
  });

  it("nests VMs in their network and networks in their machine", () => {
    expect(find("vm:alpha:web").parentId).toBe("bridge:alpha:br0");
    expect(find("bridge:alpha:br0").parentId).toBe("host:alpha");
    expect(find("vm:alpha:loose").parentId).toBe("host:alpha");
    expect(find("host:alpha").data.subtitle).toBe("Master · eth0");
    expect(find("host:beta").data.subtitle).toBe("Offline");
  });

  it("gives every division its own box and orders columns left to right", () => {
    expect(find("proxy:1").parentId).toBe("section:proxy");
    expect(find("domain:home.lan").parentId).toBe("section:domain");
    expect(find("wireguard:peer:1").parentId).toBe("wireguard:master");
    expect(find("wireguard:master").position.x).toBe(find("section:proxy").position.x);
    expect(find("unknown:x").parentId).toBe("section:unknown");
    expect(find("section:proxy").position.x).toBeLessThan(find("section:unknown").position.x);
    expect(find("section:unknown").position.x).toBeLessThan(find("host:alpha").position.x);
    expect(find("host:alpha").position.y).toBeLessThan(find("host:beta").position.y);
  });

  it("keeps parents before children and children inside their box", () => {
    const seen = new Set();
    for (const item of board.nodes) {
      if (item.parentId) {
        expect(seen.has(item.parentId)).toBe(true);
        const parent = find(item.parentId);
        expect(item.position.x + item.width).toBeLessThanOrEqual(parent.width);
        expect(item.position.y + item.height).toBeLessThanOrEqual(parent.height);
      }
      seen.add(item.id);
    }
  });

  it("draws routes only, dashing unmatched targets", () => {
    expect(board.edges.map((item) => `${item.source}>${item.target}:${item.dashed}`).sort()).toEqual([
      "domain:home.lan>vm:alpha:web:false",
      "proxy:1>unknown:x:true",
      "proxy:1>vm:alpha:web:false",
    ]);
  });

  it("orders entry cards to run parallel to their targets", () => {
    const nodes = [node("host:h", "host", "h"), node("bridge:h:n", "bridge", "h", { label: "n" }), ...["a", "z"].map((name) => node(`vm:h:${name}`, "vm", "h", { label: name, details: { network: "n" } })), node("proxy:1", "proxy", "h", { label: "first" }), node("proxy:2", "proxy", "h", { label: "second" })];
    const result = networkBoard(nodes, [edge("proxy:1", "vm:h:z"), edge("proxy:2", "vm:h:a")]);
    const y = (id) => result.nodes.find((item) => item.id === id).position.y;
    expect(y("proxy:2")).toBeLessThan(y("proxy:1"));
  });

  it("lights the routes through a card or anything inside a box", () => {
    const targets = (id) => [...networkRouteEdges(board, id)].map((key) => key.split("|").slice(0, 2).join(">")).sort();
    expect(targets("proxy:1")).toEqual(["proxy:1>unknown:x", "proxy:1>vm:alpha:web"]);
    expect(targets("unknown:x")).toEqual(["proxy:1>unknown:x"]);
    expect(targets("host:alpha")).toEqual(["domain:home.lan>vm:alpha:web", "proxy:1>vm:alpha:web"]);
    expect(targets("wireguard:peer:1")).toEqual([]);
  });

  it("does not repeat an alias that is already an unmatched target", () => {
    const result = networkBoard([node("domain:nas.home", "domain", "", { label: "nas.home", details: { aliasAddresses: ["10.0.0.9"] } }), node("unknown:nas.home", "unknown", "", { label: "nas.home" })], []);
    expect(result.nodes.filter((item) => item.data.title === "nas.home").map((item) => item.id)).toEqual(["unknown:nas.home"]);
  });

  it("handles an empty board and filtered-out parents", () => {
    expect(networkBoard([], [])).toMatchObject({ nodes: [], edges: [], width: 0, height: 0 });
    const orphan = networkBoard([node("vm:h:a", "vm", "h", { label: "a", details: { network: "gone" } })], []);
    expect(orphan.nodes.map((item) => item.id)).toEqual(["machine:h", "vm:h:a"]);
    expect(orphan.nodes[0].selectable).toBe(false);
  });
});

describe("network card text", () => {
  it("says where each entry point goes", () => {
    expect(networkCardText(node("p", "proxy", "", { label: "x", details: { domains: ["a", "b"], targets: [{ host: "h", port: 80 }] } }))).toEqual({ title: "a", subtitle: "→ h:80 +1" });
    expect(networkCardText(node("p", "proxy", "", { status: "disabled", details: { domains: ["a"], targets: [{ host: "", port: 0 }] } })).subtitle).toBe("→ upstream pool · Disabled");
    expect(networkCardText(node("s", "stream", "", { label: ":22", details: { tcp: true, udp: true, host: "h", port: 22 } }))).toEqual({ title: ":22 TCP+UDP", subtitle: "→ h:22" });
    expect(networkCardText(node("r", "redirection", "", { details: { domains: ["old"], target: "new" } }))).toEqual({ title: "old", subtitle: "→ new" });
    expect(networkCardText(node("v", "vm", "", { label: "v", status: "down", details: {} })).subtitle).toBe("no address · Down");
  });
});

describe("network graph side panel", () => {
  it("opens the right page, or none", () => {
    expect(networkNodeRoute(node("h", "host", "my host"))).toBe("/dashboard/my%20host");
    expect(networkNodeRoute(node("v", "vm"))).toBe("/vms");
    expect(networkNodeRoute(node("p", "wireguard_peer"))).toBe("/wireguard");
    expect(networkNodeRoute(node("d", "domain", "", { details: { aliasAddresses: ["1.1.1.1"] } }))).toBe("/dns");
    expect(networkNodeRoute(node("d", "domain"))).toBeNull();
    expect(networkNodeRoute(node("u", "unknown"))).toBeNull();
  });

  it("hides empty details and flattens string lists", () => {
    const rows = networkDetailRows(node("v", "vm", "", { details: { addresses: ["a", "b"], network: "", none: [], live: false, targets: [{ port: 80 }] } }));
    expect(rows).toEqual([{ key: "addresses", value: "a, b" }, { key: "live", value: "false" }, { key: "targets", value: '[{"port":80}]' }]);
  });

  it("names each link and its match method", () => {
    const links = networkNodeLinks(graph, "proxy:1");
    expect(links).toContainEqual(expect.objectContaining({ direction: "out", peer: "vm:alpha:web", match: "IP address" }));
    expect(links).toContainEqual(expect.objectContaining({ direction: "out", peer: "unknown:203.0.113.7", match: "No match" }));
    expect(links).toContainEqual(expect.objectContaining({ direction: "in", peer: "domain:a.example", match: "" }));
  });
});

it("requests the graph without reporting a global result", async () => {
  await getNetworkGraph();
  expect(apiFetch).toHaveBeenCalledWith("/network/graph", { signal: undefined, reportResult: false });
});

describe("network traffic", () => {
  const flows = [
    { source: "proxy:1", target: "upstream:1", endpoints: ["10.0.0.8:80", "10.0.0.9:80"] },
    { source: "upstream:1", target: "vm:a:web", endpoints: ["10.0.0.8:80"] },
    { source: "proxy:2", target: "vm:a:app", endpoints: ["10.0.0.7:80"] },
    { source: "proxy:3", target: "vm:a:app", endpoints: ["10.0.0.7:80"] },
    { source: "proxy:4", target: "vm:a:app", endpoints: ["10.0.0.7:81"] },
    { source: "stream:1", target: "vm:a:idle", endpoints: ["10.0.0.6:25"] },
  ];
  const traffic = {
    at: "2026-11-04T12:00:00Z",
    warnings: [],
    endpoints: { "10.0.0.8:80": { sent: 100, received: 2000 }, "10.0.0.9:80": { sent: 50, received: 0 }, "10.0.0.7:80": { sent: 1, received: 1 }, "10.0.0.7:81": { sent: 5, received: 5 } },
    nodes: { "interface:a:eth0": { sent: 1500, received: 0 }, "vm:a:web": { sent: 10, received: 20 } },
  };

  it("sums an edge's endpoints and skips idle edges", () => {
    const rates = networkEdgeRates(flows, traffic);
    expect(rates.get("proxy:1|upstream:1")).toEqual({ sent: 150, received: 2000, shared: false });
    expect(rates.get("upstream:1|vm:a:web")).toEqual({ sent: 100, received: 2000, shared: false });
    expect(rates.has("stream:1|vm:a:idle")).toBe(false);
  });

  it("marks only routes that really report the same socket", () => {
    const rates = networkEdgeRates(flows, traffic);
    expect(rates.get("proxy:2|vm:a:app").shared).toBe(true);
    expect(rates.get("proxy:3|vm:a:app").shared).toBe(true);
    expect(rates.get("proxy:4|vm:a:app").shared).toBe(false);
  });

  it("has no rates without traffic or with a graph from an older master", () => {
    expect(networkEdgeRates(flows, null).size).toBe(0);
    expect(networkEdgeRates(undefined, traffic).size).toBe(0);
  });

  it("formats rates for people", () => {
    expect(networkRateText(0.4)).toBe("0 B/s");
    expect(networkRateText(999)).toBe("999 B/s");
    expect(networkRateText(1500)).toBe("1.5 KB/s");
    expect(networkRateText(250_000_000)).toBe("250 MB/s");
    expect(networkRateText(5e12)).toBe("5000 GB/s");
    expect(networkEdgeRateText({ sent: 1500, received: 0, shared: true })).toBe("→ 1.5 KB/s · shared");
    expect(networkEdgeRateText({ sent: 1500, received: 2000, shared: false })).toBe("→ 1.5 KB/s  ← 2.0 KB/s");
    expect(networkNodeRateText({ sent: 0, received: 2000 })).toBe("↓ 2.0 KB/s");
    expect(networkNodeRateText(undefined)).toBe("");
  });

  it("grows lines with traffic, within bounds", () => {
    expect(networkEdgeWidth({ sent: 0, received: 0 })).toBe(1.5);
    expect(networkEdgeWidth({ sent: 1e6, received: 0 })).toBeGreaterThan(networkEdgeWidth({ sent: 1e3, received: 0 }));
    expect(networkEdgeWidth({ sent: 1e15, received: 0 })).toBe(6.5);
  });

  it("adds rates to side panel links", () => {
    const small = {
      nodes: [node("host:a", "host", "a"), node("interface:a:eth0", "interface", "a"), node("proxy:1", "proxy"), node("upstream:1", "upstream")],
      edges: [edge("host:a", "interface:a:eth0", "has_interface"), edge("proxy:1", "upstream:1")],
      flows,
      warnings: [],
    };
    expect(networkNodeLinks(small, "host:a", traffic)[0].rate).toBe("↑ 1.5 KB/s");
    expect(networkNodeLinks(small, "interface:a:eth0", traffic)[0].rate).toBe("");
    expect(networkNodeLinks(small, "proxy:1", traffic)[0].rate).toBe("→ 150 B/s  ← 2.0 KB/s");
  });
});

describe("network history sources", () => {
  const history = {
    nodes: [node("host:a", "host", "a"), node("interface:a:eth0", "interface", "a"), node("vm:a:web", "vm", "a"), node("proxy:1", "proxy"), node("bridge:a", "bridge", "a")],
    edges: [edge("host:a", "interface:a:eth0", "has_interface"), edge("proxy:1", "vm:a:web")],
    flows: [{ source: "proxy:1", target: "vm:a:web", endpoints: ["10.0.0.5:80", "10.0.0.5:443"] }],
  };
  const byId = (id) => history.nodes.find((item) => item.id === id);

  it("reads a line from its endpoints and misses lines without flows", () => {
    expect(networkLineHistorySource(history, { source: "proxy:1", target: "vm:a:web" }).keys).toEqual(["10.0.0.5:80", "10.0.0.5:443"]);
    expect(networkLineHistorySource(history, { source: "x", target: "y" })).toBeNull();
  });

  it("uses own counters, host interfaces, or outgoing endpoints", () => {
    expect(networkNodeHistorySources(history, byId("vm:a:web"))).toEqual([{ label: "vm:a:web", keys: ["vm:a:web"] }]);
    expect(networkNodeHistorySources(history, byId("host:a")).map((source) => source.keys)).toEqual([["interface:a:eth0"]]);
    expect(networkNodeHistorySources(history, byId("proxy:1"))[0].keys).toEqual(["10.0.0.5:80", "10.0.0.5:443"]);
    expect(networkNodeHistorySources(history, byId("bridge:a"))).toEqual([]);
  });

  it("formats totals", () => {
    expect(networkBytesText(512)).toBe("512 B");
    expect(networkBytesText(1500000)).toBe("1.5 MB");
  });

  it("requests the range with every key", async () => {
    await getNetworkTrafficHistory("7d", ["10.0.0.5:80", "vm:a:web"]);
    expect(apiFetch.mock.calls.at(-1)[0]).toBe("/network/traffic/history?range=7d&key=10.0.0.5%3A80&key=vm%3Aa%3Aweb");
  });
});

describe("saved layout", () => {
  const nodes = [
    node("host:h", "host", "h", { label: "h" }),
    node("bridge:h:br0", "bridge", "h", { label: "br0" }),
    node("vm:h:a", "vm", "h", { label: "a", details: { network: "br0" } }),
    node("proxy:1", "proxy"),
  ];
  const base = networkBoard(nodes, []);
  const at = (board, id) => board.nodes.find((item) => item.id === id);

  test("changes nothing without saved positions, and leaves the default board alone", () => {
    const placed = networkPlacedBoard(base, {});
    expect(placed.nodes.map((item) => item.position)).toEqual(base.nodes.map((item) => item.position));
    expect(placed).toMatchObject({ left: 0, top: 0, width: base.width, height: base.height });
    networkPlacedBoard(base, { "vm:h:a": { x: 900, y: 900 } });
    expect(at(base, "bridge:h:br0").width).toBe(at(networkBoard(nodes, []), "bridge:h:br0").width);
  });

  test("a moved piece grows every box around it", () => {
    const placed = networkPlacedBoard(base, { "vm:h:a": { x: 400, y: 300 } });
    const vm = at(placed, "vm:h:a");
    const network = at(placed, "bridge:h:br0");
    const machine = at(placed, "host:h");
    expect(vm.position).toEqual({ x: 400, y: 300 });
    expect(network.width).toBeGreaterThanOrEqual(400 + vm.width);
    expect(network.height).toBeGreaterThanOrEqual(300 + vm.height);
    expect(machine.width).toBeGreaterThanOrEqual(network.position.x + network.width);
    expect(machine.height).toBeGreaterThanOrEqual(network.position.y + network.height);
  });

  test("a box shrinks back when its piece returns, in every box around it", () => {
    const far = networkPlacedBoard(base, { "vm:h:a": { x: 400, y: 300 } });
    const back = networkPlacedBoard(far, { "vm:h:a": at(base, "vm:h:a").position });
    for (const id of ["bridge:h:br0", "host:h"]) expect(at(back, id)).toMatchObject({ width: at(base, id).width, height: at(base, id).height });
  });

  test("a box fits the pieces it has, not its default stack", () => {
    const stack = networkBoard([node("proxy:1", "proxy"), node("proxy:2", "proxy"), node("proxy:3", "proxy")], []);
    const lowest = stack.nodes.at(-1);
    const placed = networkPlacedBoard(stack, { [lowest.id]: at(stack, stack.nodes[1].id).position });
    expect(at(placed, "section:proxy").height).toBeLessThan(at(stack, "section:proxy").height);
    const empty = networkBoard([node("host:h", "host", "h", { label: "h" }), node("bridge:h:br0", "bridge", "h", { label: "br0" })], []);
    expect(at(networkPlacedBoard(empty, {}), "bridge:h:br0").height).toBe(at(empty, "bridge:h:br0").height);
  });

  test("pieces inside a box stay below its header, top-level boxes move freely", () => {
    const placed = networkPlacedBoard(base, {});
    expect(at(placed, "vm:h:a").extent).toEqual([[12, 40], [Infinity, Infinity]]);
    expect(at(placed, "bridge:h:br0").extent[0][1]).toBe(58);
    expect(at(placed, "host:h").extent).toBeUndefined();
  });

  test("bounds follow a box moved past the board edge", () => {
    const placed = networkPlacedBoard(base, { "host:h": { x: -500, y: -300 } });
    expect(placed.left).toBe(-500);
    expect(placed.top).toBe(-300);
    expect(networkPlacedBoard({ nodes: [], edges: [] }, { gone: { x: 5, y: 5 } })).toMatchObject({ nodes: [], left: 0, top: 0, width: 0, height: 0 });
  });

  test("saves and resets through the layout route", async () => {
    await saveNetworkLayout({ "vm:h:a": { x: 1, y: 2 } });
    expect(apiFetch).toHaveBeenLastCalledWith("/network/layout", { method: "PUT", body: { "vm:h:a": { x: 1, y: 2 } }, reportResult: false });
    await resetNetworkLayout();
    expect(apiFetch).toHaveBeenLastCalledWith("/network/layout", { method: "DELETE", reportResult: false });
  });
});

describe("celld on the board", () => {
  const celld = {
    ...graph,
    nodes: [
      ...graph.nodes,
      node("celld:f1", "celld_fleet", "", { label: "shop", details: { httpPort: 18080, members: 2 } }),
      node("celld:f1:alpha", "celld_member", "alpha", { label: "shop", details: { address: "192.0.2.1", httpPort: 18080 } }),
      node("celld:f1:beta", "celld_member", "beta", { label: "shop", status: "down", details: { address: "192.0.2.2", httpPort: 18080 } }),
    ],
    edges: [
      ...graph.edges,
      edge("celld:f1", "celld:f1:alpha", "celld_member"),
      edge("celld:f1", "celld:f1:beta", "celld_member"),
      edge("host:alpha", "celld:f1:alpha", "runs"),
      edge("proxy:1", "celld:f1:alpha", "forwards", "celld_port"),
    ],
  };
  const board = (hiddenTypes = []) => {
    const view = filterNetworkGraph(celld, { query: "", host: "", hiddenTypes });
    return networkBoard(view.nodes, view.edges);
  };

  it("places members in their machine and the fleet in its section", () => {
    const placed = new Map(board().nodes.map((item) => [item.id, item]));
    expect(placed.get("celld:f1:alpha").parentId).toBe("host:alpha");
    expect(placed.get("celld:f1:beta").parentId).toBe("host:beta");
    expect(placed.get("celld:f1").parentId).toBe("section:celld");
  });

  it("draws fleet and route lines but not containment", () => {
    const lines = board().edges.map((item) => `${item.source}>${item.target}`);
    expect(lines).toEqual(expect.arrayContaining(["celld:f1>celld:f1:alpha", "celld:f1>celld:f1:beta", "proxy:1>celld:f1:alpha"]));
    expect(lines).not.toContain("host:alpha>celld:f1:alpha");
  });

  it("hides cards and lines with the toggle", () => {
    const division = networkDivisions(celld).find((item) => item.id === "celld");
    const hidden = board(division.types);
    expect(hidden.nodes.some((item) => item.id.startsWith("celld:") || item.id === "section:celld")).toBe(false);
    expect(hidden.edges.some((item) => item.target.startsWith("celld:"))).toBe(false);
  });

  it("keeps the real machine box when searching a fleet", () => {
    const view = filterNetworkGraph(celld, { query: "celld:f1:alpha", host: "", hiddenTypes: [] });
    expect(ids(view)).toEqual(expect.arrayContaining(["celld:f1", "celld:f1:alpha", "host:alpha", "proxy:1"]));
  });

  it("keeps cards above nested boxes", () => {
    const placed = new Map(board().nodes.map((item) => [item.id, item]));
    expect(placed.get("celld:f1:alpha").zIndex).toBe(placed.get("vm:alpha:web").zIndex);
    expect(placed.get("celld:f1:alpha").zIndex).toBeGreaterThan(2);
  });

  it("charts routes into a member, and all members for a fleet", () => {
    const flows = [
      { source: "proxy:1", target: "celld:f1:alpha", endpoints: ["192.0.2.1:18080"] },
      { source: "proxy:2", target: "celld:f1:beta", endpoints: ["192.0.2.2:18080"] },
      { source: "proxy:3", target: "vm:alpha:web", endpoints: ["192.0.2.5:80"] },
    ];
    const withFlows = { ...celld, flows };
    const byId = (id) => celld.nodes.find((item) => item.id === id);
    expect(networkNodeHistorySources(withFlows, byId("celld:f1:alpha"))[0].keys).toEqual(["192.0.2.1:18080"]);
    expect(networkNodeHistorySources(withFlows, byId("celld:f1"))[0].keys).toEqual(["192.0.2.1:18080", "192.0.2.2:18080"]);
    expect(networkNodeHistorySources({ ...celld, flows: [] }, byId("celld:f1"))).toEqual([]);
  });

  it("describes and links both card types", () => {
    expect(networkCardText(celld.nodes.at(-1)).subtitle).toBe("192.0.2.2:18080 · Down");
    expect(networkCardText(celld.nodes.at(-3)).subtitle).toBe(":18080 · 2 members");
    expect(networkNodeRoute(celld.nodes.at(-1))).toBe("/celld-fleet");
  });
});

describe("networkEdgeEnds", () => {
  const rect = (x, y, width = 250, height = 54) => ({ x, y, width, height });

  test("leaves the right side and enters the left side when the target is to the right", () => {
    expect(networkEdgeEnds(rect(0, 100), rect(400, 200))).toEqual({
      source: { x: 250, y: 127, side: "right" },
      target: { x: 400, y: 227, side: "left" },
    });
  });

  test("leaves the left side and enters the right side once the box is moved past its target", () => {
    expect(networkEdgeEnds(rect(400, 200), rect(0, 100))).toEqual({
      source: { x: 400, y: 227, side: "left" },
      target: { x: 250, y: 127, side: "right" },
    });
  });

  test("joins the near sides when one piece sits above the other", () => {
    expect(networkEdgeEnds(rect(100, 0), rect(120, 300))).toEqual({
      source: { x: 225, y: 54, side: "bottom" },
      target: { x: 245, y: 300, side: "top" },
    });
    expect(networkEdgeEnds(rect(120, 300), rect(100, 0))).toEqual({
      source: { x: 245, y: 300, side: "top" },
      target: { x: 225, y: 54, side: "bottom" },
    });
  });
});

describe("networkSnap", () => {
  const piece = (id, x, y, over = {}) => ({ id, type: "card", position: { x, y }, width: 100, height: 40, data: { title: id }, ...over });

  test("pulls a piece onto a nearby edge on each axis and draws a guide for each", () => {
    const snap = networkSnap({ nodes: [piece("a", 0, 0), piece("b", 300, 200)] }, "a", { x: 305, y: 4 }, 8);
    expect(snap.position).toEqual({ x: 300, y: 4 });
    expect(snap.guides).toEqual([{ x1: 300, x2: 300, y1: 4, y2: 240 }]);
  });

  test("leaves a piece alone when nothing is close", () => {
    const board = { nodes: [piece("a", 0, 0), piece("b", 300, 200)] };
    expect(networkSnap(board, "a", { x: 20, y: 20 }, 8)).toEqual({ position: { x: 20, y: 20 }, guides: [] });
  });

  test("lines up centres of pieces of different sizes", () => {
    const board = { nodes: [piece("a", 0, 0), piece("b", 300, 200, { width: 200 })] };
    expect(networkSnap(board, "a", { x: 353, y: 0 }, 8).position.x).toBe(350);
  });

  test("works across boxes, keeps the position relative to the parent, and ignores the boxes around it", () => {
    const nodes = [
      piece("left", 0, 0, { width: 500, height: 500 }),
      piece("right", 1000, 100, { width: 500, height: 500 }),
      piece("a", 50, 50, { parentId: "left" }),
      piece("b", 60, 80, { parentId: "right" }),
    ];
    const snap = networkSnap({ nodes }, "a", { x: 30, y: 177 }, 8);
    expect(snap.position).toEqual({ x: 30, y: 180 });
    expect(snap.guides[0]).toMatchObject({ y1: 180, y2: 180, x1: 30, x2: 1160 });
    expect(networkSnap({ nodes }, "a", { x: 3, y: 300 }, 8).position.x).toBe(3);
    expect(networkSnap({ nodes }, "left", { x: 1, y: 300 }, 0).guides).toEqual([]);
  });

  test("never snaps a piece above its box header", () => {
    const nodes = [piece("box", 0, 0, { width: 500, height: 500 }), piece("a", 12, 45, { parentId: "box", extent: [[12, 40], [Infinity, Infinity]] }), piece("b", 300, 35)];
    expect(networkSnap({ nodes }, "a", { x: 12, y: 41 }, 8).position.y).toBe(41);
  });
});

describe("docker, kubernetes and NICs on the board", () => {
  const nic = (vm, mac, network, primary) => node(`nic:alpha:${vm}:${mac}`, "vm_nic", "alpha", { label: `${vm} ${mac}`, details: { vm, mac, network, model: "virtio", primary } });
  const full = {
    generatedAt: "",
    warnings: [],
    positions: {},
    flows: [
      { source: "proxy:1", target: "container:alpha:app", endpoints: ["192.0.2.1:8080"] },
      { source: "proxy:1", target: "k8s:ingress:web:site", endpoints: ["192.0.2.1:443"] },
      { source: "proxy:2", target: "k8s:service:web:api", endpoints: ["192.0.2.1:30080"] },
    ],
    nodes: [
      node("proxy:1", "proxy", "alpha"),
      node("proxy:2", "proxy", "alpha"),
      node("host:alpha", "host", "alpha"),
      node("bridge:alpha:br0", "bridge", "alpha", { label: "br0" }),
      node("bridge:alpha:br1", "bridge", "alpha", { label: "br1" }),
      node("vm:alpha:web", "vm", "alpha", { label: "web", details: { network: "br0" } }),
      nic("web", "aa:01", "br0", true),
      nic("web", "aa:02", "br1", false),
      node("container:alpha:app", "container", "alpha", { label: "app", details: { image: "nginx:1", ports: [{ publicPort: 8080 }, { publicPort: 8080 }, { publicPort: 443 }, { publicPort: 0 }] } }),
      node("container:alpha:old", "container", "alpha", { label: "old", status: "disabled", details: { image: "redis:7", ports: [] } }),
      node("k8s:cluster", "k8s_cluster", "alpha", { label: "Kubernetes", details: { ready: 1, total: 2 } }),
      node("k8s:service:web:api", "k8s_service", "", { label: "api", status: "unknown", details: { namespace: "web", serviceType: "NodePort", ports: [{ port: 80, nodePort: 30080 }] } }),
      node("k8s:service:web:site", "k8s_service", "", { label: "site", status: "unknown", details: { namespace: "web", serviceType: "ClusterIP", ports: [{ port: 80, nodePort: 0 }] } }),
      node("k8s:ingress:web:site", "k8s_ingress", "", { label: "zz-site", status: "unknown", details: { namespace: "web", rules: [{ host: "a.example", service: "site", port: 80 }, { host: "b.example", service: "site", port: 80 }] } }),
    ],
    edges: [
      edge("host:alpha", "bridge:alpha:br0", "has_bridge"),
      edge("host:alpha", "bridge:alpha:br1", "has_bridge"),
      edge("bridge:alpha:br0", "vm:alpha:web", "attached"),
      edge("vm:alpha:web", "nic:alpha:web:aa:01", "has_nic"),
      edge("vm:alpha:web", "nic:alpha:web:aa:02", "has_nic"),
      edge("bridge:alpha:br0", "nic:alpha:web:aa:01", "attached"),
      edge("bridge:alpha:br1", "nic:alpha:web:aa:02", "attached"),
      edge("host:alpha", "container:alpha:app", "runs"),
      edge("host:alpha", "container:alpha:old", "runs"),
      edge("k8s:cluster", "k8s:ingress:web:site", "k8s_member"),
      edge("k8s:cluster", "k8s:service:web:api", "k8s_member"),
      edge("k8s:cluster", "k8s:service:web:site", "k8s_member"),
      edge("k8s:ingress:web:site", "k8s:service:web:site", "k8s_route"),
      edge("proxy:1", "container:alpha:app", "forwards", "docker_port"),
      edge("proxy:1", "k8s:ingress:web:site", "forwards", "k8s_ingress"),
      edge("proxy:2", "k8s:service:web:api", "forwards", "k8s_port"),
    ],
  };
  const board = networkBoard(full.nodes, full.edges);
  const placed = new Map(board.nodes.map((item) => [item.id, item]));
  const byId = (id) => full.nodes.find((item) => item.id === id);

  it("puts containers in a Docker box after the networks of their machine", () => {
    const box = placed.get("docker:alpha");
    expect(box).toMatchObject({ parentId: "host:alpha", data: { title: "Docker", subtitle: "2 containers", kind: "network" } });
    expect(placed.get("container:alpha:app").parentId).toBe("docker:alpha");
    expect(box.position.y).toBeGreaterThan(placed.get("bridge:alpha:br1").position.y);
  });

  it("uses the cluster as a middle column box with ingresses before services", () => {
    const box = placed.get("k8s:cluster");
    expect(box).toMatchObject({ type: "box", data: { title: "Kubernetes", subtitle: "1/2 nodes", kind: "section" } });
    expect(box.position.x).toBeLessThan(placed.get("host:alpha").position.x);
    const inside = board.nodes.filter((item) => item.parentId === "k8s:cluster").map((item) => item.id);
    expect(inside).toEqual(["k8s:ingress:web:site", "k8s:service:web:api", "k8s:service:web:site"]);
  });

  it("shows only secondary NICs, inside their network, and each VM once", () => {
    expect(placed.has("nic:alpha:web:aa:01")).toBe(false);
    expect(placed.get("nic:alpha:web:aa:02").parentId).toBe("bridge:alpha:br1");
    expect(board.nodes.filter((item) => item.id === "vm:alpha:web")).toHaveLength(1);
    expect(placed.get("vm:alpha:web").parentId).toBe("bridge:alpha:br0");
    expect(placed.get("bridge:alpha:br1").data.subtitle).toBe("0 VMs");
  });

  it("draws routes, not containment", () => {
    const lines = board.edges.map((item) => `${item.source}>${item.target}`);
    expect(lines).toEqual(expect.arrayContaining(["k8s:ingress:web:site>k8s:service:web:site", "proxy:1>container:alpha:app"]));
    expect(lines.some((line) => line.startsWith("k8s:cluster>") || line.startsWith("vm:alpha:web>") || line.startsWith("host:alpha>"))).toBe(false);
  });

  it("does not walk containment forward in search", () => {
    const cluster = ids(filterNetworkGraph(full, { query: "k8s:cluster", host: "", hiddenTypes: [] }));
    expect(cluster).toEqual(["k8s:cluster"]);
    const vm = ids(filterNetworkGraph(full, { query: "vm:alpha:web", host: "", hiddenTypes: [] }));
    expect(vm.some((id) => id.startsWith("nic:"))).toBe(false);
    const service = ids(filterNetworkGraph(full, { query: "k8s:service:web:site", host: "", hiddenTypes: [] }));
    expect(service).toEqual(expect.arrayContaining(["k8s:cluster", "k8s:ingress:web:site", "proxy:1"]));
  });

  it("toggles docker and kubernetes as divisions", () => {
    const hide = (id) => {
      const { types } = networkDivisions(full).find((item) => item.id === id);
      const view = filterNetworkGraph(full, { query: "", host: "", hiddenTypes: types });
      return networkBoard(view.nodes, view.edges).nodes.map((item) => item.id);
    };
    expect(hide("docker").some((id) => id.startsWith("docker:") || id.startsWith("container:"))).toBe(false);
    expect(hide("k8s").some((id) => id.startsWith("k8s:"))).toBe(false);
    expect(networkDivisions(full).find((item) => item.id === "machines").types).toContain("vm_nic");
  });

  it("writes card text", () => {
    expect(networkCardText(byId("container:alpha:app"))).toEqual({ title: "app", subtitle: "nginx:1 · :8080,:443" });
    expect(networkCardText(byId("container:alpha:old")).subtitle).toBe("redis:7 · no published ports · Disabled");
    expect(networkCardText(byId("k8s:ingress:web:site"))).toEqual({ title: "a.example", subtitle: "→ site:80 +1" });
    expect(networkCardText(byId("k8s:service:web:api"))).toEqual({ title: "web/api", subtitle: "NodePort · :30080" });
    expect(networkCardText(byId("k8s:service:web:site")).subtitle).toBe("ClusterIP · :80");
    expect(networkCardText(byId("nic:alpha:web:aa:02"))).toEqual({ title: "web", subtitle: "aa:02 · virtio" });
  });

  it("charts routes into containers and kubernetes, and a NIC's own key", () => {
    const keys = (id) => networkNodeHistorySources(full, byId(id))[0]?.keys;
    expect(keys("container:alpha:app")).toEqual(["192.0.2.1:8080"]);
    expect(keys("k8s:ingress:web:site")).toEqual(["192.0.2.1:443"]);
    expect(keys("k8s:service:web:api")).toEqual(["192.0.2.1:30080"]);
    expect(keys("nic:alpha:web:aa:02")).toEqual(["nic:alpha:web:aa:02"]);
    expect(keys("k8s:cluster")).toBeUndefined();
    expect(keys("proxy:2")).toEqual(["192.0.2.1:30080"]);
  });

  it("lists every NIC of a VM with its live rate", () => {
    const traffic = { nodes: { "nic:alpha:web:aa:02": { sent: 2000, received: 0 } }, endpoints: {} };
    expect(networkVmNics(full, "vm:alpha:web", traffic)).toEqual([
      { id: "nic:alpha:web:aa:01", mac: "aa:01", network: "br0", model: "virtio", rate: "" },
      { id: "nic:alpha:web:aa:02", mac: "aa:02", network: "br1", model: "virtio", rate: "↑ 2.0 KB/s" },
    ]);
    expect(networkVmNics(full, "proxy:1")).toEqual([]);
  });
});

describe("networkGraphUnchanged", () => {
  const base = { generatedAt: "t1", nodes: [node("vm:a", "vm")], edges: [edge("vm:a", "vm:b")], flows: [], positions: {}, warnings: [] };

  it("ignores generatedAt and positions", () => {
    expect(networkGraphUnchanged(base, { ...base, generatedAt: "t2", positions: { "vm:a": { x: 1, y: 2 } } })).toBe(true);
  });

  it.each([
    ["nodes", { nodes: [node("vm:a", "vm", "", { status: "down" })] }],
    ["edges", { edges: [] }],
    ["flows", { flows: [{ source: "vm:a", target: "vm:b", key: "k" }] }],
    ["warnings", { warnings: ["host beta unreachable"] }],
  ])("sees a change in %s", (_, change) => {
    expect(networkGraphUnchanged(base, { ...base, ...change })).toBe(false);
  });
});

describe("collapsed boxes", () => {
  const nodes = [
    node("proxy:1", "proxy"),
    node("proxy:2", "proxy"),
    node("upstream:1", "upstream"),
    node("wireguard:server", "wireguard"),
    node("wireguard:peer", "wireguard_peer"),
    node("k8s:cluster", "k8s_cluster", "", { details: { ready: 1, total: 2 } }),
    node("k8s:ingress", "k8s_ingress", "", { details: { rules: [] } }),
    node("k8s:service", "k8s_service", "", { details: { namespace: "default", serviceType: "ClusterIP", ports: [] } }),
    node("host:h", "host", "h", { label: "h" }),
    node("bridge:h:br0", "bridge", "h", { label: "br0" }),
    node("vm:h:a", "vm", "h", { details: { network: "br0" } }),
    node("vm:h:b", "vm", "h", { details: { network: "br0" } }),
    node("container:h:c", "container", "h", { details: { image: "nginx", ports: [] } }),
  ];
  const edges = [
    edge("proxy:1", "vm:h:a", "forwards", "ip"),
    edge("proxy:1", "vm:h:b", "forwards", "none"),
    edge("proxy:2", "container:h:c", "forwards", "none"),
    edge("proxy:2", "bridge:h:br0", "forwards", "none"),
    edge("proxy:1", "k8s:ingress", "forwards", "ip"),
    edge("k8s:ingress", "k8s:service", "k8s_route"),
    edge("k8s:service", "vm:h:b", "k8s_route"),
  ];
  const fold = (...ids) => networkBoard(nodes, edges, ids);
  const at = (board, id) => board.nodes.find((item) => item.id === id);
  const line = (board, source, target) => board.edges.find((item) => item.source === source && item.target === target);

  it.each([
    ["section", "section:proxy", ["proxy:1", "proxy:2"], "2"],
    ["machine", "host:h", ["bridge:h:br0", "vm:h:a", "docker:h", "container:h:c"], "5 items"],
    ["network", "bridge:h:br0", ["vm:h:a", "vm:h:b"], "2 VMs"],
    ["docker", "docker:h", ["container:h:c"], "1 container"],
    ["kubernetes", "k8s:cluster", ["k8s:ingress", "k8s:service"], "2 items"],
    ["wireguard", "wireguard:server", ["wireguard:peer"], "1"],
  ])("collapses a %s box to its header", (_, id, hidden, count) => {
    const board = fold(id);
    const box = at(board, id);
    for (const child of hidden) expect(at(board, child)).toBeUndefined();
    expect(board.nodes.some((item) => item.parentId === id)).toBe(false);
    expect(box.data).toMatchObject({ title: at(networkBoard(nodes, edges), id).data.title, collapsed: true });
    expect(box.data.subtitle).toContain(count);
    expect(at(networkPlacedBoard(board, {}), id).height).toBe(box.height);
    expect(box.height).toBeLessThan(at(networkBoard(nodes, edges), id).height);
  });

  it("leaves the board alone with nothing collapsed", () => {
    expect(networkBoard(nodes, edges, []).edges).toEqual(networkBoard(nodes, edges).edges);
    expect(at(networkBoard(nodes, edges), "host:h").data.collapsed).toBe(false);
  });

  it("does not reorder other boxes when one collapses", () => {
    const order = (board) => board.nodes.filter((item) => item.parentId === "section:proxy").map((item) => item.id);
    expect(order(fold("host:h"))).toEqual(order(networkBoard(nodes, edges)));
  });

  it("moves a line to the nearest visible box, keeping its ID and original", () => {
    const board = fold("docker:h");
    const moved = line(board, "proxy:2", "docker:h");
    expect(moved.id).toBe("proxy:2|container:h:c|forwards|none");
    expect(moved.originals).toEqual([edges[2]]);
    // Nested collapse: the outer box is the nearest one still visible.
    expect(line(fold("docker:h", "host:h"), "proxy:2", "docker:h")).toBeUndefined();
    expect(line(fold("docker:h", "host:h"), "proxy:2", "host:h")).toBeDefined();
    expect(line(fold("host:h", "section:proxy"), "section:proxy", "host:h")).toBeDefined();
  });

  it("drops lines that end inside the box they started in", () => {
    const board = fold("k8s:cluster");
    expect(board.edges.some((item) => item.source === item.target)).toBe(false);
    expect(board.edges.some((item) => item.originals.includes(edges[5]))).toBe(false);
  });

  it("merges lines that become identical, dashed only if all were", () => {
    const mixed = line(fold("bridge:h:br0"), "proxy:1", "bridge:h:br0");
    expect(mixed).toMatchObject({ dashed: false, id: "merged|proxy:1|bridge:h:br0" });
    expect(mixed.originals).toHaveLength(2);
    const dashed = line(fold("host:h"), "proxy:2", "host:h");
    expect(dashed.originals).toHaveLength(2);
    expect(dashed.dashed).toBe(true);
  });

  it("keeps parallel lines that never moved apart", () => {
    const parallel = [edge("proxy:1", "vm:h:a", "forwards", "ip"), edge("proxy:1", "vm:h:a", "forwards", "hostname")];
    expect(networkBoard(nodes, parallel).edges).toHaveLength(2);
  });

  it("lights moved lines, routes through a collapsed box, and hidden nodes", () => {
    const board = fold("k8s:cluster");
    const route = networkRouteEdges(board, "proxy:1");
    expect(route.has("proxy:1|k8s:ingress|forwards|ip")).toBe(true);
    // Only reachable through the ingress-to-service line the collapse dropped.
    expect(route.has("k8s:service|vm:h:b|k8s_route|")).toBe(true);
    expect(networkRouteEdges(board, "k8s:service").has("k8s:service|vm:h:b|k8s_route|")).toBe(true);
    expect(networkRouteEdges(fold("section:proxy"), "section:proxy").has("proxy:2|container:h:c|forwards|none")).toBe(true);
    expect(networkRouteEdges(board, "gone").size).toBe(0);
  });

  it("does not light a sibling route that only shares the collapsed box", () => {
    const route = networkRouteEdges(fold("docker:h", "bridge:h:br0"), "proxy:2");
    expect(route.has("merged|proxy:1|bridge:h:br0")).toBe(false);
  });

  it("is ignored during a search or host filter", () => {
    expect(networkActiveCollapsed(["host:h"], "", "")).toEqual(["host:h"]);
    expect(networkActiveCollapsed(["host:h"], "  ", "")).toEqual(["host:h"]);
    expect(networkActiveCollapsed(["host:h"], "web", "")).toEqual([]);
    expect(networkActiveCollapsed(["host:h"], "", "h")).toEqual([]);
  });

  describe("storage", () => {
    const setStorage = (value) => Object.defineProperty(global, "localStorage", { configurable: true, writable: true, value });
    const real = global.localStorage;
    afterEach(() => setStorage(real));

    it("round-trips and survives bad or blocked storage", () => {
      const store = {};
      setStorage({ getItem: (key) => store[key] ?? null, setItem: (key, value) => { store[key] = value; } });
      expect(readNetworkCollapsed()).toEqual([]);
      writeNetworkCollapsed(["host:h"]);
      expect(store["network-map-collapsed"]).toBe('["host:h"]');
      expect(readNetworkCollapsed()).toEqual(["host:h"]);
      store["network-map-collapsed"] = "{nope";
      expect(readNetworkCollapsed()).toEqual([]);
      setStorage({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
      expect(readNetworkCollapsed()).toEqual([]);
      expect(() => writeNetworkCollapsed(["host:h"])).not.toThrow();
    });
  });
});

describe("layer presets", () => {
  it("matches a preset in any order, and nothing for a custom mix", () => {
    expect(NETWORK_PRESETS.map((preset) => preset.id)).toEqual(["all", "routes", "compute", "vpn"]);
    expect(networkPresetFor([])?.id).toBe("all");
    expect(networkPresetFor(["domain", "wireguard"])?.id).toBe("routes");
    for (const preset of NETWORK_PRESETS) expect(networkPresetFor([...preset.hidden].reverse())).toBe(preset);
    expect(networkPresetFor(["domain"])).toBeUndefined();
    expect(networkPresetFor(["domain", "wireguard", "proxy"])).toBeUndefined();
  });
});
