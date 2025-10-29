import React from "react";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {ScrollView} from "react-native";
import Mount, {MountType} from "../components/mount";
import {Skeleton, SkeletonText} from "@/components/ui/skeleton";
import {HStack} from "@/components/ui/hstack";

export default function Home() {
  const [mounts, setMounts] = React.useState<MountType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  

  React.useEffect(() => {
    let isActive = true;

    const loadMounts = async () => {
      try {
        if (isActive) {
          setIsLoading(true);
        }

        const response = await fetch("https://hyperhive.maruqes.com/nfs/list", {
          headers: {
            Authorization:
              "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJVNWpLYm0xMHZhdEMxaFduIiwiaWF0IjoxNzYxNzMyNjk4LCJleHAiOjE3NjE4MTkwOTh9.bvAmlfqYkd8gbZevHPexzDl7LIpDbZocjWGxsiFAknkumclFaf6oK05KThbQEJ-olOg0M-5LSMl4207633dFs6iZ4bSStCuaX8ZfaR1FeG95ajcqBNDiUIaEoq904YaZt5DOTDyPjXdNkssTzvhOVFqlJLulvXU5-iZgcIF5LGGfOYusUbKFNHv-wtCV80B70oUUUaPdhwX822ISyxs5TOdotVSk6CzOByAjaWZlpkU1ULmfK5syOBqNZMmgn-vUxGSfob7nccwFzjTqZuIeDdudYpgc0DidgUpRT9tWXuDCccD17kiu4dbAzCg9MpMADNK9F9CEpBEK4hz-qk0WHA"
          }
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const json = (await response.json()) as MountType[];

        if (isActive) {
          setMounts(json);
          setError(null);
        }
      } catch (err) {
        if (isActive) {
          const message =
            err instanceof Error ? err.message : "Não foi possível carregar os mounts.";
          setError(message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadMounts();

    return () => {
      isActive = false;
    };
  }, []);

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
    <Box className="flex min-h-screen flex-col bg-background-50 p-3 dark:bg-[#070D19]">
      <Box className="flex">
        <Text
          className="text-2xl text-typography-900 dark:text-typography-900"
          style={{fontFamily: "Inter_700Bold"}}
        >
          Mounts
        </Text>
      </Box>
      <Box className="mt-6 grid flex-1 min-h-0 grid-cols-1 gap-5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 64}}
        >
          {isLoading ? (
            <>
            <Box className="w-[300px] gap-4 p-3 rounded-md bg-background-100">
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
            <Box className="w-[300px] gap-4 p-3 rounded-md bg-background-100">
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
            <Box className="p-3">
              <Text
                className="text-[#EF4444]"
                style={{fontFamily: "Inter_400Regular"}}
              >
                Erro ao carregar mounts: {error}
              </Text>
            </Box>
          ) : mounts.length === 0 ? (
            <Box className="p-3">
              <Text
                className="color-[#9AA4B8]"
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
        </ScrollView>
      </Box>
    </Box>
  );
}
