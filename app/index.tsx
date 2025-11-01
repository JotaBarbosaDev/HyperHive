import React from "react";
import {Box} from "@/components/ui/box";
import {View, Button, Text} from "react-native";
import {RefreshControl, ScrollView, useColorScheme} from "react-native";
import Mount, {MountType} from "../components/mount";
import {Skeleton, SkeletonText} from "@/components/ui/skeleton";
import {HStack} from "@/components/ui/hstack";


export default function Home() {
  const [mounts, setMounts] = React.useState<MountType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const isMountedRef = React.useRef(true);
  const colorScheme = useColorScheme();
  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";
  const [authToken, setAuthToken] = React.useState<string>(
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJJWm1ObG92RUVieExELytaIiwiaWF0IjoxNzYxOTA4MTAwLCJleHAiOjE3NjE5OTQ1MDB9.xJUEc8CS5dBV4oc0MPHnbAtZPxtxB9p-7DyNQL14GneQ4thrJ4GgUog3H8WCXoejWIczVgVphRbtQEq4vrMSvN3nNxgRCjd_SUlXHbBQHyqHEXZi9Kx2eWNF7b5UQpADYBRFxjhWlk6Zl_aSwPAryI81_V2OhHBsW-mwGcmiXdOgZaNFCiVQ8LGStunppz2xCkWdfrJY5lbD88cEGDWhaozz6-JXib8zFZpwRGpAyKOwgTtQ7CPAwlNgvAQkL3TpRkAd_9JzgG0tBoamSv80nbZGxbMKve1ArEYuQdivaTzGiuU0K5trYKG1G69Qvllhdo3OzHaUl7oB8Db78Zf2ng"
  );

  const loadMounts = React.useCallback(
    async ({showSkeleton = false}: {showSkeleton?: boolean} = {}) => {
      if (showSkeleton) {
        if (isMountedRef.current) setIsLoading(true);
      } else {
        if (isMountedRef.current) setIsRefreshing(true);
      }

      try {
        const response = await fetch("https://hyperhive.maruqes.com/nfs/list", {
          headers: {
            Authorization: authToken,
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const json = (await response.json()) as MountType[];

        if (!isMountedRef.current) return;
        setMounts(json);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Não foi possível carregar os mounts.";
        setError(message);
      } finally {
        if (!isMountedRef.current) return;
        if (showSkeleton) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [authToken]
  );

  React.useEffect(() => {
    isMountedRef.current = true;
    loadMounts({showSkeleton: true});
    return () => {
      isMountedRef.current = false;
    };
  }, [loadMounts]);

  const handleRefresh = React.useCallback(() => {
    loadMounts({showSkeleton: false});
  }, [loadMounts]);

  const handleMountRemoved = React.useCallback((share: MountType["NfsShare"]) => {
    setMounts((prev) =>
      prev.filter(
        (mount) =>
          !(
            mount.NfsShare.MachineName === share.MachineName &&
            mount.NfsShare.FolderPath === share.FolderPath
          )
      )
    );
  }, []);

 

  return (
    <Box className="flex min-h-screen flex-col bg-background-50 p-3 dark:bg-[#070D19] gap-4 web:bg-background-0 web:px-10 web:py-10">
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
              onRefresh={handleRefresh}
              tintColor={refreshControlTint}
              colors={[refreshControlTint]}
              progressBackgroundColor={refreshControlBackground}
            />
          }
        >
          <Box className="flex flex-col gap-5 web:grid web:grid-cols-2 web:md:grid-cols-3 web:lg:grid-cols-4 web:gap-6 web:items-stretch">
            {isLoading ? (
              <>
                <Box className="w-[300px] gap-4 p-3 rounded-md bg-background-100 web:w-[360px]">
                  <Skeleton variant="sharp" className="h-[100px]" />
                  <SkeletonText _lines={3} className="h-2" />
                  <HStack className="gap-1 align-middle">
                    <Skeleton
                      variant="circular"
                      className="h-[24px] w-[28px] mr-2"
                    />
                    <SkeletonText _lines={2} gap={1} className="h-2 w-2/5" />
                  </HStack>
                </Box>
                <Box className="w-[300px] gap-4 p-3 rounded-md bg-background-100 web:w-[360px]">
                  <Skeleton variant="sharp" className="h-[100px]" />
                  <SkeletonText _lines={3} className="h-2" />
                  <HStack className="gap-1 align-middle">
                    <Skeleton
                      variant="circular"
                      className="h-[24px] w-[28px] mr-2"
                    />
                    <SkeletonText _lines={2} gap={1} className="h-2 w-2/5" />
                  </HStack>
                </Box>
                <Box className="w-[300px] gap-4 p-3 rounded-md bg-background-100 web:w-[360px]">
                  <Skeleton variant="sharp" className="h-[100px]" />
                  <SkeletonText _lines={3} className="h-2" />
                  <HStack className="gap-1 align-middle">
                    <Skeleton
                      variant="circular"
                      className="h-[24px] w-[28px] mr-2"
                    />
                    <SkeletonText _lines={2} gap={1} className="h-2 w-2/5" />
                  </HStack>
                </Box>
                <Box className="w-[300px] gap-4 p-3 rounded-md bg-background-100 web:w-[360px]">
                  <Skeleton variant="sharp" className="h-[100px]" />
                  <SkeletonText _lines={3} className="h-2" />
                  <HStack className="gap-1 align-middle">
                    <Skeleton
                      variant="circular"
                      className="h-[24px] w-[28px] mr-2"
                    />
                    <SkeletonText _lines={2} gap={1} className="h-2 w-2/5" />
                  </HStack>
                </Box>
              </>
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
                <Mount
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
