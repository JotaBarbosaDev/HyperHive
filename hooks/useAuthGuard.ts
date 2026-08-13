import {useEffect, useMemo, useState} from "react";
import {usePathname, useRouter} from "expo-router";
import {setApiBaseUrl} from "@/config/apiConfig";
import {getAuthToken, setAuthToken} from "@/services/api-client";
import {
  API_BASE_URL_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  loadApiBaseUrl,
  loadAuthToken,
} from "@/services/auth-storage";

export type UseAuthGuardResult = {
  token: string | null;
  isChecking: boolean;
};

export type UseAuthGuardOptions = {
  validate?: boolean;
};

export function useAuthGuard(
  redirectTo: string = "/",
  _options: UseAuthGuardOptions = {}
): UseAuthGuardResult {
  const router = useRouter();
  const pathname = usePathname();
  const currentToken = getAuthToken();
  const [state, setState] = useState<UseAuthGuardResult>({
    // Keep an already hydrated session visible when a route mounts. The root
    // layout owns API validation, so page transitions never blank the screen.
    token: currentToken,
    isChecking: !currentToken,
  });

  useEffect(() => {
    let isActive = true;

    const redirectIfNeeded = () => {
      if (pathname !== redirectTo) {
        router.replace(redirectTo as any);
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
  }, [pathname, redirectTo, router]);

  return useMemo(
    () => ({
      token: state.token,
      isChecking: state.isChecking,
    }),
    [state.isChecking, state.token]
  );
}
