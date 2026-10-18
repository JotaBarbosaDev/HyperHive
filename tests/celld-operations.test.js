import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { LogTerminal } from "../components/celld/OperationsLogConsole";
import { FleetRecords } from "../components/celld/OperationsRecords";
import { FleetWorkloads } from "../components/celld/OperationsWorkloads";
import {
  workloadInventory,
  selectWorkloads,
} from "../components/celld/operations-workloads";
import * as Clipboard from "expo-clipboard";
import { FleetOverview } from "../components/celld/OperationsOverview";
import { useOperationsNavigation } from "../hooks/useOperationsNavigation";
import { OperationsThemeProvider } from "../components/celld/OperationsTheme";
import {
  parseQueryDraft,
  queryDraft,
} from "../components/celld/operations-query";
import {
  resourceSeries,
  sampleEnvelope,
  sampleSegments,
  nearestPoint,
} from "../components/celld/operations-chart";
import {
  OpsButton,
  Disclosure,
  OpsText,
} from "../components/celld/OperationsUI";
import { downloadCelldLogs } from "../services/celld";
import { ResourceChart } from "../components/celld/OperationsCharts";
import { useCelldObservations } from "../hooks/useCelldObservations";
import { usePollingResource } from "../hooks/usePollingResource";
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("react-native", () => require("react-native-web/dist/cjs"));
jest.mock("lucide-react-native", () =>
  Object.fromEntries(
    [
      "ChevronDown",
      "ChevronRight",
      "Download",
      "Filter",
      "Pause",
      "Play",
      "RefreshCw",
      "ArrowRight",
      "X",
      "Info",
      "Search",
    ].map((name) => [name, () => null]),
  ),
);
jest.mock("react-native-svg", () => {
  const React = require("react");
  const element =
    (tag) =>
    ({ children, accessibilityLabel, ...props }) =>
      React.createElement(
        tag,
        { ...props, "aria-label": accessibilityLabel },
        children,
      );
  return {
    __esModule: true,
    default: element("svg"),
    Circle: element("circle"),
    Polyline: element("polyline"),
    Path: element("path"),
    Line: element("line"),
    Text: element("text"),
  };
});
jest.mock("../hooks/useCelldObservations", () => ({
  useCelldObservations: jest.fn(),
}));
jest.mock("../hooks/usePollingResource", () => ({
  usePollingResource: jest.fn(),
}));
jest.mock("../services/celld", () => ({
  downloadCelldLogs: jest.fn(),
  getCelldObservability: jest.fn(),
}));
let root, div;
const query = {
  from: Date.now() - 3600000,
  to: Date.now(),
  limit: 200,
  node: "node-a",
};
const row = {
  id: "one",
  node: "node-a",
  received_ms: query.to,
  record: {
    time_ms: query.to - 1000,
    kind: "log",
    severity: "ERROR",
    body: "Request failed",
    trace_id: "a".repeat(32),
    workload: "orders",
    attributes: { stream: "stderr" },
  },
};
const click = async (text) => {
  const el = [...div.querySelectorAll('[role="button"]')].find(
    (el) => el.textContent === text || el.getAttribute("aria-label") === text,
  );
  expect(el).toBeTruthy();
  await act(async () => el.click());
};
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  div = document.createElement("div");
  document.body.appendChild(div);
  root = createRoot(div);
  useCelldObservations.mockReturnValue({
    page: { records: [row], from: query.from, to: query.to, incomplete: true },
    requests: null,
    busy: false,
    more: jest.fn(),
    reload: jest.fn(),
    error: null,
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  div.remove();
  jest.clearAllMocks();
});
it("expands a log and opens its trace with the original interval, not log filters", async () => {
  const onTrace = jest.fn();
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="logs"
        initialQuery={query}
        onTrace={onTrace}
      />,
    ),
  );
  expect(div.textContent).not.toContain("Record one");
  await click("Inspect log: Request failed");
  expect(div.textContent).toContain("Record one");
  expect(div.textContent).toContain("stderr");
  await click("Open trace");
  expect(onTrace).toHaveBeenCalledWith("a".repeat(32), {
    from: query.from,
    to: query.to,
    limit: 200,
  });
});
it("quick ranges apply immediately, preserve node scope and reset follow", async () => {
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="logs"
        initialQuery={query}
        onTrace={jest.fn()}
      />,
    ),
  );
  await click("Follow live");
  expect(useCelldObservations.mock.calls.at(-1)[4]).toBe(true);
  await click("Last 24 hours");
  const args = useCelldObservations.mock.calls.at(-1);
  expect(args[3].to - args[3].from).toBe(86400000);
  expect(args[3].node).toBe("node-a");
  expect(args[4]).toBe(false);
});
it("validates a trace before applying and exposes readable filters", async () => {
  await act(async () =>
    root.render(
      <FleetRecords token="t" fleetId="f" kind="trace" onTrace={jest.fn()} />,
    ),
  );
  await click("Apply filters");
  expect(div.textContent).toContain("32 lowercase hexadecimal");
  expect(div.querySelector('[aria-label="From (UTC)"]')).toBeTruthy();
});
it("keeps unknown resource values distinct from zero and scopes the node drilldown", async () => {
  const onNavigate = jest.fn();
  usePollingResource.mockReturnValue({
    data: {
      nodes: [
        {
          node_id: "node-a",
          state: "fresh",
          resources: {
            rss_bytes: 0,
            owned_cells: 0,
            resident_cells: 0,
            cpu_percent_x100: 0,
          },
        },
        { node_id: "node-b", state: "offline" },
      ],
      incomplete: true,
    },
    refresh: jest.fn(),
    updatedAt: null,
  });
  await act(async () =>
    root.render(
      <FleetOverview token="t" fleetId="f" onNavigate={onNavigate} />,
    ),
  );
  expect(div.textContent).toContain("0 B");
  expect(div.textContent).toContain("Unavailable");
  expect(div.textContent).toContain("1 of 2 nodes reporting");
  await click("Inspect node node-a");
  await click("Node logs");
  expect(onNavigate.mock.calls[0][0]).toBe("logs");
  expect(onNavigate.mock.calls[0][1].node).toBe("node-a");
});
it("renders one zero sample visibly and allows hiding and restoring its node", async () => {
  const samples = [
    {
      id: "s",
      node: "node-a",
      snapshot: { collected_ms: query.to - 1000, resources: { rss_bytes: 0 } },
    },
  ];
  await act(async () =>
    root.render(
      <ResourceChart
        rows={samples}
        metric="rss_bytes"
        label="Memory"
        format={(v) => (v === undefined ? "Unavailable" : `${v} B`)}
        from={query.from}
        to={query.to}
      />,
    ),
  );
  expect(div.querySelectorAll("circle")).toHaveLength(1);
  expect(div.textContent).toContain("Latest 0 B");
  const toggle = div.querySelector('[role="checkbox"]');
  await act(async () => toggle.click());
  expect(div.textContent).toContain("All nodes hidden");
  await act(async () => toggle.click());
  expect(div.querySelectorAll("circle")).toHaveLength(1);
});

const fill = async (label, value) => {
  const input = div.querySelector(`[aria-label="${label}"]`);
  expect(input).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
it("clear filters restores valid applied dates after an invalid draft", async () => {
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="events"
        initialQuery={query}
        onTrace={jest.fn()}
      />,
    ),
  );
  await click("More filters");
  await fill("From (UTC)", "invalid date");
  await click("Clear filters");
  expect(div.querySelector('[aria-label="From (UTC)"]').value).toBe(
    new Date(query.from).toISOString(),
  );
  expect(div.querySelector('[aria-label="Node"]').value).toBe("");
  await click("Apply filters");
  expect(div.textContent).not.toContain("Enter valid UTC dates");
});
it("rejects ambiguous dates, calendar overflow and bad page sizes; preserves literal text", () => {
  const draft = queryDraft(query);
  expect(() =>
    parseQueryDraft({ ...draft, from: "2026-10-18T12:00:00" }),
  ).toThrow("UTC");
  expect(() =>
    parseQueryDraft({ ...draft, from: "2026-02-30T12:00:00Z" }),
  ).toThrow("UTC");
  expect(() => parseQueryDraft({ ...draft, limit: "" })).toThrow("Page size");
  expect(
    parseQueryDraft({ ...draft, node: " node-a ", text: " a & b " }),
  ).toMatchObject({ node: "node-a", text: " a & b " });
});
it("preserves the current window when enabling follow and submits search with Enter", async () => {
  const reload = jest.fn();
  useCelldObservations.mockReturnValue({ page: null, busy: false, reload });
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="logs"
        initialQuery={query}
        onTrace={jest.fn()}
      />,
    ),
  );
  await click("Follow live");
  expect(useCelldObservations.mock.calls.at(-1)[3]).toEqual(query);
  await click("Pause follow");
  await fill("Search message", "failed");
  const input = div.querySelector('[aria-label="Search message"]');
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        keyCode: 13,
        bubbles: true,
      }),
    ),
  );
  expect(useCelldObservations.mock.calls.at(-1)[3].text).toBe("failed");
  expect(reload).not.toHaveBeenCalled();
});
it("updates operations colors through the explicit modal theme bridge", async () => {
  const render = (mode) => (
    <OperationsThemeProvider mode={mode}>
      <OpsButton label="Themed" active onPress={() => {}} />
    </OperationsThemeProvider>
  );
  await act(async () => root.render(render("dark")));
  const button = div.querySelector('[role="button"]');
  expect(button.style.backgroundColor).toBe("rgb(18, 44, 48)");
  await act(async () => root.render(render("light")));
  expect(button.style.backgroundColor).toBe("rgb(230, 245, 240)");
});
it("opens an initially collapsed disclosure if an error arrives later", async () => {
  await act(async () =>
    root.render(
      <Disclosure title="Storage">
        <OpsText>Storage failed</OpsText>
      </Disclosure>,
    ),
  );
  expect(div.textContent).not.toContain("Storage failed");
  await act(async () =>
    root.render(
      <Disclosure title="Storage" defaultOpen>
        <OpsText>Storage failed</OpsText>
      </Disclosure>,
    ),
  );
  expect(div.textContent).toContain("Storage failed");
});
it("splits charts at missing values and process generations, excluding out-of-window samples", () => {
  const sample = (id, time, value, generation) => ({
    id,
    node: "n",
    generation,
    snapshot: { collected_ms: time, resources: { rss_bytes: value } },
  });
  const series = resourceSeries(
    [
      sample("outside", 0, 9000),
      sample("a", 1, 10, "a"),
      sample("b", 2, undefined, "a"),
      sample("c", 3, 0, "a"),
      sample("d", 4, 20, "b"),
    ],
    "rss_bytes",
    1,
    4,
  )[0];
  expect(series.segments.map((segment) => segment.length)).toEqual([1, 1, 1]);
  expect(series.points.map((point) => point.value)).toEqual([10, 0, 20]);
  expect(nearestPoint(series.points, 2.8)).toEqual({ time: 3, value: 0 });
});

it("restores each tab's applied query and manually entered trace after navigation", async () => {
  let nav;
  function Harness() {
    nav = useOperationsNavigation();
    return null;
  }
  await act(async () => root.render(<Harness />));
  await act(async () => nav.inspect("logs", query));
  expect(nav.tab).toBe("logs");
  expect(nav.selection.query).toEqual(query);
  await act(async () => nav.selectTab("metrics"));
  expect(nav.selection).toBeUndefined();
  await act(async () =>
    nav.openTrace("b".repeat(32), { ...query, node: undefined }),
  );
  await act(async () => nav.selectTab("logs"));
  expect(nav.selection.query.node).toBe("node-a");
  await act(async () => nav.selectTab("trace"));
  expect(nav.selection.traceId).toBe("b".repeat(32));
});

it("terminal retains all buffered rows while live follow is enabled or paused", async () => {
  const records = Array.from({ length: 120 }, (_, i) => ({
    ...row,
    id: String(i),
    record: { ...row.record, body: `Entry ${i}` },
  }));
  useCelldObservations.mockReturnValue({
    page: { records, from: query.from, to: query.to },
    busy: false,
    reload: jest.fn(),
  });
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="logs"
        initialQuery={query}
        onTrace={jest.fn()}
      />,
    ),
  );
  expect(div.querySelector('[aria-label="Inspect log: Entry 0"]')).toBeTruthy();
  await click("Follow live");
  expect(
    div.querySelector('[aria-label="Inspect log: Entry 119"]'),
  ).toBeTruthy();
  expect(div.querySelector('[aria-label="Inspect log: Entry 0"]')).toBeTruthy();
  await click("Pause follow");
  expect(
    div.querySelector('[aria-label="Inspect log: Entry 119"]'),
  ).toBeTruthy();
});
it("changing a quick range keeps unapplied message text visible until Apply", async () => {
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="logs"
        initialQuery={query}
        onTrace={jest.fn()}
      />,
    ),
  );
  await fill("Search message", "draft only");
  await click("Last 24 hours");
  expect(div.querySelector('[aria-label="Search message"]').value).toBe(
    "draft only",
  );
  expect(useCelldObservations.mock.calls.at(-1)[3].text).toBeUndefined();
  expect(div.textContent).toContain("Unapplied filter changes");
});

it("cancels an export after filters change without reporting a false timeout", async () => {
  let exportSignal;
  downloadCelldLogs.mockImplementation(
    (_token, _fleet, _query, signal) =>
      new Promise((_resolve, reject) => {
        exportSignal = signal;
        signal.addEventListener("abort", () => reject(new Error("Aborted")));
      }),
  );
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="logs"
        initialQuery={query}
        onTrace={jest.fn()}
      />,
    ),
  );
  await click("Export NDJSON");
  expect(exportSignal.aborted).toBe(false);
  await click("Clear filters");
  expect(exportSignal.aborted).toBe(true);
  expect(div.textContent).not.toContain("Export timed out");
  expect(div.textContent).not.toContain("Aborted");
});

it("bounds a 100,000-point envelope while retaining narrow peaks, troughs and endpoints", () => {
  const points = Array.from({ length: 100000 }, (_, i) => ({
    time: i,
    value: i === 12345 ? 99999 : i === 54321 ? 0 : 50,
  }));
  const reduced = sampleEnvelope(points, 300);
  expect(reduced.length).toBeLessThanOrEqual(300);
  expect(reduced[0]).toBe(points[0]);
  expect(reduced.at(-1)).toBe(points.at(-1));
  expect(reduced).toContain(points[12345]);
  expect(reduced).toContain(points[54321]);
  expect(nearestPoint(points, 12345.2)).toBe(points[12345]);
  const segments = sampleSegments(
    [points.slice(0, 40000), points.slice(50000)],
    300,
  );
  expect(segments).toHaveLength(2);
  expect(segments[0].at(-1).time).toBe(39999);
  expect(segments[1][0].time).toBe(50000);
});
it("dense charts use one bounded SVG path per node rather than thousands of vertices and elements", async () => {
  const samples = Array.from({ length: 10000 }, (_, i) => ({
    id: String(i),
    node: "node-a",
    snapshot: {
      collected_ms: query.from + ((query.to - query.from) * i) / 10000,
      resources: { cpu_percent_x100: i === 5001 ? 9000 : 1000 },
    },
  }));
  await act(async () =>
    root.render(
      <ResourceChart
        rows={samples}
        metric="cpu_percent_x100"
        label="CPU"
        format={(v) => String(v)}
        from={query.from}
        to={query.to}
      />,
    ),
  );
  const paths = div.querySelectorAll("path");
  expect(paths).toHaveLength(1);
  expect(paths[0].getAttribute("d").length).toBeLessThan(30000);
  expect(div.querySelectorAll("circle").length).toBeLessThanOrEqual(2);
  expect(div.textContent).toContain("10,000 samples");
  expect(div.textContent).toContain("Peak 9000");
});
it("shows the complete multiline log outside horizontal scrolling and copies it verbatim", async () => {
  const body =
    "First line\n" + "https://example.test/" + "x".repeat(5000) + "\nLast line";
  useCelldObservations.mockReturnValue({
    page: {
      records: [{ ...row, record: { ...row.record, body } }],
      from: query.from,
      to: query.to,
    },
    busy: false,
    reload: jest.fn(),
  });
  await act(async () =>
    root.render(
      <FleetRecords
        token="t"
        fleetId="f"
        kind="logs"
        initialQuery={query}
        onTrace={jest.fn()}
      />,
    ),
  );
  const message = div.querySelector('[aria-label="Full message"]');
  expect(message.textContent).toBe(body);
  expect(message.style.whiteSpace).toBe("pre-wrap");
  expect(message.style.overflowWrap).toBe("anywhere");
  expect(message.style.webkitLineClamp).toBe("");
  await click(`Inspect log: ${body}`);
  await click("Copy message");
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(body);
  expect(div.textContent).toContain("Message copied.");
});
const workloadData = {
  fleet_id: "f",
  incomplete: true,
  nodes: [
    {
      node_id: "node-a",
      state: "fresh",
      workloads: [
        {
          id: "orders",
          kind: "worker",
          state: "current",
          memory_bytes: 0,
          cpu_percent: 0,
          live: 1,
        },
      ],
    },
    {
      node_id: "node-b",
      state: "stale",
      workloads: [
        { id: "orders", kind: "worker", state: "current" },
        { id: "cache", kind: "kv_cell", memory_bytes: 1024 },
      ],
    },
  ],
  deployment: {
    state: "fresh",
    workloads: [
      { id: "JOBS", kind: "queue", parent: "orders", state: "configured" },
    ],
  },
};
it("keeps runtime placements separate from bindings, filters node/type, and sorts unknown resources last", () => {
  const rows = workloadInventory(workloadData, "runtime");
  expect(rows).toHaveLength(3);
  expect(new Set(rows.map((row) => row.key)).size).toBe(3);
  expect(
    selectWorkloads(rows, "orders", "node-a", "worker", "name"),
  ).toHaveLength(1);
  expect(
    selectWorkloads(rows, "", "", "", "memory").map((row) => row.workload.id),
  ).toEqual(["cache", "orders", "orders"]);
  expect(
    workloadInventory(workloadData, "configuration").map(
      (row) => row.workload.id,
    ),
  ).toEqual(["JOBS"]);
});
it("the dedicated workloads page supports scope filters and scoped log drilldown", async () => {
  const navigate = jest.fn();
  usePollingResource.mockReturnValue({
    data: workloadData,
    refresh: jest.fn(),
    updatedAt: null,
  });
  await act(async () =>
    root.render(<FleetWorkloads token="t" fleetId="f" onNavigate={navigate} />),
  );
  await fill("Filter workload nodes", "node-a");
  expect(
    div.querySelector('[aria-label="Inspect workload orders on node-b"]'),
  ).toBeNull();
  await click("Inspect workload orders on node-a");
  await click("Workload logs");
  expect(navigate.mock.calls[0][1]).toMatchObject({
    node: "node-a",
    workload: "orders",
  });
  await click("Configuration & bindings");
  expect(div.textContent).toContain("JOBS");
  expect(div.textContent).toContain("not runtime instances");
  expect(
    div.querySelector('[aria-label="Inspect workload orders on node-a"]'),
  ).toBeNull();
});
it("overview links to workloads without rendering the old workload dump", async () => {
  const onWorkloads = jest.fn();
  usePollingResource.mockReturnValue({
    data: workloadData,
    refresh: jest.fn(),
    updatedAt: null,
  });
  await act(async () =>
    root.render(
      <FleetOverview token="t" fleetId="f" onWorkloads={onWorkloads} />,
    ),
  );
  expect(div.textContent).not.toContain("JOBS");
  expect(div.textContent).toContain("3 runtime entries reported");
  await click("Open workloads");
  expect(onWorkloads).toHaveBeenCalledWith();
});
it("bounds fragmented charts without drawing connections across missing data", () => {
  const segments = Array.from({ length: 10000 }, (_, i) => [
    { time: i * 2, value: i === 5011 ? 99999 : 50 },
  ]);
  const sampled = sampleSegments(segments, 200);
  expect(sampled.flat().length).toBeLessThanOrEqual(200);
  expect(sampled.every((segment) => segment.length === 1)).toBe(true);
  expect(sampled.flat()).toContain(segments[5011][0]);
});

it("opens application logs by default and switches origins before fetching or exporting", async () => {
  await act(async () => root.render(
    <FleetRecords token="t" fleetId="f" kind="logs" onTrace={jest.fn()} />,
  ));
  expect(useCelldObservations.mock.calls.at(-1)[3].source).toBe("otlp");
  expect(div.textContent).toContain("console.log");
  await click("celld");
  expect(useCelldObservations.mock.calls.at(-1)[3].source).toBe("process");
  expect(useCelldObservations.mock.calls.at(-1)[4]).toBe(true);
  await click("Clear filters");
  expect(useCelldObservations.mock.calls.at(-1)[3].source).toBe("process");
  downloadCelldLogs.mockResolvedValueOnce("{}");
  const createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:logs");
  URL.revokeObjectURL = jest.fn();
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await click("Export NDJSON");
    expect(downloadCelldLogs.mock.calls.at(-1)[2].source).toBe("process");
  } finally {
    anchorClick.mockRestore();
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
  }
  await click("Containers");
  expect(useCelldObservations.mock.calls.at(-1)[3].source).toBe("container");
  await click("All logs");
  expect(useCelldObservations.mock.calls.at(-1)[3].source).toBeUndefined();
});

it("preserves saved source searches and clears workload scope when switching origins", async () => {
  await act(async () => root.render(
    <FleetRecords token="t" fleetId="f" kind="logs" initialQuery={{ ...query, source: "stdout", workload: "cell-chat" }} onTrace={jest.fn()} />,
  ));
  expect(useCelldObservations.mock.calls.at(-1)[3].source).toBe("stdout");
  await click("Application");
  expect(useCelldObservations.mock.calls.at(-1)[3]).toMatchObject({ source: "otlp", node: "node-a" });
  expect(useCelldObservations.mock.calls.at(-1)[3].workload).toBeUndefined();
});

it("labels application and celld output in the combined stream", async () => {
  useCelldObservations.mockReturnValue({
    page: { records: [
      { ...row, id: "app", record: { ...row.record, source: "otlp" } },
      { ...row, id: "out", record: { ...row.record, source: "stdout" } },
      { ...row, id: "err", record: { ...row.record, source: "stderr" } },
    ], from: query.from, to: query.to }, busy: false,
  });
  await act(async () => root.render(
    <FleetRecords token="t" fleetId="f" kind="logs" initialQuery={query} onTrace={jest.fn()} />,
  ));
  expect(div.textContent).toContain("celld · stdout");
  expect(div.textContent).toContain("celld · stderr");
  expect(div.textContent).toContain("Application");
});


it("terminal follows new rows, holds its scroll position while reading, and can jump back to latest", async () => {
  let rows = [{ ...row, id: "first" }];
  const render = () => root.render(<LogTerminal rows={rows} onTrace={jest.fn()} />);
  await act(async () => render());
  const terminal = div.querySelector('[data-testid="log-terminal"]');
  expect(terminal).toBeTruthy();
  Object.defineProperties(terminal, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 400 },
    offsetHeight: { configurable: true, value: 400 },
  });
  rows = [...rows, { ...row, id: "second" }];
  await act(async () => render());
  expect(terminal.scrollTop).toBe(1000);
  await act(async () => {
    terminal.scrollTop = 100;
    terminal.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  expect(div.textContent).toContain("Reading history");
  rows = [...rows, { ...row, id: "third" }];
  await act(async () => render());
  expect(terminal.scrollTop).toBe(100);
  await click("Jump to latest");
  expect(terminal.scrollTop).toBe(1000);
  expect(div.textContent).toContain("At latest");
  await act(async () => {
    terminal.scrollTop = 100;
    terminal.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 120));
    terminal.scrollTop = 600;
    terminal.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  expect(div.textContent).toContain("At latest");
  rows = [...rows, { ...row, id: "fourth" }];
  await act(async () => render());
  expect(terminal.scrollTop).toBe(1000);
});
