import {useCallback, useEffect, useRef, useState} from "react";
import {DEFAULT_AUTH_TOKEN} from "@/config/apiConfig";
import {Mount, MountShare} from "@/types/mount";
import {listMounts} from "@/services/hyperhive";

type FetchMode = "initial" | "refresh";

export type UseMountsOptions = {
  token?: string;
};

export function useMounts({token = DEFAULT_AUTH_TOKEN}: UseMountsOptions = {}) {
  const [mounts, setMounts] = useState<Mount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchMounts = useCallback(
    async (mode: FetchMode = "refresh") => {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await listMounts({token});
        if (!isMountedRef.current) return;
        setMounts(response);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Não foi possível carregar os mounts.";
        setError(message);
      } finally {
        if (!isMountedRef.current) return;
        if (mode === "initial") {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchMounts("initial");
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchMounts]);

  const refresh = useCallback(() => fetchMounts("refresh"), [fetchMounts]);

  const removeMount = useCallback((share: Pick<MountShare, "MachineName" | "FolderPath">) => {
    setMounts((prev) =>
      prev.filter(
        ({NfsShare}) =>
          !(
            NfsShare.MachineName === share.MachineName &&
            NfsShare.FolderPath === share.FolderPath
          )
      )
    );
  }, []);

  return {
    mounts,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refetch: fetchMounts,
    removeMount,
  };
}
