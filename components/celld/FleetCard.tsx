import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";
import type { CelldAction, CelldDetailTab, CelldFleet } from "@/types/celld";
import { canChange, cardClassName, ErrorMessage, mutedClassName, observedAt, StatusBadge, titleClassName } from "./shared";

export function FleetCard({ fleet, busy, onDetails, onInspect, onEdit, onAction }: {
  fleet: CelldFleet; busy: boolean; onDetails: () => void; onInspect: (tab: CelldDetailTab) => void; onEdit: () => void; onAction: (action: CelldAction) => void;
}) {
  const disabled = busy || !canChange(fleet);
  const ready = fleet.servers.filter((node) => node.healthy).length;
  return <Box id={"celld-fleet-" + fleet.id} className={cardClassName + " gap-4"}>
    <Box className="flex-row flex-wrap justify-between items-start gap-3">
      <Box className="gap-1 flex-1 min-w-0">
        <Heading size="md" className={titleClassName}>{fleet.name}</Heading>
        <Text selectable className={mutedClassName}>{fleet.storage.bucket}</Text>
      </Box>
      <StatusBadge value={fleet.status} />
    </Box>
    <Box className="gap-2">
      <Text className={mutedClassName}>Desired: {fleet.desired_state} · {ready} / {fleet.servers.length} servers ready</Text>
      <Text className={mutedClassName}>HTTP {fleet.ports.http} · Internal {fleet.ports.internal}</Text>
      <Box className="flex-row flex-wrap gap-2">{fleet.servers.map((node) => <Box key={node.name} className="px-3 py-1.5 rounded-lg bg-background-50 dark:bg-[#101E32]">
        <Text className={"text-xs " + titleClassName}>{node.name}{node.healthy ? " · ready" : node.error ? " · error" : node.running ? " · starting" : ""}</Text>
      </Box>)}</Box>
      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Checked: {observedAt(fleet.checked_at)}</Text>
    </Box>
    <ErrorMessage message={fleet.error} />
    {fleet.status === "deleting" ? <Text className={mutedClassName}>Deletion is pending until all servers and storage have been cleaned up.</Text> : null}
    <Box className="flex-row flex-wrap gap-2">{(["overview", "workloads", "logs", "metrics", "events"] as const).map((tab) => <Button key={tab} className="rounded-xl" variant="outline" action="secondary" onPress={() => onInspect(tab)}><ButtonText>{tab[0].toUpperCase() + tab.slice(1)}</ButtonText></Button>)}</Box>
    <Box className="flex-row flex-wrap gap-2 border-t border-outline-100 dark:border-[#2A3B52] pt-4">
      <Button className="rounded-xl" variant="outline" action="secondary" onPress={onDetails} isDisabled={busy}><ButtonText>Deployment</ButtonText></Button>
      <Button className="rounded-xl" variant="outline" action="secondary" onPress={onEdit} isDisabled={disabled}><ButtonText>Edit</ButtonText></Button>
      {fleet.desired_state === "stopped" ?
        <Button className="rounded-xl" variant="outline" action="secondary" onPress={() => onAction("start")} isDisabled={disabled}><ButtonText>Start</ButtonText></Button> : <>
          <Button className="rounded-xl" variant="outline" action="secondary" onPress={() => onAction("stop")} isDisabled={disabled}><ButtonText>Stop</ButtonText></Button>
          <Button className="rounded-xl" variant="outline" action="secondary" onPress={() => onAction("restart")} isDisabled={disabled}><ButtonText>Restart</ButtonText></Button>
        </>}
      <Button className="rounded-xl" variant="outline" action="negative" onPress={() => onAction("delete")} isDisabled={disabled}><ButtonText>Delete</ButtonText></Button>
    </Box>
  </Box>;
}
