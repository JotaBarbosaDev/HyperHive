import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/services/api-client";
import {
  createWireguardPeer,
  createWireguardVpn,
  deleteWireguardPeer,
  listWireguardPeers,
} from "@/services/wireguard";
import {
  CreateWireguardPeerInput,
  WireguardPeer,
  WireguardPeerId,
} from "@/types/wireguard";

type FetchMode = "initial" | "refresh";

export type UseWireguardOptions = {
  token?: string | null;
};

export function useWireguard({ token }: UseWireguardOptions = {}) {
  const [peers, setPeers] = useState<WireguardPeer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vpnReady, setVpnReady] = useState(false);
  const isMountedRef = useRef(true);

  const fetchPeers = useCallback(
    async (mode: FetchMode = "refresh") => {
      if (!token) {
        if (!isMountedRef.current) return;
        if (mode === "initial") {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
        return;
      }

      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await listWireguardPeers();
        if (!isMountedRef.current) return;
        setPeers(response);
        setVpnReady(true);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        if (err instanceof ApiError && err.status === 404) {
          setPeers([]);
          setVpnReady(false);
          setError(null);
        } else {
          const message =
            err instanceof Error ? err.message : "Não foi possível carregar as informações da VPN.";
          setError(message);
        }
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
    fetchPeers("initial");
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPeers]);

  const refresh = useCallback(() => fetchPeers("refresh"), [fetchPeers]);

  const createVpn = useCallback(async () => {
    await createWireguardVpn();
    if (!isMountedRef.current) return;
    setVpnReady(true);
    await fetchPeers("refresh");
  }, [fetchPeers]);

  const addPeer = useCallback(
    async (input: CreateWireguardPeerInput) => {
      const config = await createWireguardPeer(input);
      await fetchPeers("refresh");
      return config;
    },
    [fetchPeers]
  );

  const removePeer = useCallback(
    async (id: WireguardPeerId) => {
      await deleteWireguardPeer(id);
      await fetchPeers("refresh");
    },
    [fetchPeers]
  );

  return {
    peers,
    vpnReady,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refetch: fetchPeers,
    createVpn,
    addPeer,
    removePeer,
  };
}
