import type { CelldObservability, CelldWorkload } from "@/types/celld";
export type WorkloadScope = "runtime" | "configuration";
export type WorkloadEntry = {
  key: string;
  node?: string;
  observed?: number;
  observationState?: string;
  workload: CelldWorkload;
};
export function workloadInventory(
  data: CelldObservability,
  scope: WorkloadScope,
): WorkloadEntry[] {
  const rows =
    scope === "runtime"
      ? (data.nodes ?? []).flatMap((node) =>
          (node.workloads ?? []).map((workload) => ({
            node: node.node_id,
            observed: node.collected_ms,
            observationState: node.state,
            workload,
          })),
        )
      : (data.deployment?.workloads ?? []).map((workload) => ({
          node: undefined,
          observed: data.deployment?.collected_ms,
          observationState: data.deployment?.state,
          workload,
        }));
  const keys = new Map<string, number>();
  return rows.map((row, index) => {
    const base = JSON.stringify([
      scope,
      row.node,
      row.workload.kind,
      row.workload.id ?? index,
      row.workload.version,
      row.workload.parent,
    ]);
    const occurrence = keys.get(base) ?? 0;
    keys.set(base, occurrence + 1);
    return { ...row, key: `${base}/${occurrence}` };
  });
}
export function selectWorkloads(
  rows: WorkloadEntry[],
  search: string,
  node: string,
  kind: string,
  sort: "name" | "memory" | "cpu",
) {
  const text = search.trim().toLowerCase(),
    nodeText = node.trim().toLowerCase();
  return rows
    .filter(
      (row) =>
        (!nodeText || (row.node ?? "").toLowerCase().includes(nodeText)) &&
        (!kind || row.workload.kind === kind) &&
        `${row.workload.id ?? ""} ${row.workload.parent ?? ""} ${row.workload.kind ?? ""} ${row.workload.version ?? ""} ${row.workload.state ?? ""}`
          .toLowerCase()
          .includes(text),
    )
    .sort((a, b) => {
      if (sort !== "name") {
        const value = (entry: WorkloadEntry) =>
          sort === "cpu"
            ? entry.workload.cpu_percent
            : (entry.workload.memory_bytes ?? entry.workload.heap_bytes);
        const left = value(a),
          right = value(b);
        if (left === undefined && right !== undefined) return 1;
        if (left !== undefined && right === undefined) return -1;
        if (left !== undefined && right !== undefined && left !== right)
          return right - left;
      }
      return (
        (a.workload.id ?? "").localeCompare(b.workload.id ?? "") ||
        (a.node ?? "").localeCompare(b.node ?? "") ||
        a.key.localeCompare(b.key)
      );
    });
}
