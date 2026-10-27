const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Server: WebSocketServer } = require("ws");
const root = path.resolve(__dirname, "../../dist");
const port = Number(process.env.PORT || 8097);
const now = () => new Date().toISOString();
const participant = { connectivity: "online", health: "healthy", health_message: "All checks passed", last_heartbeat_at: now() };
let tabs = [{ id: "general", name: "General" }, { id: "workers", name: "Workers" }];
let apps = [{ ...participant, id: "payments", name: "Payments API", tab_id: "general", tags: ["Go", "production"], heartbeat_timeout_seconds: 120, retention_days: 7, instances: [{ ...participant, instance_id: "worker-a" }, { ...participant, instance_id: "worker-b", connectivity: "offline", health: "unhealthy", health_message: "Database unavailable" }] }];
apps[0].connectivity = "offline";
apps[0].health = "unhealthy";
const streams = [
  { name: "cpu", type: "number", unit: "%", label: "CPU" }, { name: "version", type: "text", unit: "", label: "Version" },
  { name: "ready", type: "boolean", unit: "", label: "Readiness" }, { name: "logs", type: "log", unit: "", label: "Application logs" }, { name: "deployments", type: "event", unit: "", label: "Deployments" },
];
let layout = { revision: 0, widgets: [
  { id: "cpu-value", stream: "cpu", kind: "value", x: 0, y: 0, w: 3, h: 2 },
  { id: "version", stream: "version", kind: "text", x: 3, y: 0, w: 3, h: 1 },
  { id: "ready", stream: "ready", kind: "boolean", x: 6, y: 0, w: 2, h: 1 },
  { id: "cpu-progress", stream: "cpu", kind: "progress", x: 8, y: 0, w: 4, h: 2, min: 0, max: 100 },
  { id: "cpu-sparkline", stream: "cpu", kind: "sparkline", x: 3, y: 1, w: 5, h: 2, window_minutes: 60 },
  { id: "cpu-line", stream: "cpu", kind: "line", x: 0, y: 3, w: 8, h: 4, window_minutes: 60 },
  { id: "cpu-gauge", stream: "cpu", kind: "gauge", x: 8, y: 2, w: 4, h: 3, min: 0, max: 100 },
  { id: "logs", stream: "logs", kind: "logs", x: 8, y: 5, w: 4, h: 5 },
  { id: "events", stream: "deployments", kind: "events", x: 0, y: 7, w: 8, h: 3 },
  { id: "cpu-area", stream: "cpu", kind: "area", x: 0, y: 10, w: 6, h: 4, window_minutes: 60 },
  { id: "cpu-bar", stream: "cpu", kind: "bar", x: 6, y: 10, w: 6, h: 4, window_minutes: 60 },
  { id: "cpu-table", stream: "cpu", kind: "table", x: 0, y: 14, w: 12, h: 5 },
] };
const samples = [];
for (let index = 0; index < 240; index++) samples.push({ id: index + 1, app_id: "payments", stream: "cpu", instance_id: "worker-a", timestamp: now(), received_at: new Date(Date.now() - (240 - index) * 1000).toISOString(), value: 30 + Math.sin(index / 5) * 20 });
samples.push(...[
  ["version", "2.4.1"], ["ready", true], ["logs", { severity: "error", message: "Database connection refused" }],
  ["logs", { severity: "info", message: "Retrying connection" }], ["deployments", { name: "release", fields: { version: "2.4.1", author: "fixture" } }],
].map(([stream, value], index) => ({ id: 241 + index, app_id: "payments", stream, value, received_at: now(), timestamp: now(), instance_id: null })));
for (let index = 0; index < 80; index++) samples.push({ id: 246 + index, app_id: "payments", stream: "logs", instance_id: "worker-a", received_at: new Date(Date.now() - (80 - index) * 500).toISOString(), timestamp: now(), value: { severity: index % 17 === 0 ? "warn" : "info", message: `request=${index + 1} method=GET path=/health status=200 duration=${12 + index % 9}ms` } });
let nextId = 326;
const sockets = new WebSocketServer({ noServer: true });
setInterval(() => {
  const batch = [];
  for (let index = 0; index < 4; index++) batch.push({ id: nextId++, app_id: "payments", stream: "logs", instance_id: "worker-a", received_at: now(), timestamp: now(), value: { severity: nextId % 13 === 0 ? "warn" : "info", message: `request=${nextId} method=POST path=/payments status=200 duration=${nextId % 80}ms` } });
  batch.push({ id: nextId++, app_id: "payments", stream: "cpu", instance_id: "worker-a", received_at: now(), timestamp: now(), value: 30 + Math.sin(nextId / 7) * 20 });
  samples.push(...batch);
  while (samples.length > 1500) samples.splice(samples.findIndex((sample) => sample.stream === "cpu" || sample.stream === "logs"), 1);
  for (const client of sockets.clients) if (client.readyState === 1) client.send(JSON.stringify({ type: "samples", app_id: "payments", samples: batch }));
}, 1000);

const notify = () => { for (const client of sockets.clients) if (client.readyState === 1) client.send(JSON.stringify({ type: "changed" })); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const reply = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(value === undefined ? "" : JSON.stringify(value)); };
  if (!url.pathname.startsWith("/api/")) {
    const filename = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (!filename.startsWith(root + path.sep) && filename !== root) { reply(403, {}); return; }
    const target = fs.existsSync(filename) && fs.statSync(filename).isFile() ? filename : path.join(root, "index.html");
    res.setHeader("Content-Type", target.endsWith(".js") ? "application/javascript" : target.endsWith(".css") ? "text/css" : target.endsWith(".ttf") ? "font/ttf" : target.endsWith(".html") ? "text/html" : "application/octet-stream");
    fs.createReadStream(target).pipe(res); return;
  }
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 1048576) { reply(413, {}); return; } }
  let input = {};
  try { if (body) input = JSON.parse(body); } catch { reply(400, { error: "Invalid JSON" }); return; }
  if (url.pathname === "/api/login") { reply(200, { token: "fixture-session" }); return; }
  const route = url.pathname.replace(/^\/api\/support/, "");
  if (req.method === "GET" && route === "/tabs") { reply(200, tabs); return; }
  if (req.method === "GET" && route === "/apps") { reply(200, apps); return; }
  if (route === "/ws-ticket") { reply(200, { ticket: "synthetic-once" }); return; }
  if (route === "/tabs" && req.method === "POST") { const tab = { id: "tab-" + tabs.length, name: input.name }; tabs.push(tab); reply(201, tab); notify(); return; }
  if (route.startsWith("/tabs/")) {
    const id = route.split("/")[2];
    if (req.method === "DELETE") { if (apps.some((app) => app.tab_id === id)) { reply(409, { error: "Move Apps out of this tab first" }); return; } tabs = tabs.filter((tab) => tab.id !== id); reply(204); }
    else { const tab = tabs.find((tab) => tab.id === id); if (tab) tab.name = input.name; reply(200, tab); } notify(); return;
  }
  if (route === "/apps" && req.method === "POST") { const app = { ...input, ...participant, id: "app-" + apps.length, instances: [] }; apps.push(app); reply(201, { app, secret: "synthetic-app-secret" }); notify(); return; }
  if (route.startsWith("/apps/")) {
    const [, , id, suffix] = route.split("/"); const app = apps.find((item) => item.id === id);
    if (!app) { reply(404, { error: "Unknown App" }); return; }
    if (suffix === "samples") { const severity = url.searchParams.get("severity")?.split(","); let rows = samples.filter((sample) => sample.stream === url.searchParams.get("stream") && (!url.searchParams.has("before") || sample.id < Number(url.searchParams.get("before"))) && (!severity?.length || severity.includes(sample.value.severity))); const more = rows.length > 200; rows = rows.slice(-200); reply(200, { samples: rows, next_before: more ? rows[0].id : null }); return; }
    if (suffix === "rotate-secret") { reply(200, { secret: "synthetic-rotated-secret" }); return; }
    if (suffix === "layout") { if (req.method === "PUT") { if (input.revision !== layout.revision) { reply(409, { error: "Dashboard changed" }); return; } layout = { ...input, revision: layout.revision + 1 }; notify(); } reply(200, layout); return; }
    if (req.method === "DELETE") { apps = apps.filter((item) => item.id !== id); reply(204); notify(); return; }
    if (req.method === "PUT") { Object.assign(app, input); reply(200, app); notify(); return; }
    reply(200, { app, streams, layout }); return;
  }
  reply(200, []);
});
server.on("upgrade", (req, socket, head) => sockets.handleUpgrade(req, socket, head, (client) => { sockets.emit("connection", client, req); client.send(JSON.stringify({ type: "ready" })); }));
server.listen(port, "127.0.0.1", () => console.log("Synthetic HH Support preview: http://127.0.0.1:" + port + "/support"));
