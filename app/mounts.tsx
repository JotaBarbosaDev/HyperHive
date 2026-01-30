import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { Plus, RefreshCw } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import MountCard, { MountSkeletonGrid } from "@/components/mount";
import { CreateMountDrawer } from "@/components/drawers/CreateMountDrawer";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMounts } from "@/hooks/useMounts";
import { MountShare } from "@/types/mount";

export default function MountsScreen() {
  const { token, isChecking } = useAuthGuard();
  const { mounts, error, isLoading, isRefreshing, refresh, removeMount } = useMounts({
    token,
  });

  const [showDrawer, setShowDrawer] = React.useState(false);

  const colorScheme = useColorScheme();
  const refreshControlTint = colorScheme === "dark" ? "rgb(248, 250, 252)" : "rgb(15, 23, 42)";
  const refreshControlBackground = colorScheme === "dark" ? "rgb(30, 41, 59)" : "rgb(226, 232, 240)";

  const handleMountRemoved = React.useCallback(
    (share: MountShare) => {
      removeMount(share);
    },
    [removeMount]
  );

  const handleCreateSuccess = React.useCallback(() => {
    refresh();
    setShowDrawer(false);
  }, [refresh]);

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-20 web:max-w-7xl web:mx-auto web:w-full">
          <VStack className="gap-2 mb-6">
            <Heading
              size="2xl"
              className="text-typography-900 dark:text-[#E8EBF0] mb-1 web:text-4xl"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              NFS Mounts
            </Heading>
            <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
              Manage your NFS shares across the cluster and create new mounts for your VMs.
            </Text>
          </VStack>

          <HStack className="gap-3 items-center justify-end flex-shrink-0 mb-6">
            <Button
              variant="outline"
              action="default"
              className="h-11 px-4 rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
              onPress={refresh}
              isDisabled={isRefreshing || isLoading}
            >
              {isRefreshing ? (
                <ButtonSpinner />
              ) : (
                <ButtonIcon
                  as={RefreshCw}
                  className="text-typography-900 dark:text-[#E8EBF0]"
                />
              )}
            </Button>
            <Button
              action="primary"
              className="h-11 rounded-xl dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:active:bg-[#14B8A6]"
              onPress={() => setShowDrawer(true)}
            >
              <ButtonIcon as={Plus} />
              <ButtonText style={{ fontFamily: "Inter_600SemiBold" }}>
                Create NFS
              </ButtonText>
            </Button>
          </HStack>

          <Box
            className={
              isLoading
                ? "mt-6 flex flex-col gap-4 web:grid web:grid-cols-1 web:gap-6 web:sm:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4 web:items-stretch"
                : "mt-6 flex flex-col gap-5 web:grid web:grid-cols-1 web:gap-6 web:sm:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4 web:items-stretch"
            }
          >
            {isLoading ? (
              <MountSkeletonGrid />
            ) : error ? (
              <Box className="p-3 web:rounded-2xl web:bg-background-0/80">
                <Text className="text-[#EF4444]" style={{ fontFamily: "Inter_400Regular" }}>
                  Error loading mounts: {error}
                </Text>
              </Box>
            ) : mounts.length === 0 ? (
              <Box className="p-3 web:rounded-2xl web:bg-background-0/80">
                <Text className="text-[#9AA4B8] web:text-base" style={{ fontFamily: "Inter_400Regular" }}>
                  No mounts found.
                </Text>
              </Box>
            ) : (
              mounts.map((mount) => (
                <MountCard
                  key={mount.NfsShare.Id}
                  {...mount}
                  onDelete={handleMountRemoved}
                />
              ))
            )}
          </Box>
        </Box>
      </ScrollView>
      <CreateMountDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSuccess={handleCreateSuccess}
      />
    </Box>
  );
}
