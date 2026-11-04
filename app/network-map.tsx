import React from "react";
import { Box } from "@/components/ui/box";
import { NetworkMap } from "@/components/network/network-map";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function NetworkMapScreen() {
  const { token, isChecking } = useAuthGuard();
  if (isChecking || !token) return null;
  return <Box className="flex-1"><NetworkMap /></Box>;
}
