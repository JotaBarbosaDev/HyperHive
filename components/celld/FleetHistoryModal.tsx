import React from "react";
import { FleetOverview, FleetRecords } from "./FleetObservability";
import { FleetWorkloads } from "./OperationsWorkloads";
import { OperationsShell } from "./OperationsShell";
import { useOperationsNavigation } from "@/hooks/useOperationsNavigation";
export function FleetHistoryModal({
  token,
  fleetId,
  onClose,
}: {
  token: string;
  fleetId: string;
  onClose: () => void;
}) {
  const navigation = useOperationsNavigation();
  const { tab } = navigation;
  return (
    <OperationsShell
      name={fleetId}
      fleetId={fleetId}
      tab={tab}
      onTab={navigation.selectTab}
      onClose={onClose}
      historical
    >
      {tab === "overview" ? (
        <FleetOverview
          token={token}
          fleetId={fleetId}
          onNavigate={navigation.inspect}
          onWorkloads={navigation.openWorkloads}
        />
      ) : tab === "workloads" ? (
        <FleetWorkloads
          token={token}
          fleetId={fleetId}
          initialNode={navigation.workloadNode}
          onNodeChange={navigation.setWorkloadNode}
          onNavigate={navigation.inspect}
        />
      ) : (
        <FleetRecords
          key={tab}
          token={token}
          fleetId={fleetId}
          kind={tab as "logs" | "metrics" | "events" | "trace"}
          initialTrace={navigation.selection?.traceId}
          initialQuery={navigation.selection?.query}
          onTrace={navigation.openTrace}
          onStateChange={navigation.remember}
        />
      )}
    </OperationsShell>
  );
}
