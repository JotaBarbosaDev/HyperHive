import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "@/components/useColorScheme";
import { Slot, usePathname, useRouter } from "expo-router";
import { StatusBar, setStatusBarHidden } from "expo-status-bar";
import { AppState, Platform } from "react-native";
import * as SystemUI from "expo-system-ui";
import * as NavigationBar from "expo-navigation-bar";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { EditIcon } from "@/components/ui/icon";
import GoAccessStreamButtons from "@/components/GoAccessStreamButtons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import React from "react";
import { CreateMountDrawer } from "@/components/drawers/CreateMountDrawer";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Menu } from "lucide-react-native";
import { setApiBaseUrl } from "@/config/apiConfig";
import {
  API_BASE_URL_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  clearApiBaseUrl,
  clearAuthToken,
  loadApiBaseUrl,
  loadAuthToken,
} from "@/services/auth-storage";
import { ApiError, onApiResult, onUnauthorized, setAuthToken } from "@/services/api-client";
import { listMachines } from "@/services/hyperhive";
import { ensureHyperHiveWebsocket } from "@/services/websocket-client";
import { AppThemeProvider } from "@/hooks/useAppTheme";
import { SelectedMachineProvider } from "@/hooks/useSelectedMachine";
import { ThemePreference, loadThemePreference, saveThemePreference } from "@/services/theme-preference";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

SplashScreen.preventAutoHideAsync();

const APP_TITLE = "HyperHive";

const ROUTE_TITLE_MAP: Record<string, string> = {
  "/": "Login",
  "/dashboard": "Dashboard",
  "/btrfs-raids": "BTRFS / RAIDs",
  "/smartdisk": "SmartDisk",
  "/mounts": "NFS",
  "/isos": "ISOs",
  "/vms": "Virtual Machines",
  "/backups": "Backups",
  "/autobackups": "Auto-Backups",
  "/wireguard": "WireGuard VPN",
  "/updates": "Updates",
  "/logs": "Logs",
  "/404": "404",
  "/certificates": "Certificates",
  "/proxy": "Proxy",
  "/redirection": "Redirection",
  "/streams": "Streams",
  "/cards": "Cards",
  "/orders": "Orders",
  "/modal": "Modal",
  "/tabs": "Tabs",
  "/spa": "SPA",
  "/docker/images": "Docker Images",
  "/docker/containers": "Docker Containers",
  "/docker/volumes": "Docker Volumes",
  "/docker/networks": "Docker Networks",
  "/docker/git": "Docker Git",
};

const normalizePathname = (path: string) => {
  if (!path) return "/";
  const withoutQuery = path.split("?")[0] ?? "/";
  if (withoutQuery === "/") return "/";
  const trimmed = withoutQuery.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "/";
};

const resolveWebTitle = (path: string) => {
  const normalized = normalizePathname(path);
  const exactMatch = ROUTE_TITLE_MAP[normalized];
  if (exactMatch) {
    return exactMatch;
  }
  const prefixMatch = Object.entries(ROUTE_TITLE_MAP).find(
    ([route]) => route !== "/" && normalized.startsWith(`${route}/`)
  );
  if (prefixMatch) {
    return prefixMatch[1];
  }
  const fallbackSegment = normalized.split("/").filter(Boolean).pop();
  if (!fallbackSegment) {
    return ROUTE_TITLE_MAP["/"];
  }
  return fallbackSegment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const sanitizeRequestPath = (path?: string) => {
  if (!path) {
    return "Request";
  }
  return path.replace(/^https?:\/\//, "");
};

const getLiteralApiErrorMessage = (errorText?: string, errorPayload?: unknown) => {
  if (typeof errorText === "string" && errorText.trim().length > 0) {
    return errorText;
  }
  if (typeof errorPayload === "string" && errorPayload.trim().length > 0) {
    return errorPayload;
  }
  if (errorPayload instanceof Error && errorPayload.message) {
    return errorPayload.message;
  }
  if (errorPayload && typeof errorPayload === "object") {
    const possibleKeys: Array<"message" | "error" | "detail" | "description"> = [
      "message",
      "error",
      "detail",
      "description",
    ];
    for (const key of possibleKeys) {
      const value = (errorPayload as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
    try {
      return JSON.stringify(errorPayload, null, 2);
    } catch {
      // no-op
    }
  }
  if (typeof errorPayload === "number" || typeof errorPayload === "boolean") {
    return String(errorPayload);
  }
  return "An error occurred while communicating with the API. Check the logs for more details.";
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const hideSystemUi = async () => {
      try {
        await NavigationBar.setPositionAsync("absolute");
        await NavigationBar.setBehaviorAsync("overlay-swipe");
        await NavigationBar.setVisibilityAsync("hidden");
        setStatusBarHidden(true, "fade");
      } catch (navError) {
        console.warn("Failed to configure Android system UI", navError);
      }
    };

    hideSystemUi();

    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        hideSystemUi();
      }
    });

    const visibilitySubscription = NavigationBar.addVisibilityListener(
      ({ visibility }) => {
        if (visibility !== "hidden") {
          hideSystemUi();
        }
      }
    );

    return () => {
      subscription?.remove();
      visibilitySubscription.remove();
    };
  }, []);

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const pathname = usePathname();
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = React.useState<ThemePreference>("system");
  const resolvedMode = React.useMemo(
    () => (themePreference === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : themePreference),
    [systemColorScheme, themePreference]
  );
  const statusBarStyle = resolvedMode === "dark" ? "light" : "dark";
  const statusBarBackground = resolvedMode === "dark" ? "#070D19" : "#F8FAFC";
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [apiErrorModal, setApiErrorModal] = React.useState<
    { status?: number; path?: string; details: string } | null
  >(null);
  const isSigningOutRef = React.useRef(false);
  const isWeb = Platform.OS === "web";

  const handleCloseApiErrorModal = React.useCallback(() => {
    setApiErrorModal(null);
  }, []);

  React.useEffect(() => {
    loadThemePreference().then((pref) => {
      if (pref) {
        setThemePreference(pref);
      }
    });
  }, []);

  const signOut = React.useCallback(async () => {
    if (isSigningOutRef.current) {
      return;
    }
    isSigningOutRef.current = true;
    try {
      await Promise.all([clearAuthToken()]);
    } catch (storageErr) {
      console.warn("Failed to clear stored session", storageErr);
    } finally {
      setAuthToken(null);
      setShowDrawer(false);
      setShowSidebar(false);
      if (pathname !== "/") {
        router.replace("/");
      }
      isSigningOutRef.current = false;
    }
  }, [pathname, router]);
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    const applyStatusBarBackground = async () => {
      try {
        await SystemUI.setBackgroundColorAsync(statusBarBackground);
      } catch (systemErr) {
        console.warn("Failed to set system UI background color", systemErr);
      }
    };
    applyStatusBarBackground();
  }, [statusBarBackground]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc = (globalThis as typeof globalThis & { document?: any }).document;
    if (!doc) return;
    doc.documentElement.dataset.theme = resolvedMode;
    doc.documentElement.style.colorScheme =
      resolvedMode === "dark" ? "dark" : "light";
  }, [resolvedMode]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc = (globalThis as typeof globalThis & { document?: { title: string } }).document;
    if (!doc) return;
    const pageTitle = resolveWebTitle(pathname ?? "/");
    doc.title = `${pageTitle} | ${APP_TITLE}`;
  }, [pathname]);

  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      const [storedToken, storedBaseUrl] = await Promise.all([
        loadAuthToken(),
        loadApiBaseUrl(),
      ]);
      if (!isMounted) {
        return;
      }
      setApiBaseUrl(storedBaseUrl ?? null);
      if (storedToken) {
        setAuthToken(storedToken);
      }
    };
    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      signOut();
    });
    return unsubscribe;
  }, [signOut]);

  useEffect(() => {
    const unsubscribe = onApiResult((result) => {
      if (result.ok) {
        console.info("[API OK]", result.method, result.path, result.status);
        return;
      }
      console.error("[API ERROR]", result.method, result.path, result.status, result.error);
      if(result.status === 401){
        console.warn("Unauthorized!");
        return;
      }else{
        setApiErrorModal({
        status: result.status,
        path: result.path,
        details: getLiteralApiErrorMessage(result.errorText, result.error),
      });
      }
      
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function" ||
      typeof window.removeEventListener !== "function"
    ) {
      return;
    }

    const handleStorage = async (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === AUTH_TOKEN_STORAGE_KEY ||
        event.key === API_BASE_URL_STORAGE_KEY
      ) {
        const [storedToken, storedBaseUrl] = await Promise.all([
          loadAuthToken(),
          loadApiBaseUrl(),
        ]);
        setApiBaseUrl(storedBaseUrl ?? null);
        if (!storedToken) {
          await signOut();
          return;
        }
        setAuthToken(storedToken);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [signOut]);

  useEffect(() => {
    let isActive = true;
    const enforceAuth = async () => {
      const storedBaseUrl = await loadApiBaseUrl();
      setApiBaseUrl(storedBaseUrl ?? null);
      const storedToken = await loadAuthToken();
      setAuthToken(storedToken ?? null);

      if (!storedToken) {
        if (pathname !== "/") {
          await signOut();
        }
        return;
      }

      try {
        await listMachines();
        if (!isActive) return;
        if (storedBaseUrl && storedToken) {
          try {
            await ensureHyperHiveWebsocket({ token: storedToken, baseUrl: storedBaseUrl });
          } catch (socketErr) {
            console.warn("Failed to initialize HyperHive WebSocket", socketErr);
          }
        }
        if (pathname === "/") {
          router.replace("/mounts");
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await signOut();
        }
      }
    };
    enforceAuth();
    return () => {
      isActive = false;
    };
  }, [pathname, router, signOut]);

  const handleOpenDrawer = React.useCallback(() => {
    setShowDrawer(true);
  }, []);

  const handleCloseDrawer = React.useCallback(() => {
    setShowDrawer(false);
  }, []);

  const handleMountCreated = React.useCallback(() => {
    setShowDrawer(false);
    requestAnimationFrame(() => {
      router.replace({
        pathname: pathname as any,
        params: { refresh: Date.now().toString() },
      });
    });
  }, [pathname, router]);

  useEffect(() => {
    if (pathname !== "/mounts" && showDrawer) {
      setShowDrawer(false);
    }
    if (pathname === "/" && showSidebar) {
      setShowSidebar(false);
    }
  }, [pathname, showDrawer, showSidebar]);

  return (
    <SafeAreaProvider>
      <GluestackUIProvider mode={resolvedMode}>
        <ThemeProvider value={resolvedMode === "dark" ? DarkTheme : DefaultTheme}>
          <SafeAreaView
            style={{ flex: 1, backgroundColor: statusBarBackground }}
            edges={["top", "right", "bottom", "left"]}
          >
            <StatusBar
              style={statusBarStyle}
              backgroundColor={statusBarBackground}
              animated
              hidden={Platform.OS === "android"}
            />
            <AppThemeProvider
              preference={themePreference}
              resolvedMode={resolvedMode}
              setPreference={(pref) => {
                setThemePreference(pref);
                saveThemePreference(pref).catch((err) =>
                  console.warn("Failed to persist theme preference", err)
                );
              }}
            >
              <SelectedMachineProvider>
                <Box className="flex-1">
                  {pathname !== "/" && (
                    <Box
                      className="absolute top-3 left-3 web:top-5 web:left-5 z-20"
                      pointerEvents="box-none"
                    >
                      <Button
                        size="md"
                        variant="outline"
                        action="secondary"
                        className="gap-2 rounded-xl px-4 h-11 border-outline-100 dark:border-[#2A3B52] bg-background-0/95 dark:bg-[#1A2332]/95 shadow-soft-1 web:hover:bg-background-50 dark:web:hover:bg-[#1F2D42]"
                        onPress={() => setShowSidebar(true)}
                        pointerEvents="auto"
                      >
                        <ButtonIcon
                          as={Menu}
                          size="md"
                          className="text-typography-900 dark:text-[#E8EBF0]"
                        />
                        <ButtonText className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                          Menu
                        </ButtonText>
                      </Button>
                    </Box>
                  )}
                  <GoAccessStreamButtons />
                  <Box className="flex-1 pt-2 web:pt-3">
                    <Slot />
                  </Box>
                </Box>
              </SelectedMachineProvider>
            </AppThemeProvider>
            {pathname === "/mounts" && !isWeb && (
              <Button
                size="lg"
                className="absolute bottom-6 right-6 rounded-full p-4 shadow-hard-3 web:bottom-10 web:right-10 web:p-5 web:shadow-soft-4 hover:web:scale-105 active:scale-95 transition-transform dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4] dark:shadow-[0_8px_24px_rgba(45,212,191,0.25)]"
                onPress={handleOpenDrawer}
                action="primary"
              >
                <ButtonIcon
                  as={EditIcon}
                  className="dark:text-[#0D1420]"
                  size="lg"
                />
              </Button>
            )}
            {pathname === "/mounts" && isWeb && (
              <Box
                className="hidden web:flex absolute top-6 right-6 z-20 web:top-10 web:right-10"
                pointerEvents="box-none"
              >
                <Button
                  size="md"
                  action="primary"
                  className="h-11 rounded-xl px-4 gap-2 shadow-soft-3"
                  onPress={handleOpenDrawer}
                >
                  <ButtonIcon as={EditIcon} size="sm" className="dark:text-[#0D1420]" />
                  <ButtonText className="text-sm font-semibold">Create new NFS</ButtonText>
                </Button>
              </Box>
            )}
            {pathname !== "/" && (
              <AppSidebar
                isOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
                themePreference={themePreference}
                onChangeThemePreference={(pref) => {
                  setThemePreference(pref);
                  saveThemePreference(pref).catch((err) =>
                    console.warn("Failed to persist theme preference", err)
                  );
                }}
              />
            )}
            {pathname === "/mounts" && (
              <CreateMountDrawer
                isOpen={showDrawer}
                onClose={handleCloseDrawer}
                onSuccess={handleMountCreated}
              />
            )}
            <Modal isOpen={Boolean(apiErrorModal)} onClose={handleCloseApiErrorModal} size="md">
              <ModalBackdrop />
              <ModalContent>
                <ModalHeader>
                  <Box className="flex-1 pr-4">
                    <Text className="text-lg font-semibold text-typography-900 dark:text-[#E2E8F0]">
                      {apiErrorModal?.status
                        ? `Error on API (${apiErrorModal.status})`
                        : "Error on API"}
                    </Text>
                    {apiErrorModal?.path ? (
                      <Text
                        className="text-xs text-typography-500 dark:text-[#94A3B8]"
                        numberOfLines={2}
                      >
                        {sanitizeRequestPath(apiErrorModal.path)}
                      </Text>
                    ) : null}
                  </Box>
                  <ModalCloseButton onPress={handleCloseApiErrorModal} />
                </ModalHeader>
                <ModalBody>
                  <Box className="bg-background-100 dark:bg-[#111827] rounded-md p-3">
                    <Text className="font-mono text-sm text-typography-900 dark:text-[#E2E8F0]">
                      {apiErrorModal?.details || "Erro desconhecido."}
                    </Text>
                  </Box>
                </ModalBody>
                <ModalFooter>
                  <Button onPress={handleCloseApiErrorModal} size="sm">
                    <ButtonText>Close</ButtonText>
                  </Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </SafeAreaView>
        </ThemeProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
