import React from "react";
import {RefreshControl, ScrollView, Text, useColorScheme} from "react-native";
import {Box} from "@/components/ui/box";
import MountCard, {MountSkeletonGrid} from "@/components/mount";
import {useMounts} from "@/hooks/useMounts";
import {MountShare} from "@/types/mount";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";

export default function MountsScreen() {
  const {token, isChecking} = useAuthGuard();
  const {mounts, error, isLoading, isRefreshing, refresh, removeMount} = useMounts({
    token,
  });

  const colorScheme = useColorScheme();
  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  const handleMountRemoved = React.useCallback(
    (share: MountShare) => {
      removeMount(share);
    },
    [removeMount]
  );

  if (isChecking || !token) {
    return null;
  }

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full">
        <Heading
          size="2xl"
          className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
          style={{fontFamily: "Inter_700Bold"}}
        >
          NFS
        </Heading>
        <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl">
          Browse all ISOs available for your VMs and add new images by
          downloading them straight to the cluster.
        </Text>

        <VStack className="mt-6 gap-4 web:flex-row web:items-end">
          <Box className="flex-1 w-full min-h-0">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 64,
              }}
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
              <Box
                className={
                  isLoading
                    ? "flex flex-col gap-4 web:grid web:grid-cols-1 web:gap-6 web:sm:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4 web:items-stretch"
                    : "flex flex-col gap-5 web:grid web:grid-cols-1 web:gap-6 web:sm:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4 web:items-stretch"
                }
              >
                {isLoading ? (
                  <MountSkeletonGrid />
                ) : error ? (
                  <Box className="p-3 web:rounded-2xl web:bg-background-0/80">
                    <Text
                      className="text-[#EF4444]"
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      Erro ao carregar mounts: {error}
                    </Text>
                  </Box>
                ) : mounts.length === 0 ? (
                  <Box className="p-3 web:rounded-2xl web:bg-background-0/80">
                    <Text
                      className="color-[#9AA4B8] web:text-base"
                      style={{fontFamily: "Inter_400Regular"}}
                    >
                      Nenhum mount encontrado.
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
            </ScrollView>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
