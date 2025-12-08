import {GluestackUIProvider} from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {DarkTheme, DefaultTheme, ThemeProvider} from "@react-navigation/native";
import {useFonts} from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {useEffect} from "react";
import {useColorScheme} from "@/components/useColorScheme";
import {Slot, usePathname, useRouter} from "expo-router";
import {StatusBar, setStatusBarHidden} from "expo-status-bar";
import {AppState, Platform} from "react-native";
import * as SystemUI from "expo-system-ui";
import * as NavigationBar from "expo-navigation-bar";
import {Button, ButtonIcon} from "@/components/ui/button";
import {EditIcon} from "@/components/ui/icon";
import {SafeAreaProvider, SafeAreaView} from "react-native-safe-area-context";
import React from "react";
import {CreateMountDrawer} from "@/components/drawers/CreateMountDrawer";
import {AppSidebar} from "@/components/navigation/AppSidebar";
import {Box} from "@/components/ui/box";
import {Menu} from "lucide-react-native";
import {setApiBaseUrl} from "@/config/apiConfig";
import {
  API_BASE_URL_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  clearApiBaseUrl,
  clearAuthToken,
  loadApiBaseUrl,
  loadAuthToken,
} from "@/services/auth-storage";
import {ApiError, onApiResult, onUnauthorized, setAuthToken} from "@/services/api-client";
import {listMachines} from "@/services/hyperhive";
import {useToast, Toast, ToastTitle, ToastDescription} from "@/components/ui/toast";
import {AppThemeProvider} from "@/hooks/useAppTheme";
import {ThemePreference, loadThemePreference, saveThemePreference} from "@/services/theme-preference";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

SplashScreen.preventAutoHideAsync();

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
      ({visibility}) => {
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
  const isSigningOutRef = React.useRef(false);
  const toast = useToast();

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
      await Promise.all([clearAuthToken(), clearApiBaseUrl()]);
    } catch (storageErr) {
      console.warn("Failed to clear stored session", storageErr);
    } finally {
      setAuthToken(null);
      setApiBaseUrl(null);
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
    const doc = (globalThis as typeof globalThis & {document?: any}).document;
    if (!doc) return;
    doc.documentElement.dataset.theme = resolvedMode;
    doc.documentElement.style.colorScheme =
      resolvedMode === "dark" ? "dark" : "light";
  }, [resolvedMode]);

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
      toast.show({
        placement: "top",
        render: ({id}) => (
          <Toast
            nativeID={"toast-" + id}
            className="px-5 py-3 gap-3 shadow-soft-1"
            action="error"
          >
            <ToastTitle size="sm">Erro na API ({result.status ?? "?"})</ToastTitle>
            <ToastDescription size="sm">
              {result.path?.replace(/^https?:\/\//, "") || "Request"}
            </ToastDescription>
          </Toast>
        ),
      });
    });
    return unsubscribe;
  }, [toast]);

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
        params: {refresh: Date.now().toString()},
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
            style={{flex: 1, backgroundColor: statusBarBackground}}
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
              <Box className="flex-1">
                <Slot />
              </Box>
            </AppThemeProvider>
            {pathname !== "/" && (
                <Button
                size="md"
                variant="solid"
                className="absolute top-4 left-4 w-14 h-14 rounded-full items-center justify-center bg-background-0/95 dark:bg-[#1A2332]/95 shadow-soft-3 backdrop-blur-sm border border-outline-100 dark:border-[#2A3B52] web:top-6 web:left-6 web:hover:bg-background-50 dark:web:hover:bg-[#1F2D42]"
                onPress={() => setShowSidebar(true)}
                >
                <ButtonIcon
                  as={Menu}
                  size="xl"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                />
                </Button>
            )}
            {pathname === "/mounts" && (
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
          </SafeAreaView>
        </ThemeProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
