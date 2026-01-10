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
import { AppState, Platform, ScrollView, useWindowDimensions } from "react-native";
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
import { Image } from "@/components/ui/image";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Menu } from "lucide-react-native";
import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
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
import { VmProgressToastListener } from "@/components/VmProgressToastListener";
import { NewSlaveCountToastListener } from "@/components/NewSlaveCountToastListener";
import { SocketErrorModalListener } from "@/components/SocketErrorModalListener";
import { SocketNotificationModalListener } from "@/components/SocketNotificationModalListener";
import Snowfall from "react-snowfall";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

SplashScreen.preventAutoHideAsync();

const APP_TITLE = "HyperHive";
const APP_CORNER_ICON = require("../assets/images/android-chrome-192x192.png");

const ROUTE_TITLE_MAP: Record<string, string> = {
  "/": "Login",
  "/dashboard": "Dashboard",
  "/btrfs-raids": "BTRFS / RAIDs",
  "/btrfs-automatic-mounts": "BTRFS Auto-Mounts",
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

const TUTORIAL_STEPS = [
  {
    title: "Step 1 - Open Proxy Hosts in NPM",
    description: "Go to your NPM dashboard and open the Proxy Hosts page.",
    image: require("../assets/tutorial/step1.png"),
  },
  {
    title: "Step 2 - Create or edit the host",
    description: "Add your domain, set the target, and configure SSL if needed.",
    image: require("../assets/tutorial/step2.png"),
  },
  {
    title: "Step 3 - Confirm the front-end setup",
    description: "Back in HyperHive, click Setup FrontEnd Page and confirm.",
    image: require("../assets/tutorial/step3.png"),
  },
];

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

const isSnowSeason = (now = new Date()) => {
  const month = now.getMonth(); // 0 = Jan, 11 = Dec (local server timezone)
  const day = now.getDate();
  if (month === 11) {
    return day >= 1;
  }
  if (month === 0) {
    return day <= 10;
  }
  return false;
};

const sanitizeRequestPath = (path?: string) => {
  if (!path) {
    return "Request";
  }
  return path.replace(/^https?:\/\//, "");
};

const normalizeUrlForCompare = (value?: string | null) => {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.search = "";
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const normalizedPath = pathname === "/" ? "" : pathname;
    return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  } catch {
    return null;
  }
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

    const showSystemUi = async () => {
      try {
        await NavigationBar.setPositionAsync("relative");
        await NavigationBar.setBehaviorAsync("inset-swipe");
        await NavigationBar.setVisibilityAsync("visible");
        setStatusBarHidden(true, "fade");
      } catch (navError) {
        console.warn("Failed to configure Android system UI", navError);
      }
    };

    showSystemUi();

    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        showSystemUi();
      }
    });

    const visibilitySubscription = NavigationBar.addVisibilityListener(
      ({ visibility }) => {
        if (visibility !== "visible") {
          showSystemUi();
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
  const [apiBaseUrlState, setApiBaseUrlState] = React.useState<string | null>(
    () => getApiBaseUrl() ?? null
  );
  const [themePreference, setThemePreference] = React.useState<ThemePreference>("system");
  const resolvedMode = React.useMemo(
    () => (themePreference === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : themePreference),
    [systemColorScheme, themePreference]
  );
  const statusBarStyle = resolvedMode === "dark" ? "light" : "dark";
  const statusBarBackground = resolvedMode === "dark" ? "#070D19" : "#F8FAFC";
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [tutorialModalOpen, setTutorialModalOpen] = React.useState(false);
  const [apiErrorModal, setApiErrorModal] = React.useState<
    { status?: number; path?: string; details: string } | null
  >(null);
  const shouldShowSnow = React.useMemo(() => isSnowSeason(), []);
  const isSigningOutRef = React.useRef(false);
  const isWeb = Platform.OS === "web";
  const { height: screenHeight } = useWindowDimensions();
  const tutorialBodyMaxHeight = Math.min(screenHeight * 0.6, 520);

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
      const normalizedBaseUrl = setApiBaseUrl(storedBaseUrl ?? null);
      setApiBaseUrlState(normalizedBaseUrl ?? null);
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
      if (result.status === 401) {
        console.warn("Unauthorized!");
        return;
      } else {
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
        const normalizedBaseUrl = setApiBaseUrl(storedBaseUrl ?? null);
        setApiBaseUrlState(normalizedBaseUrl ?? null);
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
      const normalizedBaseUrl = setApiBaseUrl(storedBaseUrl ?? null);
      setApiBaseUrlState(normalizedBaseUrl ?? null);
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
          router.replace("/dashboard");
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

  const apiBaseMismatch = React.useMemo(() => {
    if (!isWeb) {
      return false;
    }
    const currentOrigin =
      typeof window !== "undefined" ? window.location?.origin : null;
    if (!currentOrigin) {
      return false;
    }
    const expectedApiBase = normalizeUrlForCompare(`${currentOrigin.replace(/\/+$/, "")}/api`);
    const configuredApiBase = normalizeUrlForCompare(apiBaseUrlState ?? getApiBaseUrl());
    if (!expectedApiBase || !configuredApiBase) {
      return false;
    }
    return expectedApiBase !== configuredApiBase;
  }, [apiBaseUrlState, isWeb]);

  return (
    <SafeAreaProvider>
      <GluestackUIProvider mode={resolvedMode}>
        <ThemeProvider
          value={resolvedMode === "dark" ? DarkTheme : DefaultTheme}
        >
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
                <VmProgressToastListener />
                <NewSlaveCountToastListener />
                <SocketErrorModalListener />
                <SocketNotificationModalListener />
                <Box className="flex-1">
                  {apiBaseMismatch && (
                    <Box
                      className="absolute top-0 left-0 right-0 z-10 bg-warning-100 border-b border-warning-300 px-4 py-2"
                      pointerEvents="box-none"
                    >
                      <HStack className="items-center gap-2 flex-wrap justify-center" pointerEvents="box-none">
                        <Text className="text-warning-800 text-xs web:text-sm" pointerEvents="none">
                          To unlock all features, go to the Proxy Hosts page in NPM and click the
                          "Setup FrontEnd Page" button.
                        </Text>
                        <Button
                          size="sm"
                          variant="outline"
                          action="secondary"
                          className="h-7 rounded-full px-3 border-warning-400"
                          onPress={() => setTutorialModalOpen(true)}
                        >
                          <ButtonText className="text-warning-800 text-xs">
                            View tutorial
                          </ButtonText>
                        </Button>
                      </HStack>
                    </Box>
                  )}
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
                  {pathname !== "/" && (
                    <Box
                      className="absolute top-3 right-3 web:top-5 web:right-5 z-20"
                      pointerEvents="none"
                    >
                      <Box className="h-9 w-9 web:h-10 web:w-10 items-center justify-center rounded-xl bg-[#0E1524]/95 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1">
                        <Image
                          source={APP_CORNER_ICON}
                          alt="HyperHive"
                          resizeMode="contain"
                          size="none"
                          className="h-5 w-5 web:h-6 web:w-6"
                        />
                      </Box>
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
            <Modal
              isOpen={Boolean(apiErrorModal)}
              onClose={handleCloseApiErrorModal}
              size="md"
            >
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
                      {apiErrorModal?.details || "Unknown error."}
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
            <Modal
              isOpen={tutorialModalOpen}
              onClose={() => setTutorialModalOpen(false)}
              size="lg"
            >
              <ModalBackdrop className="bg-black/60" />
              <ModalContent className="max-w-3xl w-full rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
                <ModalHeader className="flex-row items-start justify-between px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
                  <VStack className="flex-1">
                    <Text className="text-lg font-semibold text-typography-900 dark:text-[#E2E8F0]">
                      Front-End Setup Tutorial
                    </Text>
                    <Text className="text-typography-600 dark:text-typography-400 mt-1">
                      Follow these steps to configure your front-end in NPM.
                    </Text>
                  </VStack>
                  <ModalCloseButton className="text-typography-500" />
                </ModalHeader>
                <ModalBody className="px-6 pt-4 pb-2">
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={{ maxHeight: tutorialBodyMaxHeight }}
                  >
                    <VStack className="gap-6 pb-2">
                      {TUTORIAL_STEPS.map((step) => (
                        <VStack key={step.title} className="gap-3">
                          <VStack className="gap-1">
                            <Text className="text-sm font-semibold text-typography-900 dark:text-[#E8EBF0]">
                              {step.title}
                            </Text>
                            <Text className="text-sm text-typography-600 dark:text-typography-400">
                              {step.description}
                            </Text>
                          </VStack>
                          <Box className="rounded-xl border border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] overflow-hidden">
                            <Image
                              source={step.image}
                              alt={step.title}
                              resizeMode="contain"
                              size="none"
                              className="w-full h-48"
                            />
                          </Box>
                        </VStack>
                      ))}
                    </VStack>
                  </ScrollView>
                </ModalBody>
                <ModalFooter className="px-6 pb-6 pt-2 border-t border-outline-100 dark:border-[#2A3B52]">
                  <HStack className="gap-3 justify-end w-full">
                    <Button
                      variant="outline"
                      action="default"
                      onPress={() => setTutorialModalOpen(false)}
                    >
                      <ButtonText className="text-typography-900 dark:text-[#E8EBF0]">
                        Close
                      </ButtonText>
                    </Button>
                  </HStack>
                </ModalFooter>
              </ModalContent>
            </Modal>
            {Platform.OS === "web" && shouldShowSnow && (
              <Snowfall
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  zIndex: 2147483647,
                  pointerEvents: "none",
                }}
                snowflakeCount={30}
                speed={[0.5, 2.0]}
                wind={[-0.5, 2.0]}
                radius={[0.5, 3.0]}
              />
            )}
          </SafeAreaView>
        </ThemeProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
