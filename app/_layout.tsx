import {GluestackUIProvider} from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold} from "@expo-google-fonts/inter";
import {DarkTheme, DefaultTheme, ThemeProvider} from "@react-navigation/native";
import {useFonts} from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {useEffect, useState} from "react";
import {useColorScheme} from "@/components/useColorScheme";
import {Slot, usePathname} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {Fab, FabIcon} from "@/components/ui/fab";
import {MoonIcon, SunIcon} from "@/components/ui/icon";
import {SafeAreaProvider, SafeAreaView} from "react-native-safe-area-context";

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

  const [styleLoaded, setStyleLoaded] = useState(false);
  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const pathname = usePathname();
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");

  return (
    <SafeAreaProvider>
      <GluestackUIProvider mode={colorMode}>
        <ThemeProvider value={colorMode === "dark" ? DarkTheme : DefaultTheme}>
          <SafeAreaView style={{flex: 1}} edges={["top", "right", "bottom", "left"]}>
            <Slot />
            {pathname === "/" && (
              <Fab
                onPress={() =>
                  setColorMode(colorMode === "dark" ? "light" : "dark")
                }
                className="m-6"
                size="lg"
              >
                <FabIcon as={colorMode === "dark" ? MoonIcon : SunIcon} />
              </Fab>
            )}
          </SafeAreaView>
        </ThemeProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
