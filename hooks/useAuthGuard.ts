import {useEffect, useMemo, useState} from "react";
import {usePathname, useRouter} from "expo-router";
import {setApiBaseUrl} from "@/config/apiConfig";
import {ApiError, setAuthToken} from "@/services/api-client";
import {
  API_BASE_URL_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  clearApiBaseUrl,
  clearAuthToken,
  loadApiBaseUrl,
  loadAuthToken,
} from "@/services/auth-storage";
import {listMachines} from "@/services/hyperhive";

export type UseAuthGuardResult = {
  token: string | null;
  isChecking: boolean;
};

export type UseAuthGuardOptions = {
  validate?: boolean;
};

export function useAuthGuard(
  redirectTo: string = "/",
  {validate = true}: UseAuthGuardOptions = {}
): UseAuthGuardResult {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<UseAuthGuardResult>({
    token: null,
    isChecking: true,
  });

  useEffect(() => {
    let isActive = true;

    const redirectIfNeeded = () => {
      if (pathname !== redirectTo) {
        router.replace(redirectTo as any);
      }
    };

    const signOutAndRedirect = async () => {
      try {
        await Promise.all([clearAuthToken(), clearApiBaseUrl()]);
      } catch (err) {
        console.warn("Failed to clear stored session credentials", err);
      } finally {
        setAuthToken(null);
        setApiBaseUrl(null);
        if (isActive) {
          setState({token: null, isChecking: false});
          redirectIfNeeded();
        }
      }
    };

    const resolveSession = async () => {
      const storedBaseUrl = await loadApiBaseUrl();
      setApiBaseUrl(storedBaseUrl ?? null);
      const storedToken = await loadAuthToken();
      setAuthToken(storedToken ?? null);

      if (!storedToken) {
        if (isActive) {
          setState({token: null, isChecking: false});
          redirectIfNeeded();
        }
        return;
      }

      if (validate) {
        try {
          await listMachines();
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            await signOutAndRedirect();
            return;
          }
          console.warn("Token validation failed", err);
        }
      }

      if (isActive) {
        setState({token: storedToken, isChecking: false});
      }
    };

    resolveSession();

    let storageHandler: ((event: StorageEvent) => void) | undefined;
    const canListenToStorageEvents =
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function" &&
      typeof window.removeEventListener === "function";

    if (canListenToStorageEvents) {
      storageHandler = (event: StorageEvent) => {
        if (
          !event.key ||
          event.key === AUTH_TOKEN_STORAGE_KEY ||
          event.key === API_BASE_URL_STORAGE_KEY
        ) {
          resolveSession();
        }
      };
      window.addEventListener("storage", storageHandler);
    }

    return () => {
      isActive = false;
      if (storageHandler && canListenToStorageEvents) {
        window.removeEventListener("storage", storageHandler);
      }
    };
  }, [pathname, redirectTo, router, validate]);

  return useMemo(
    () => ({
      token: state.token,
      isChecking: state.isChecking,
    }),
    [state.isChecking, state.token]
  );
}
