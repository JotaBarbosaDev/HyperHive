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
  const systemColorScheme = useColorScheme();
  const colorMode = systemColorScheme === "dark" ? "dark" : "light";
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
  const router = useRouter();

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
      const machines = await fetch("https://hyperhive.maruqes.com/protocol/list", {
        headers: {
          method: "GET",
          Authorization: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJVNWpLYm0xMHZhdEMxaFduIiwiaWF0IjoxNzYxNzMyNjk4LCJleHAiOjE3NjE4MTkwOTh9.bvAmlfqYkd8gbZevHPexzDl7LIpDbZocjWGxsiFAknkumclFaf6oK05KThbQEJ-olOg0M-5LSMl4207633dFs6iZ4bSStCuaX8ZfaR1FeG95ajcqBNDiUIaEoq904YaZt5DOTDyPjXdNkssTzvhOVFqlJLulvXU5-iZgcIF5LGGfOYusUbKFNHv-wtCV80B70oUUUaPdhwX822ISyxs5TOdotVSk6CzOByAjaWZlpkU1ULmfK5syOBqNZMmgn-vUxGSfob7nccwFzjTqZuIeDdudYpgc0DidgUpRT9tWXuDCccD17kiu4dbAzCg9MpMADNK9F9CEpBEK4hz-qk0WHA"
        }
      });
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
              Authorization:
                "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJVNWpLYm0xMHZhdEMxaFduIiwiaWF0IjoxNzYxNzMyNjk4LCJleHAiOjE3NjE4MTkwOTh9.bvAmlfqYkd8gbZevHPexzDl7LIpDbZocjWGxsiFAknkumclFaf6oK05KThbQEJ-olOg0M-5LSMl4207633dFs6iZ4bSStCuaX8ZfaR1FeG95ajcqBNDiUIaEoq904YaZt5DOTDyPjXdNkssTzvhOVFqlJLulvXU5-iZgcIF5LGGfOYusUbKFNHv-wtCV80B70oUUUaPdhwX822ISyxs5TOdotVSk6CzOByAjaWZlpkU1ULmfK5syOBqNZMmgn-vUxGSfob7nccwFzjTqZuIeDdudYpgc0DidgUpRT9tWXuDCccD17kiu4dbAzCg9MpMADNK9F9CEpBEK4hz-qk0WHA",
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
          Authorization:
            "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcGkiLCJhdHRycyI6eyJpZCI6Mn0sInNjb3BlIjpbInVzZXIiXSwiZXhwaXJlc0luIjoiMWQiLCJqdGkiOiJVNWpLYm0xMHZhdEMxaFduIiwiaWF0IjoxNzYxNzMyNjk4LCJleHAiOjE3NjE4MTkwOTh9.bvAmlfqYkd8gbZevHPexzDl7LIpDbZocjWGxsiFAknkumclFaf6oK05KThbQEJ-olOg0M-5LSMl4207633dFs6iZ4bSStCuaX8ZfaR1FeG95ajcqBNDiUIaEoq904YaZt5DOTDyPjXdNkssTzvhOVFqlJLulvXU5-iZgcIF5LGGfOYusUbKFNHv-wtCV80B70oUUUaPdhwX822ISyxs5TOdotVSk6CzOByAjaWZlpkU1ULmfK5syOBqNZMmgn-vUxGSfob7nccwFzjTqZuIeDdudYpgc0DidgUpRT9tWXuDCccD17kiu4dbAzCg9MpMADNK9F9CEpBEK4hz-qk0WHA",
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
            style={{flex: 1}}
            edges={["top", "right", "bottom", "left"]}
          >
            <Slot />
            {pathname === "/" && (
              <>
                <Button
                  size="lg"
                  className="absolute bottom-6 right-6 rounded-full p-3.5"
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
                  <DrawerBackdrop />
                  <DrawerContent>
                    <SafeAreaView style={{flex: 1}} edges={["top", "bottom"]}>
                      <DrawerHeader>
                        <Heading size="lg">Create mount</Heading>
                        <DrawerCloseButton onPress={handleCloseDrawer}>
                          <Icon as={CloseIcon} />
                        </DrawerCloseButton>
                      </DrawerHeader>
                      <DrawerBody>
                        <VStack>
                          <FormControl
                            isInvalid={Boolean(dirError)}
                            size="md"
                            isDisabled={false}
                            isReadOnly={false}
                            isRequired={false}
                          >
                            <FormControlLabel>
                              <FormControlLabelText>Name</FormControlLabelText>
                            </FormControlLabel>
                            <Input
                              variant="outline"
                              size="md"
                              isDisabled={false}
                              isInvalid={false}
                              isReadOnly={false}
                            >
                              <InputField
                                placeholder="Enter name here..."
                                value={mountName}
                                onChangeText={(text) => {
                                  setMountName(text);
                                  setCreateError(null);
                                }}
                              />
                            </Input>
                            <FormControlLabel>
                              <FormControlLabelText>
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
                              <SelectTrigger variant="outline" size="md">
                                <SelectInput placeholder="Select machine" />
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
                                  {machines.map((machine) => (
                                    <SelectItem
                                      label={machine.MachineName}
                                      value={machine.MachineName}
                                      key={machine.index}
                                    />
                                  ))}
                                </SelectContent>
                              </SelectPortal>
                            </Select>
                            <FormControlLabel>
                              <FormControlLabelText>Path</FormControlLabelText>
                            </FormControlLabel>
                            <Input variant="outline" size="md">
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
                              />
                            </Input>
                            <Button
                              variant="outline"
                              size="md"
                              action="primary"
                              className="flex-1"
                              onPress={handleOpenDirModal}
                              isDisabled={isFetchingDir || !machineFinal.trim()}
                            >
                              <ButtonText>Add directory</ButtonText>
                            </Button>
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
                            >
                              <CheckboxIndicator>
                                <CheckboxIcon as={CheckIcon} />
                              </CheckboxIndicator>
                              <CheckboxLabel>Host normal mount</CheckboxLabel>
                            </Checkbox>
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
                            <Text className="text-[#EF4444] text-sm mt-2">
                              {createError}
                            </Text>
                          ) : null}
                        </VStack>
                      </DrawerBody>
                      <DrawerFooter>
                        <Button variant="outline" onPress={handleCloseDrawer}>
                          <ButtonText>Cancel</ButtonText>
                        </Button>
                        <Button
                          action="primary"
                          onPress={handleCreateMount}
                          isDisabled={isCreating}
                          className="flex-row items-center gap-2"
                        >
                          {isCreating ? (
                            <>
                              <ButtonSpinner />
                              <ButtonText>Creating...</ButtonText>
                            </>
                          ) : (
                            <ButtonText>Create</ButtonText>
                          )}
                        </Button>
                      </DrawerFooter>
                    </SafeAreaView>
                  </DrawerContent>
                </Drawer>
                <Modal isOpen={isDirModalOpen} onClose={handleCloseDirModal}>
                  <ModalBackdrop />
                  <ModalContent className="max-w-[340px]">
                    <ModalHeader>
                      <Heading size="md">Choose directory</Heading>
                    </ModalHeader>
                    <ModalBody>
                      {directories.length === 0 ? (
                        <Text className="text-typography-500 text-sm">
                          No directories available.
                        </Text>
                      ) : (
                        <VStack className="gap-2">
                          {directories.map((dir) => {
                            const label = getDirectoryLabel(dir);
                            const isSelected = selectedDirectory === dir;
                            return (
                              <Button
                                key={dir}
                                variant={isSelected ? "solid" : "outline"}
                                action="primary"
                                className="justify-start"
                                onPress={() => setSelectedDirectory(dir)}
                              >
                                <ButtonText>{label}</ButtonText>
                              </Button>
                            );
                          })}
                        </VStack>
                      )}
                    </ModalBody>
                    <ModalFooter className="gap-2">
                      <Button variant="outline" onPress={handleCloseDirModal}>
                        <ButtonText>Cancel</ButtonText>
                      </Button>
                      <Button
                        action="primary"
                        onPress={handleAddDirectory}
                        isDisabled={!selectedDirectory}
                      >
                        <ButtonText>Add</ButtonText>
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
