import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { ink, muted, surface } from "@/components/support/support-ui";

// `fill` lays the IDE out to fill its parent (explorer + editor) instead of a fixed-height card.
export type AutomationIdeProps = { automationId: string; onShowRun: (runId: string) => void; fill?: boolean };

// Native builds never import Monaco; the web build resolves automation-ide.web.tsx instead.
export function AutomationIde(_props: AutomationIdeProps) {
  return <Box className={surface + " gap-2"}>
    <Heading size="md" className={ink}>Code</Heading>
    <Text className={muted}>Editing scripts and package.json is available in the web app only. You can still configure, run and watch automations here.</Text>
  </Box>;
}
