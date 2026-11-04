import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { ink, muted, surface } from "@/components/support/support-ui";

// Native builds never import the graph libraries; web resolves network-map.web.tsx instead.
export function NetworkMap() {
  return <Box className="flex-1 p-4 bg-background-0 dark:bg-[#070D19]">
    <Box className={surface + " gap-2"}>
      <Heading size="md" className={ink}>Network map</Heading>
      <Text className={muted}>The network map is available in the web app only.</Text>
    </Box>
  </Box>;
}
