import React from "react";
import { RefreshControl, ScrollView, useColorScheme } from "react-native";
import { Plus, RefreshCw, Search } from "lucide-react-native";
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
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { MountShare } from "@/types/mount";

export default function MountsScreen() {
  const { token, isChecking } = useAuthGuard();
  const { mounts, error, isLoading, isRefreshing, refresh, removeMount } = useMounts({
    token,
  });

  const [showDrawer, setShowDrawer] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [health, setHealth] = React.useState("All");
  const [ascending, setAscending] = React.useState(true);
  const visibleMounts = React.useMemo(() => mounts.filter(({ NfsShare, Status }) => {
    const matchesHealth = health === "All" || (health === "Healthy" ? Status.working : !Status.working);
    return matchesHealth && [NfsShare.Name, NfsShare.MachineName, NfsShare.FolderPath, NfsShare.Source, NfsShare.Target]
      .some(value => value?.toLowerCase().includes(query.trim().toLowerCase()));
  }).sort((a, b) => (ascending ? 1 : -1) * a.NfsShare.Name.localeCompare(b.NfsShare.Name)), [mounts, query, health, ascending]);

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
        <Box className="p-4 pt-24 web:px-6 web:pb-8 web:pt-24 web:lg:px-10 web:max-w-screen-2xl web:mx-auto web:w-full">
          <VStack className="gap-2 mb-6">
            <Heading
              size="2xl"
              className="text-typography-900 dark:text-[#E8EBF0] mb-1 web:text-4xl"
              style={{ fontFamily: "Inter_700Bold" }}
            >
              NFS Mounts
            </Heading>
            <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">
              Locate an export, check host health and capacity, and connect your virtual machines.
            </Text>
          </VStack>

          <HStack className="flex-wrap web:flex-wrap gap-x-6 gap-y-2 border-y border-outline-200 dark:border-[#2A3B52] py-4 mb-6">
            <Text className="text-sm text-typography-700 dark:text-[#E8EBF0]">{isLoading ? "—" : mounts.length} exports</Text>
            <Text className="text-sm text-typography-700 dark:text-[#E8EBF0]">{isLoading ? "—" : mounts.filter(m => !m.Status.working).length} unhealthy</Text>
            <Text className="text-sm text-typography-500 dark:text-[#8A94A8]">Refreshes every 5s</Text>
          </HStack>
          <VStack className="gap-4 web:md:flex-row web:md:items-end mb-4">
            <Box className="flex-1 min-w-0">
              <Text className="text-xs uppercase tracking-wide text-typography-600 dark:text-[#8A94A8] mb-2">Search exports</Text>
              <Input className="h-11 rounded-lg border-outline-200 dark:border-[#2A3B52]">
                <InputSlot className="pl-3"><InputIcon as={Search} /></InputSlot>
                <InputField value={query} onChangeText={setQuery} accessibilityLabel="Search NFS exports" placeholder="Search names, hosts, paths…" autoCapitalize="none" autoCorrect={false} />
              </Input>
            </Box>
          <HStack className="gap-3 items-center flex-shrink-0">
            <Button
              variant="outline"
              action="default"
              className="h-11 px-4 rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]"
              accessibilityLabel="Refresh NFS mounts"
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
          </VStack>
          <HStack className="flex-wrap web:flex-wrap items-center gap-2 mb-4">
            {["All", "Healthy", "Unhealthy"].map(value => (
              <Button key={value} variant={health === value ? "solid" : "outline"} action="secondary" onPress={() => setHealth(value)} accessibilityState={{ selected: health === value }} className="h-11 rounded-lg">
                <ButtonText>{value}</ButtonText>
              </Button>
            ))}
            <Button variant="outline" action="secondary" onPress={() => setAscending(value => !value)} className="h-11 rounded-lg"><ButtonText>{ascending ? "Name A–Z" : "Name Z–A"}</ButtonText></Button>
            {query || health !== "All" ? <Button variant="link" onPress={() => { setQuery(""); setHealth("All"); }} className="h-11"><ButtonText>Clear filters</ButtonText></Button> : null}
          </HStack>
          <Text accessibilityLiveRegion="polite" className="text-sm text-typography-500 dark:text-[#8A94A8] mb-3">{isLoading ? "Loading inventory…" : `${visibleMounts.length} of ${mounts.length} exports`}</Text>
          <Box
            className={error || (!isLoading && visibleMounts.length === 0) ? "gap-4" : "gap-4 web:grid web:grid-cols-1 web:md:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4 web:items-stretch"}
          >
            {isLoading && mounts.length === 0 ? (
              <MountSkeletonGrid />
            ) : error ? (
              <Box className="p-3 web:rounded-2xl web:bg-background-0/80">
                <Text className="text-[#EF4444]" style={{ fontFamily: "Inter_400Regular" }}>
                  Error loading mounts: {error}
                </Text>
              </Box>
            ) : visibleMounts.length === 0 ? (
              <Box className="p-3 web:rounded-2xl web:bg-background-0/80">
                <Text className="text-[#9AA4B8] web:text-base" style={{ fontFamily: "Inter_400Regular" }}>
                  {mounts.length === 0 ? "No NFS exports configured. Create NFS to get started." : "No exports match your filters. Clear filters to see all exports."}
                </Text>
              </Box>
            ) : (
              visibleMounts.map((mount) => (
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
