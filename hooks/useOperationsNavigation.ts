import React from "react";
import type { CelldDetailTab, CelldObservationQuery } from "@/types/celld";
type Session = { query: CelldObservationQuery; traceId?: string };
// Persist applied searches without keeping hidden views or their polling mounted.
export function useOperationsNavigation(
  initialTab: CelldDetailTab = "overview",
) {
  const [tab, selectTab] = React.useState(initialTab);
  const [workloadNode, setWorkloadNode] = React.useState<string | undefined>();
  const openWorkloads = React.useCallback((node?: string) => {
    setWorkloadNode(node);
    selectTab("workloads");
  }, []);
  const [sessions, setSessions] = React.useState<
    Partial<Record<CelldDetailTab, Session>>
  >({});
  const save = React.useCallback(
    (
      target: CelldDetailTab,
      query: CelldObservationQuery,
      traceId?: string,
    ) => {
      setSessions((old) => {
        const next = { query, traceId };
        return JSON.stringify(old[target]) === JSON.stringify(next)
          ? old
          : { ...old, [target]: next };
      });
    },
    [],
  );
  const remember = React.useCallback(
    (query: CelldObservationQuery, traceId?: string) =>
      save(tab, query, traceId),
    [save, tab],
  );
  const inspect = React.useCallback(
    (target: "logs" | "metrics", query: CelldObservationQuery) => {
      save(target, query);
      selectTab(target);
    },
    [save],
  );
  const openTrace = React.useCallback(
    (id: string, query: CelldObservationQuery) => {
      save("trace", query, id);
      selectTab("trace");
    },
    [save],
  );
  return {
    tab,
    selectTab,
    workloadNode,
    setWorkloadNode,
    openWorkloads,
    selection: sessions[tab],
    remember,
    inspect,
    openTrace,
  };
}
