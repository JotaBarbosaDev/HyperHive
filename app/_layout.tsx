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
import {useEffect, useState} from "react";
import {useColorScheme} from "@/components/useColorScheme";
import {Slot, usePathname, useRouter} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {Alert, AppState, Platform} from "react-native";
import * as SystemUI from "expo-system-ui";
import * as NavigationBar from "expo-navigation-bar";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@/components/ui/button";
import {EditIcon} from "@/components/ui/icon";
import {SafeAreaProvider, SafeAreaView} from "react-native-safe-area-context";
import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "@/components/ui/drawer";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import {Heading} from "@/components/ui/heading";
import {Icon, CloseIcon} from "@/components/ui/icon";
import React from "react";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectItem,
} from "@/components/ui/select";
import {ChevronDownIcon} from "@/components/ui/icon";
import {
  FormControl,
  FormControlLabel,
  FormControlError,
  FormControlErrorText,
  FormControlErrorIcon,
  FormControlLabelText,
} from "@/components/ui/form-control";
import {AlertCircleIcon} from "@/components/ui/icon";
import {Input, InputField} from "@/components/ui/input";
import {VStack} from "@/components/ui/vstack";
import {
  Checkbox,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxIcon,
} from "@/components/ui/checkbox";
import {CheckIcon} from "@/components/ui/icon";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipText,
} from "@/components/ui/tooltip";
import {InfoIcon} from "@/components/ui/icon";

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

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const hideNavigationBar = async () => {
      try {
        await NavigationBar.setPositionAsync("absolute");
        await NavigationBar.setBehaviorAsync("overlay-swipe");
        await NavigationBar.setVisibilityAsync("hidden");
      } catch (navError) {
        console.warn("Failed to configure Android navigation bar", navError);
      }
    };

    hideNavigationBar();

    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        hideNavigationBar();
      }
    });

    const visibilitySubscription = NavigationBar.addVisibilityListener(
      ({visibility}) => {
        if (visibility !== "hidden") {
          hideNavigationBar();
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
  const systemColorScheme = useColorScheme();
  const colorMode = systemColorScheme === "dark" ? "dark" : "light";
  const statusBarStyle = colorMode === "dark" ? "light" : "dark";
  const statusBarBackground = colorMode === "dark" ? "#070D19" : "#F8FAFC";
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [machineFinal, setMachineFinal] = React.useState("");
  const [pathFinal, setPathFinal] = React.useState("/");
  const [dirResult, setDirResult] = React.useState<{
    files?: string[];
    directories?: string[];
    [key: string]: unknown;
  } | null>(null);
  const [dirError, setDirError] = React.useState<string | null>(null);
  const [isFetchingDir, setIsFetchingDir] = React.useState(false);
  const [isDirModalOpen, setIsDirModalOpen] = React.useState(false);
  const [selectedDirectory, setSelectedDirectory] = React.useState<
    string | null
  >(null);
  const [mountName, setMountName] = React.useState("");
  const [hostNormalMount, setHostNormalMount] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [machines, setMachines] = React.useState<any[]>([]);
  
  const [authToken, setAuthToken] = React.useState<string>(
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJJWm1ObG92RUVieExELytaIiwiaWF0IjoxNzYxOTA4MTAwLCJleHAiOjE3NjE5OTQ1MDB9.xJUEc8CS5dBV4oc0MPHnbAtZPxtxB9p-7DyNQL14GneQ4thrJ4GgUog3H8WCXoejWIczVgVphRbtQEq4vrMSvN3nNxgRCjd_SUlXHbBQHyqHEXZi9Kx2eWNF7b5UQpADYBRFxjhWlk6Zl_aSwPAryI81_V2OhHBsW-mwGcmiXdOgZaNFCiVQ8LGStunppz2xCkWdfrJY5lbD88cEGDWhaozz6-JXib8zFZpwRGpAyKOwgTtQ7CPAwlNgvAQkL3TpRkAd_9JzgG0tBoamSv80nbZGxbMKve1ArEYuQdivaTzGiuU0K5trYKG1G69Qvllhdo3OzHaUl7oB8Db78Zf2ng"
  );
  const router = useRouter();
  const hostInfoDescription =
    "This setting allows only the machine sharing the NFS to access storage directly, maximizing the performance of fast SSDs and M.2 drives. However, if using slower HDDs, it's recommended to disable this setting, as the NFS cache (even on the host) is faster than direct access to the HDD. Enabling this also prevents live migration of VMs and may cause rare issues.";

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc = (globalThis as typeof globalThis & {document?: any}).document;
    if (!doc) return;
    doc.documentElement.dataset.theme = colorMode;
    doc.documentElement.style.colorScheme = colorMode === "dark" ? "dark" : "light";
  }, [colorMode]);

  
  const handleHostInfoPress = React.useCallback(() => {
    if (Platform.OS === "web") {
      return;
    }
    Alert.alert("Host Normal Mount", hostInfoDescription);
  }, [hostInfoDescription]);
  const computeNextPath = React.useCallback(
    (current: string, selection: string) => {
      if (!selection) return current;
      if (selection.startsWith("/")) {
        return selection.replace(/\/{2,}/g, "/") || "/";
      }
      const sanitized = selection.replace(/^\/+|\/+$/g, "");
      if (!sanitized) return current;
      const base = current === "/" ? "" : current.replace(/\/+$/g, "");
      return `${base}/${sanitized}`.replace(/\/{2,}/g, "/");
    },
    []
  );

  const machineList = React.useCallback(async () => {
    try {
      const machines = await fetch(
        "https://hyperhive.maruqes.com/protocol/list",
        {
          headers: {
            method: "GET",
            Authorization:
              authToken,
          },
        }
      );
      const data = await machines.json();
      setMachines(data);
      return data;
    } catch (error) {
      console.error("Error fetching machine list:", error);
      return null;
    }
  }, []);
  

  console.log(machines);

  const dirFolder = React.useCallback(
    async (customPath?: string) => {
      const trimmedMachine = machineFinal.trim();
      const basePath = customPath !== undefined ? customPath : pathFinal;
      const sanitizedPathInput =
        basePath.trim().length > 0 ? basePath.trim() : "/";
      const normalizedPath = sanitizedPathInput.startsWith("/")
        ? sanitizedPathInput.replace(/\/{2,}/g, "/")
        : `/${sanitizedPathInput}`.replace(/\/{2,}/g, "/");

      if (!trimmedMachine) {
        setDirError("Selecione uma máquina antes de listar as pastas.");
        return undefined;
      }

      setPathFinal(normalizedPath);
      setDirError(null);
      setCreateError(null);
      setDirResult(null);
      setIsFetchingDir(true);
      setSelectedDirectory(null);

      try {
        const response = await fetch(
          `https://hyperhive.maruqes.com/nfs/contents/${trimmedMachine}`,
          {
            method: "POST",
            headers: {
              Authorization: authToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              path: normalizedPath,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          files?: string[];
          directories?: string[];
          [key: string]: unknown;
        };
        setDirResult(data);
        return data;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar o conteúdo do diretório.";
        setDirError(message);
        setDirResult(null);
        return undefined;
      } finally {
        setIsFetchingDir(false);
      }
    },
    [machineFinal, pathFinal]
  );

  const directories = React.useMemo(
    () =>
      Array.isArray(dirResult?.directories)
        ? (dirResult?.directories as string[])
        : [],
    [dirResult]
  );

  const getDirectoryLabel = React.useCallback((entry: string) => {
    const trimmed = entry.replace(/\/+$/g, "");
    if (!trimmed || trimmed === "/") {
      return "/";
    }
    const parts = trimmed.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? trimmed;
  }, []);

  const handleOpenDirModal = React.useCallback(async () => {
    const trimmedMachine = machineFinal.trim();
    if (!trimmedMachine) {
      setDirError("Selecione uma máquina antes de listar as pastas.");
      return;
    }
    setDirError(null);
    setCreateError(null);
    const hasCachedDirectories =
      dirResult && Array.isArray(dirResult.directories);
    const result = hasCachedDirectories ? dirResult : await dirFolder();
    if (!result) {
      return;
    }
    setSelectedDirectory(null);
    setIsDirModalOpen(true);
  }, [machineFinal, dirResult, dirFolder]);

  const handleCloseDirModal = React.useCallback(() => {
    setIsDirModalOpen(false);
    setSelectedDirectory(null);
  }, []);

  const handleAddDirectory = React.useCallback(async () => {
    if (!selectedDirectory) return;
    const nextPath = computeNextPath(pathFinal, selectedDirectory);
    await dirFolder(nextPath);
    setIsDirModalOpen(false);
    setSelectedDirectory(null);
    setCreateError(null);
  }, [selectedDirectory, computeNextPath, pathFinal, dirFolder]);

  const handleCloseDrawer = React.useCallback(() => {
    setShowDrawer(false);
    setIsDirModalOpen(false);
    setDirError(null);
    setCreateError(null);
    setDirResult(null);
    setSelectedDirectory(null);
    setMountName("");
    setMachineFinal("");
    setPathFinal("/");
    setHostNormalMount(false);
    setIsFetchingDir(false);
    setIsCreating(false);
  }, []);

  const handleCreateMount = React.useCallback(async () => {
    if (isCreating) return;

    const trimmedMachine = machineFinal.trim();
    const trimmedName = mountName.trim();

    if (!trimmedMachine) {
      setCreateError("Selecione uma máquina.");
      return;
    }

    if (!trimmedName) {
      setCreateError("Informe um nome para o mount.");
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    try {
      const response = await fetch("https://hyperhive.maruqes.com/nfs/create", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          machine_name: trimmedMachine,
          folder_path: pathFinal,
          name: trimmedName,
          host_normal_mount: hostNormalMount,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      handleCloseDrawer();
      requestAnimationFrame(() => {
        return router.replace({
          pathname: pathname as any,
          params: { refresh: Date.now().toString() }
        });
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar o mount.";
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  }, [
    handleCloseDrawer,
    hostNormalMount,
    isCreating,
    machineFinal,
    mountName,
    pathFinal,
    pathname,
    router,
  ]);

  return (
    <SafeAreaProvider>
      <GluestackUIProvider mode={colorMode}>
        <ThemeProvider value={colorMode === "dark" ? DarkTheme : DefaultTheme}>
          <SafeAreaView
            style={{flex: 1, backgroundColor: statusBarBackground}}
            edges={["top", "right", "bottom", "left"]}
          >
            <StatusBar
              style={statusBarStyle}
              backgroundColor={statusBarBackground}
              animated
            />
            <Slot />
            {pathname === "/" && (
              <>
                <Button
                  size="lg"
                  className="absolute bottom-6 right-6 rounded-full p-3.5 shadow-hard-3 web:bottom-10 web:right-10 web:p-4 web:shadow-soft-3"
                  onPress={() => {
                    handleCloseDrawer();
                    setShowDrawer(true);
                    machineList();
                  }}
                >
                  <ButtonIcon as={EditIcon} />
                </Button>
                <Drawer
                  isOpen={showDrawer}
                  size="full"
                  anchor="right"
                  onClose={handleCloseDrawer}
                >
                  <DrawerBackdrop className="bg-background-950/40 backdrop-blur-sm web:bg-background-950/40 web:backdrop-blur-sm" />
                  <DrawerContent className="px-5 py-4 bg-background-0 dark:bg-[#1A2332] rounded-t-3xl web:ml-auto web:h-full web:max-w-[480px] web:px-8 web:py-6 web:rounded-l-2xl web:rounded-t-none web:border-l web:border-outline-200 web:bg-background-0 dark:web:bg-[#1A2332] dark:web:border-[#2A3647] web:shadow-2xl">
                    <SafeAreaView style={{flex: 1}} edges={["top", "bottom"]}>
                      <DrawerHeader className="pb-4 border-b border-outline-100 dark:border-[#2A3647] mb-4 web:pb-6 web:border-b web:border-outline-100 dark:web:border-[#2A3647] web:mb-6">
                        <Heading
                          size="lg"
                          className="text-typography-900 text-xl font-bold web:text-3xl web:font-bold"
                        >
                          Create Mount
                        </Heading>
                        <DrawerCloseButton
                          onPress={handleCloseDrawer}
                          className="top-0 right-0 w-9 h-9 rounded-full bg-background-100 dark:bg-[#0E1524] items-center justify-center web:top-0 web:right-0 web:w-10 web:h-10 web:rounded-full web:bg-background-100 dark:web:bg-[#0E1524] hover:web:bg-background-200 dark:hover:web:bg-[#1A2332] web:items-center web:justify-center"
                        >
                          <Icon
                            as={CloseIcon}
                            className="text-typography-700 web:text-typography-700"
                            size="sm"
                          />
                        </DrawerCloseButton>
                      </DrawerHeader>
                      <DrawerBody className="flex-1 overflow-y-auto py-2 web:flex-1 web:overflow-y-auto web:pr-2 web:py-2">
                        <VStack className="gap-4 web:gap-6">
                          <FormControl
                            isInvalid={Boolean(dirError)}
                            size="md"
                            isDisabled={false}
                            isReadOnly={false}
                            isRequired={false}
                          >
                            <FormControlLabel className="mb-2 web:mb-2">
                              <FormControlLabelText className="text-typography-900 text-sm font-semibold web:text-sm web:font-semibold web:tracking-wide">
                                Name
                              </FormControlLabelText>
                            </FormControlLabel>
                            <Input
                              variant="outline"
                              size="md"
                              isDisabled={false}
                              isInvalid={false}
                              isReadOnly={false}
                              className="bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3647] rounded-xl h-11 web:bg-background-50 dark:web:bg-[#0E1524] web:border-outline-200 dark:web:border-[#2A3647] web:rounded-xl web:h-12"
                            >
                              <InputField
                                placeholder="Enter mount name..."
                                value={mountName}
                                onChangeText={(text) => {
                                  setMountName(text);
                                  setCreateError(null);
                                }}
                                className="text-base px-3 web:text-base web:px-4"
                              />
                            </Input>
                            <FormControlLabel className="mb-2 mt-4 web:mb-2 web:mt-5">
                              <FormControlLabelText className="text-typography-900 text-sm font-semibold web:text-sm web:font-semibold web:tracking-wide">
                                Machine
                              </FormControlLabelText>
                            </FormControlLabel>
                            <Select
                              selectedValue={machineFinal}
                              onValueChange={(value) => {
                                setMachineFinal(value);
                                setDirError(null);
                                setDirResult(null);
                                setPathFinal("/");
                                setSelectedDirectory(null);
                                setCreateError(null);
                              }}
                            >
                              <SelectTrigger
                                variant="outline"
                                size="md"
                                className="bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3647] rounded-xl h-11 web:bg-background-50 dark:web:bg-[#0E1524] web:border-outline-200 dark:web:border-[#2A3647] web:rounded-xl web:h-12"
                              >
                                <SelectInput
                                  placeholder="Select machine"
                                  className="text-base px-3 web:text-base web:px-4"
                                />
                                <SelectIcon
                                  className="mr-3"
                                  as={ChevronDownIcon}
                                />
                              </SelectTrigger>
                              <SelectPortal>
                                <SelectBackdrop />
                                <SelectContent>
                                  <SelectDragIndicatorWrapper>
                                    <SelectDragIndicator />
                                  </SelectDragIndicatorWrapper>
                                  {machines.map((machine, index) => {
                                    const keyCandidate =
                                      machine?.Id ??
                                      machine?.id ??
                                      machine?.MachineUuid ??
                                      machine?.MachineName ??
                                      index;
                                    return (
                                      <SelectItem
                                        label={machine.MachineName}
                                        value={machine.MachineName}
                                        key={`machine-${keyCandidate}`}
                                      />
                                    );
                                  })}
                                </SelectContent>
                              </SelectPortal>
                            </Select>
                            <FormControlLabel className="mb-2 mt-4 web:mb-2 web:mt-5">
                              <FormControlLabelText className="text-typography-900 text-sm font-semibold web:text-sm web:font-semibold web:tracking-wide">
                                Path
                              </FormControlLabelText>
                            </FormControlLabel>
                            <Input
                              variant="outline"
                              size="md"
                              className="bg-background-50 dark:bg-[#0E1524] border-outline-200 dark:border-[#2A3647] rounded-xl h-11 web:bg-background-50 dark:web:bg-[#0E1524] web:border-outline-200 dark:web:border-[#2A3647] web:rounded-xl web:h-12"
                            >
                              <InputField
                                placeholder="/"
                                value={pathFinal}
                                onChangeText={(text) => {
                                  setPathFinal(
                                    text.length === 0
                                      ? "/"
                                      : text.startsWith("/")
                                      ? text
                                      : `/${text}`
                                  );
                                  setDirResult(null);
                                  setDirError(null);
                                  setCreateError(null);
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                className="text-base px-3 web:text-base web:px-4"
                              />
                            </Input>
                            <Button
                              variant="outline"
                              size="md"
                              action="primary"
                              className="flex-1 mt-3 h-11 rounded-xl border-2 web:px-6 web:h-12 web:rounded-xl web:mt-4 web:border-2 hover:web:bg-background-100 dark:hover:web:bg-[#1A2332]"
                              onPress={handleOpenDirModal}
                              isDisabled={isFetchingDir || !machineFinal.trim()}
                            >
                              <ButtonText className="text-base font-semibold web:text-base web:font-semibold">
                                Add Directory
                              </ButtonText>
                            </Button>
                            <Box className="mt-3 p-3 bg-background-50 dark:bg-[#0E1524] rounded-xl border border-outline-100 dark:border-[#2A3647] web:mt-4 web:p-4 web:bg-background-50 dark:web:bg-[#0E1524] web:rounded-xl web:border web:border-outline-100 dark:web:border-[#2A3647]">
                              <Box className="flex-row items-center justify-between">
                                <Checkbox
                                  isDisabled={false}
                                  isInvalid={false}
                                  size="md"
                                  value="host-normal"
                                  isChecked={hostNormalMount}
                                  onChange={(value) => {
                                    setHostNormalMount(Boolean(value));
                                    setCreateError(null);
                                  }}
                                  className="flex-1"
                                >
                                  <CheckboxIndicator className="w-5 h-5 rounded-md web:w-5 web:h-5 web:rounded-md">
                                    <CheckboxIcon as={CheckIcon} />
                                  </CheckboxIndicator>
                                  <CheckboxLabel className="text-base ml-3 text-typography-900 web:text-base web:ml-3 web:text-typography-900">
                                    Host normal mount
                                  </CheckboxLabel>
                                </Checkbox>
                                {Platform.OS === "web" ? (
                                  <Tooltip
                                    placement="top"
                                    trigger={(triggerProps) => (
                                      <Button
                                        {...triggerProps}
                                        size="xs"
                                        variant="link"
                                        accessibilityRole="button"
                                        accessibilityLabel="Show host mount info"
                                        className="ml-2 w-7 h-7 rounded-full bg-background-100 dark:bg-[#1A2332] items-center justify-center active:bg-background-200 dark:active:bg-[#0E1524] web:w-8 web:h-8 hover:web:bg-background-200 dark:hover:web:bg-[#0E1524]"
                                      >
                                        <Icon
                                          as={InfoIcon}
                                          className="text-typography-700 dark:text-typography-400"
                                          size="sm"
                                        />
                                      </Button>
                                    )}
                                  >
                                    <TooltipContent className="mx-3 max-w-[280px] px-4 py-3 bg-background-900 dark:bg-background-100 rounded-xl shadow-2xl border border-outline-200 dark:border-[#2A3647] web:mx-0 web:max-w-[360px] web:px-5 web:py-4">
                                      <Heading
                                        size="xs"
                                        className="text-typography-50 dark:text-typography-900 font-bold mb-2 text-sm web:text-base"
                                      >
                                        Host Normal Mount
                                      </Heading>
                                      <TooltipText className="text-typography-100 dark:text-typography-800 text-xs leading-5 web:text-sm web:leading-6">
                                        {hostInfoDescription}
                                      </TooltipText>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Button
                                    onPress={handleHostInfoPress}
                                    size="xs"
                                    variant="link"
                                    accessibilityRole="button"
                                    accessibilityLabel="Show host mount info"
                                    className="ml-2 w-7 h-7 rounded-full bg-background-100 dark:bg-[#1A2332] items-center justify-center active:bg-background-200 dark:active:bg-[#0E1524]"
                                  >
                                    <Icon
                                      as={InfoIcon}
                                      className="text-typography-700 dark:text-typography-400"
                                      size="sm"
                                    />
                                  </Button>
                                )}
                              </Box>
                            </Box>
                            {dirError ? (
                              <FormControlError>
                                <FormControlErrorIcon
                                  as={AlertCircleIcon}
                                  className="text-red-500"
                                />
                                <FormControlErrorText className="text-red-500">
                                  {dirError}
                                </FormControlErrorText>
                              </FormControlError>
                            ) : null}
                          </FormControl>
                          {createError ? (
                            <Box className="p-3 bg-error-50 dark:bg-error-900/20 rounded-xl border border-error-300 dark:border-error-700 web:p-4 web:bg-error-50 dark:web:bg-error-900/20 web:rounded-xl web:border web:border-error-300 dark:web:border-error-700">
                              <Text className="text-error-700 dark:text-error-400 text-sm font-medium web:text-base web:font-medium">
                                {createError}
                              </Text>
                            </Box>
                          ) : null}
                        </VStack>
                      </DrawerBody>
                      <DrawerFooter className="gap-3 pt-4 border-t border-outline-100 dark:border-[#2A3647] mt-3 web:pt-6 web:border-t web:border-outline-100 dark:web:border-[#2A3647] web:mt-4">
                        <Button
                          variant="outline"
                          onPress={handleCloseDrawer}
                          className="flex-1 h-11 rounded-xl border-2 web:px-6 web:h-12 web:rounded-xl web:border-2 hover:web:bg-background-100 dark:hover:web:bg-[#1A2332]"
                        >
                          <ButtonText className="text-base font-semibold web:text-base web:font-semibold">
                            Cancel
                          </ButtonText>
                        </Button>
                        <Button
                          action="primary"
                          onPress={handleCreateMount}
                          isDisabled={isCreating}
                          className="flex-1 flex-row items-center justify-center gap-2 h-11 rounded-xl shadow-lg web:px-6 web:h-12 web:rounded-xl web:shadow-lg"
                        >
                          {isCreating ? (
                            <>
                              <ButtonSpinner />
                              <ButtonText className="text-base font-semibold web:text-base web:font-semibold">
                                Creating...
                              </ButtonText>
                            </>
                          ) : (
                            <ButtonText className="text-base font-semibold web:text-base web:font-semibold">
                              Create Mount
                            </ButtonText>
                          )}
                        </Button>
                      </DrawerFooter>
                    </SafeAreaView>
                  </DrawerContent>
                </Drawer>
                <Modal isOpen={isDirModalOpen} onClose={handleCloseDirModal}>
                  <ModalBackdrop />
                  <ModalContent className="max-w-[340px] web:max-w-[420px] web:p-6">
                    <ModalHeader className="web:pb-2">
                      <Heading size="md" className="web:text-2xl">
                        Choose directory
                      </Heading>
                    </ModalHeader>
                    <ModalBody className="web:max-h-[320px] web:overflow-y-auto web:pr-1">
                      {directories.length === 0 ? (
                        <Text className="text-typography-500 text-sm web:text-base">
                          No directories available.
                        </Text>
                      ) : (
                        <VStack className="gap-2 web:max-h-[280px] web:overflow-y-auto">
                          {directories.map((dir) => {
                            const label = getDirectoryLabel(dir);
                            const isSelected = selectedDirectory === dir;
                            return (
                              <Button
                                key={dir}
                                variant={isSelected ? "solid" : "outline"}
                                action="primary"
                                className="justify-start web:px-4"
                                onPress={() => setSelectedDirectory(dir)}
                              >
                                <ButtonText className="web:text-base">
                                  {label}
                                </ButtonText>
                              </Button>
                            );
                          })}
                        </VStack>
                      )}
                    </ModalBody>
                    <ModalFooter className="gap-2 web:gap-3 web:pt-2">
                      <Button
                        variant="outline"
                        onPress={handleCloseDirModal}
                        className="web:px-6"
                      >
                        <ButtonText className="web:text-base">
                          Cancel
                        </ButtonText>
                      </Button>
                      <Button
                        action="primary"
                        onPress={handleAddDirectory}
                        isDisabled={!selectedDirectory}
                        className="web:px-6"
                      >
                        <ButtonText className="web:text-base">Add</ButtonText>
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </>
            )}
          </SafeAreaView>
        </ThemeProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
