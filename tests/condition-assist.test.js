import { applySuggestion, lintCondition, suggest } from "../utils/condition-assist";

const catalog = {
  apps: [
    { id: "a1", name: "DB", connectivity: "online", health: "healthy", instances: ["instance-1"], streams: [
      { name: "cpu", type: "number", unit: "%", value: 42 },
      { name: "disk.used", type: "number", value: 7 },
      { name: "role", type: "text", value: "primary" },
      { name: "health", type: "text" },
    ] },
    { id: "a2", name: "Web", connectivity: "offline", health: "unknown", instances: [], streams: [] },
  ],
};

const labels = (text, cursor = text.length) => suggest(text, cursor, catalog)?.items.map((i) => i.label) ?? [];
const accept = (text, label) => {
  const completion = suggest(text, text.length, catalog);
  return applySuggestion(text, completion, completion.items.find((i) => i.label === label));
};

test("offers Apps, then fields and streams, then typed comparisons", () => {
  expect(labels("")).toEqual(["app('DB')", "app('Web')"]);
  expect(labels("w")).toEqual(["app('Web')"]);
  expect(accept("ap", "app('DB')")).toEqual({ text: "app('DB').", cursor: 10 });
  expect(labels("app('DB').")).toEqual(expect.arrayContaining(["health", "connectivity", "cpu", "disk.used", "role"]));
  expect(labels("app('DB').cp")).toEqual(["cpu"]);
  expect(accept("app('DB').cp", "cpu").text).toBe("app('DB').cpu ");
  expect(labels("app('DB').cpu ")).toContain(">=");
  expect(labels("app('DB').connectivity ")).toContain("== 'offline'");
  expect(labels("app('DB').role ")).toContain("== ''");
  expect(accept("app('DB').role ", "== ''")).toEqual({ text: "app('DB').role == ''", cursor: 19 });
});

test("uses bracket access for non-identifier and clashing stream names", () => {
  expect(accept("app('DB').dis", "disk.used").text).toBe("app('DB')['disk.used'] ");
  expect(accept("app('DB').", "health").text).toBe("app('DB').health ");
  const streams = suggest("app('DB').", 10, catalog).items.filter((i) => i.kind === "stream" && i.label === "health");
  expect(streams[0].insert).toBe(".streams['health'] ");
});

test("completes inside strings", () => {
  expect(labels("app('d")).toEqual(["DB"]);
  expect(accept("app('d", "DB").text).toBe("app('DB').");
  expect(labels("app('DB', '")).toEqual(["instance-1"]);
  expect(labels("app('DB')['di")).toEqual(["disk.used"]);
  expect(labels("app('DB').health == '")).toEqual(["healthy", "degraded", "unhealthy", "unknown"]);
  expect(labels("app('DB').role == '")).toEqual(["primary"]);
});

test("lints unknown names, wrong types and missing values", () => {
  const messages = (text) => lintCondition(text, catalog).map((h) => h.message);
  expect(messages("app('DB').cpu >= 95 && app('web').connectivity == 'offline'")).toEqual([]);
  expect(messages("app('Dv').cpu > 1")).toEqual(["Unknown App 'Dv'. Did you mean 'DB'?"]);
  expect(messages("app('DB').cpuu > 1")).toEqual(["DB has no stream 'cpuu'. Did you mean 'cpu'?"]);
  expect(messages("app('DB', 'instance-2').cpu > 1")[0]).toBe("DB has no instance 'instance-2'. Did you mean 'instance-1'?");
  expect(messages("app('DB').cpu > '95'")).toEqual(["DB.cpu is a number but is compared with '95'."]);
  expect(messages("app('DB').health == 'ok'")[0]).toContain("is one of 'healthy'");
  expect(messages("app('DB').streams['health'] == 'x'")[0]).toContain("no current value");
});
