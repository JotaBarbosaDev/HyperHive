import React from "react";
import {RefreshControl, ScrollView, Text, useColorScheme} from "react-native";
import {Box} from "@/components/ui/box";
import MountCard, {MountSkeletonGrid} from "@/components/mount";
import {useMounts} from "@/hooks/useMounts";
import {DEFAULT_AUTH_TOKEN} from "@/config/apiConfig";
import {MountShare} from "@/types/mount";

export default function MountsScreen() {
  const token = DEFAULT_AUTH_TOKEN;
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

  return (
    <Box className="flex min-h-screen flex-col bg-background-50 p-3 pt-16 dark:bg-[#070D19] gap-4 web:bg-background-0 web:px-10 web:py-10">
      <Box className="flex w-full items-center web:mx-auto web:max-w-7xl">
        <Text
          className="text-2xl text-typography-900 dark:text-typography-900 web:text-[32px]"
          style={{fontFamily: "Inter_700Bold"}}
        >
          Mounts
        </Text>
      </Box>
      <Box className="mt-6 flex-1 w-full min-h-0 overflow-hidden web:mx-auto web:max-w-7xl">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 64}}
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
    </Box>
  );
}
