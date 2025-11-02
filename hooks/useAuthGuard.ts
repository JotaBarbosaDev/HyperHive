import {useEffect, useMemo, useState} from "react";
import {usePathname, useRouter} from "expo-router";
import {ApiError, setAuthToken} from "@/services/api-client";
import {AUTH_TOKEN_STORAGE_KEY, clearAuthToken, loadAuthToken} from "@/services/auth-storage";
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
        await clearAuthToken();
      } catch (err) {
        console.warn("Failed to clear stored auth token", err);
      } finally {
        setAuthToken(null);
        if (isActive) {
          setState({token: null, isChecking: false});
          redirectIfNeeded();
        }
      }
    };

    const resolveSession = async () => {
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
    if (typeof window !== "undefined") {
      storageHandler = (event: StorageEvent) => {
        if (!event.key || event.key === AUTH_TOKEN_STORAGE_KEY) {
          resolveSession();
        }
      };
      window.addEventListener("storage", storageHandler);
    }

    return () => {
      isActive = false;
      if (storageHandler && typeof window !== "undefined") {
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
