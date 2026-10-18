// Disposable browser fixture. Synthetic data only; never points at a HyperHive host.
const http = require("node:http");
const crypto = require("node:crypto");
const port = Number(process.env.PORT || 8096);
const machines = ["machine1", "machine2", "machine3"];
const requests = [];
const streamClients = new Set();
let fleets = new Map();
let modes = {};
let revision = 10;
let generation = 0;
let observationTime = Date.now() - 5000;
const stamp = () => new Date().toISOString();
const node = (name, ports, running = true) => ({
  name, ip: "127.0.0." + (machines.indexOf(name) + 2), connected: name !== "machine3",
  running: running && name !== "machine3", healthy: running && name !== "machine3", ports,
  ...(name === "machine3" ? { error: "Agent is offline (fixture)" } : running ? { url: "http://127.0.0." + (machines.indexOf(name) + 2) + ":" + ports.http } : {}),
});
function fleet(id, name, servers, ports, desired = "running") {
  const f = { id, name, desired_state: desired, status: desired === "stopped" ? "stopped" : servers.includes("machine3") ? "degraded" : "running",
    servers: servers.map((name) => node(name, ports, desired === "running")), ports,
    storage: { bucket: "hyperhive-celld-" + id, endpoint: "http://127.0.0.1:9000", region: "us-east-1" },
    urls: [], deploy: {}, checked_at: stamp() };
  describe(f);
  return f;
}
function describe(f) {
  f.urls = f.servers.filter((n) => n.url).map((n) => n.url);
  f.deploy = { command: "celld deploy . --bucket s3://" + f.storage.bucket + " --endpoint " + f.storage.endpoint + " --region us-east-1",
    credentials_url: "/celld/fleets/" + f.id + "/credentials", environment: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION=us-east-1"] };
}
function reset() {
  generation++; observationTime = Date.now() - 5000; modes = {}; requests.length = 0;
  fleets = new Map([
    ["f000000000000000000000001", fleet("f000000000000000000000001", "payments", ["machine1", "machine2"], { http: 18080, internal: 18081 })],
    ["f000000000000000000000002", fleet("f000000000000000000000002", "staging", ["machine1"], { http: 18082, internal: 18083 }, "stopped")],
    ["f000000000000000000000003", fleet("f000000000000000000000003", "offline-app", ["machine3"], { http: 18084, internal: 18085 })],
  ]);
}
reset();
function later(f, deletion = false) {
  const version = generation;
  setTimeout(() => {
    if (version !== generation) return;
    if (deletion) { if (!modes.offlineDelete && !f.servers.some((n) => n.name === "machine3")) fleets.delete(f.id); return; }
    f.servers = f.servers.map((n) => node(n.name, f.ports, f.desired_state === "running"));
    f.status = f.desired_state === "stopped" ? "stopped" : f.servers.some((n) => !n.healthy) ? "degraded" : "running";
    f.checked_at = stamp(); delete f.error; describe(f);
  }, 1200);
}
function collision(id, servers, ports) {
  return [...fleets.values()].some((f) => f.id !== id && f.servers.some((n) => servers.includes(n.name)) &&
    [ports.http, ports.internal].some((p) => p === f.ports.http || p === f.ports.internal));
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname.replace(/^\/api/, "");
  let body = "";
  for await (const chunk of req) body += chunk;
  let input = {};
  try { if (body) input = JSON.parse(body); } catch { res.writeHead(400); res.end(); return; }
  const reply = (code, value) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (path === "/__test") {
    if (req.method === "POST") { if (input.reset) reset(); if (input.empty) { generation++; fleets.clear(); } Object.assign(modes, input); }
    if (input.emitLog) {
      const now = Date.now();
      const row = { id: crypto.randomUUID(), node: "127.0.0.2", received_ms: now, record: { time_ms: now, kind: "log", source: input.emitLog.source || "otlp", severity: "INFO", body: input.emitLog.body || "Pushed application message (synthetic)" } };
      for (const client of streamClients) {
        const source = client.query.get("source");
        if (client.kind !== "logs" || source && (source === "process" ? !["stdout","stderr"].includes(row.record.source) : source !== row.record.source)) continue;
        client.res.write('event: observations\ndata: ' + JSON.stringify({ records: [row], from: Number(client.query.get("from")), to: now, incomplete: true }) + '\n\n');
      }
    }
    if (input.closeStreams) for (const client of streamClients) client.res.end();
    reply(200, { modes, requests, fleets: [...fleets.values()] }); return;
  }
  if (path === "/login") { reply(200, { token: "browser-fixture-token" }); return; }
  if (modes.expireAuth || !req.headers.authorization) { reply(401, { error: "Session expired (fixture)" }); return; }
  requests.push({ method: req.method, path, ...(path.startsWith("/celld") ? { query: Object.fromEntries(url.searchParams) } : {}), ...(path.startsWith("/celld") && body ? { body: input } : {}) });
  if (modes.failNext && modes.failNext.path === path && modes.failNext.method === req.method) {
    const fail = modes.failNext; delete modes.failNext; reply(fail.status, { error: fail.message }); return;
  }
  if (path === "/protocol/list") { reply(200, machines.map((MachineName) => ({ MachineName }))); return; }
  if (path === "/new-slave-count") { reply(200, { count: 0 }); return; }
  if (path === "/celld/fleets" && req.method === "GET") {
    if (modes.listError) { reply(modes.listError, { error: "Fleet API temporarily unavailable (fixture)" }); return; }
    if (modes.malformed) { reply(200, { fleets: null }); return; }
    const buckets = [...fleets.values()].map((f) => f.storage.bucket).concat("user-archives").sort();
    reply(200, { fleets: [...fleets.values()], reset_pending: Boolean(modes.legacyReset),
      storage: { healthy: !modes.storageError, bucket_count: modes.storageError ? null : buckets.length, buckets: modes.storageError ? null : buckets,
        managed_bucket_count: fleets.size, checked_at: stamp(), ...(modes.storageError ? { error: "SILO unavailable (fixture)" } : {}) },
      ...(modes.legacyReset ? { error: "Waiting for offline legacy agent (fixture)" } : {}) }); return;
  }
  if (path === "/celld/fleets" && req.method === "POST") {
    if (modes.legacyReset) { reply(409, { error: "Legacy cleanup is pending" }); return; }
    if (!input.name?.trim() || !Array.isArray(input.servers) || !input.servers.length || input.servers.some((name) => !machines.includes(name)) || new Set(input.servers).size !== input.servers.length) { reply(400, { error: "Invalid fleet name or servers" }); return; }
    if ([...fleets.values()].some((f) => f.name === input.name)) { reply(409, { error: "Fleet name already exists" }); return; }
    let ports = input.ports;
    if (!ports) { let p = 18080; while (collision("", input.servers, { http: p, internal: p + 1 })) p += 2; ports = { http: p, internal: p + 1 }; }
    if (collision("", input.servers, ports)) { reply(409, { error: "Ports are reserved by another fleet" }); return; }
    const id = "f" + String(++revision).padStart(24, "0");
    const f = fleet(id, input.name, input.servers, ports); f.status = "provisioning"; f.servers = f.servers.map((n) => ({ ...n, running: false, healthy: false, url: undefined })); f.urls = [];
    fleets.set(id, f); res.setHeader("Location", "/celld/fleets/" + id); reply(202, f); later(f); return;
  }
  const live = path.match(/^\/celld\/fleets\/([^/]+)\/(logs|events)\/stream$/);
  if (live) {
    if (modes.streamUnsupported) { reply(404, { error: "Streaming unavailable" }); return; }
    if (!fleets.has(live[1]) && live[1] !== "historical") { reply(404, { error: "Fleet not found" }); return; }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    const now = Date.now();
    res.write('event: ready\ndata: ' + JSON.stringify({ received_ms: now }) + '\n\n');
    res.write('event: caught_up\ndata: ' + JSON.stringify({ received_ms: now, from: Number(url.searchParams.get("from")), to: now }) + '\n\n');
    const client = { res, query: url.searchParams, kind: live[2] };
    streamClients.add(client);
    const heartbeat = setInterval(() => res.write('event: heartbeat\ndata: {}\n\n'), 15000);
    res.on("close", () => { clearInterval(heartbeat); streamClients.delete(client); });
    return;
  }
  const observation = path.match(/^\/celld\/fleets\/([^/]+)\/(observability|logs|events|metrics|traces\/[a-f0-9]{32})$/);
  if (observation) {
    const id = observation[1], endpoint = observation[2];
    if (!fleets.has(id) && id !== "historical") { reply(404, { error: "Fleet history not found or expired" }); return; }
    const now = Date.now(), trace = "0123456789abcdef0123456789abcdef";
    const state = modes.observationState || "fresh";
    const resources = { sampled_ms: now - 5000, rss_bytes: 52428800, cpu_percent_x100: 1250, owned_cells: 10, resident_cells: 4, pressured: false };
    if (endpoint === "observability") { reply(200, { fleet_id: id, historical: id === "historical", incomplete: true, nodes: [{ node_id: "127.0.0.2", state, collected_ms: now - 5000, attempted_ms: now, resources, workloads: [{ kind: "worker", id: "app", live: 1, heap_bytes: 2097152 }], capabilities: [{ name: "queue_counters", state: "unsupported", detail: "Queue backlog is unavailable" }] }, { node_id: "127.0.0.3", state: "pending" }], deployment: { state: "fresh", collected_ms: now - 30000, workloads: [{ kind: "queue", id: "JOBS", parent: "app", state: "configured" }] }, storage: { bytes: 10485760, global_bytes: 20971520, fleet_budget_bytes: 1073741824, global_budget_bytes: 10737418240, retention_days: 7, dropped: 0, rejected_batches: 1, pruned_segments: 0 } }); return; }
    const from = Number(url.searchParams.get("from") || now - 3600000), to = Number(url.searchParams.get("to") || now);
    const rows = [
      { id: "opaque-log", node: "127.0.0.2", received_ms: now, record: { time_ms: observationTime, kind: "log", source: "otlp", severity: "ERROR", body: "Request processing failed (synthetic)", workload: "app", trace_id: trace } },
      { id: "opaque-span", node: "127.0.0.2", received_ms: now, record: { time_ms: observationTime, kind: "span", source: "otlp", body: "GET /orders", trace_id: trace, span_id: "0123456789abcdef", duration_us: 8000, failed: true } },
      { id: "opaque-child", node: "127.0.0.2", received_ms: now, record: { time_ms: observationTime + 2, kind: "span", source: "otlp", body: "storage.read", trace_id: trace, span_id: "fedcba9876543210", parent_span_id: "0123456789abcdef", duration_us: 4000, failed: false } },
    ];
    if (endpoint === "metrics") {
      const records = ["127.0.0.2", "127.0.0.3"].flatMap((node, index) => Array.from({ length: 24 }, (_, n) => ({ id: `sample-${index}-${n}`, node, snapshot: { collected_ms: from + Math.floor((to - from) * (n + 0.5) / 24), resources: { ...(index === 1 && n === 10 ? {} : { rss_bytes: (40 + index * 20 + n * 0.4 + Math.sin(n * 0.7) * 4) * 1048576 }), cpu_percent_x100: n === 0 ? 0 : Math.round((12 + index * 8 + Math.sin(n * 0.6) * 8) * 100) } } }))).filter(row => !url.searchParams.get("node") || row.node === url.searchParams.get("node"));
      reply(200, { samples: { records, from, to, incomplete: true }, requests: { count: 120, errors: 3, rate_per_second: 0.0333, mean_duration_us: 8000, max_duration_us: 250000, observed: true, incomplete: true } }); return;
    }
    const logRows = [rows[0], ...["stdout", "stderr", "container"].map((source) => ({ ...rows[0], id: `origin-${source}`, record: { time_ms: observationTime, kind: "log", source, severity: "INFO", body: source === "container" ? "Container ready (synthetic)" : `celld ${source} output (synthetic)` } }))];
    let records = endpoint === "events" ? [{ id: "event", node: "127.0.0.2", received_ms: now, record: { time_ms: observationTime, kind: "event", source: "lifecycle", body: "Process started (synthetic)" } }] : endpoint.startsWith("traces") ? rows : logRows;
    if (modes.observationRows && (endpoint === "logs" || endpoint === "events")) records = Array.from({ length: Math.min(500, modes.observationRows) }, (_, n) => ({ ...records[0], id: `buffer-${n}`, node: n % 3 === 0 ? "127.0.0.3" : "127.0.0.2", record: { ...records[0].record, time_ms: observationTime + n, severity: n % 10 === 0 ? "ERROR" : "INFO", body: `${records[0].record.body} · entry ${n}` } }));
    records = records.filter((r) => r.record.time_ms >= from && r.record.time_ms <= to && ["node", "workload", "source", "severity"].every((key) => !url.searchParams.get(key) || (key === "source" && url.searchParams.get(key) === "process" ? ["stdout", "stderr"].includes(r.record.source) : (key === "node" ? r.node : r.record[key]) === url.searchParams.get(key))) && (!url.searchParams.get("text") || r.record.body.includes(url.searchParams.get("text"))));
    if (endpoint === "logs" && url.searchParams.get("download") === "true") { res.writeHead(200, { "Content-Type": "application/x-ndjson" }); res.end(records.map(row => JSON.stringify(row)).join("\n") + "\n"); return; }
    const offset = Number(url.searchParams.get("cursor")?.replace("fixture-offset-", "") || 0), limit = Number(url.searchParams.get("limit") || 200), next = offset + limit;
    reply(200, { records: records.slice(offset, next), ...(next < records.length ? { next_cursor: `fixture-offset-${next}` } : {}), from, to, incomplete: true, truncated: next < records.length }); return;
  }
  const match = path.match(/^\/celld\/fleets\/([^/]+)(?:\/(credentials|start|stop|restart))?$/);
  if (match) {
    const f = fleets.get(decodeURIComponent(match[1])), action = match[2];
    if (!f) { reply(404, { error: "Fleet not found" }); return; }
    if (action === "credentials" && req.method === "GET") { reply(200, { aws_access_key_id: "fixture-" + f.id, aws_secret_access_key: "fixture-only-secret-" + f.id }); return; }
    if (!action && req.method === "GET") { reply(200, f); return; }
    if (["provisioning", "deleting"].includes(f.status)) { reply(409, { error: "A fleet operation is already pending" }); return; }
    if (!action && req.method === "PATCH") {
      if ([...fleets.values()].some((other) => other.id !== f.id && other.name === input.name)) { reply(409, { error: "Fleet name already exists" }); return; }
      if (input.ports && f.desired_state !== "stopped") { reply(409, { error: "Stop the fleet before changing ports" }); return; }
      if (input.ports && collision(f.id, input.servers, input.ports)) { reply(409, { error: "Ports are reserved by another fleet" }); return; }
      f.name = input.name; f.ports = input.ports || f.ports; f.servers = input.servers.map((name) => node(name, f.ports, f.desired_state === "running"));
      f.status = "provisioning"; describe(f); reply(202, f); later(f); return;
    }
    if (req.method === "DELETE" && !action) { f.desired_state = "deleting"; f.status = "deleting"; reply(202, f); later(f, true); return; }
    if (req.method === "POST" && action) { f.desired_state = action === "stop" ? "stopped" : "running"; f.status = "provisioning"; reply(202, f); later(f); return; }
  }
  reply(200, {});
});
server.on("upgrade", (req, socket) => {
  const accept = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
  socket.on("error", () => {}); socket.on("data", () => {});
});
server.listen(port, "127.0.0.1", () => console.log("Synthetic celld browser fixture: http://127.0.0.1:" + port));
