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
import {Slot, usePathname} from "expo-router";
import {
  Button,
  ButtonIcon,
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
import {Input, InputField, InputIcon, InputSlot} from "@/components/ui/input";
import {VStack} from "@/components/ui/vstack";
import {
  Checkbox,
  CheckboxIndicator,
  CheckboxLabel,
  CheckboxIcon,
} from "@/components/ui/checkbox";
import {CheckIcon} from "@/components/ui/icon";
import {HStack} from "@/components/ui/hstack";

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
  let [inputValue, setInputValue] = React.useState(true);

  const handleSubmit = () => {
    console.log("Submitted value:", inputValue);
  };

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
                    setShowDrawer(true);
                  }}
                >
                  <ButtonIcon as={EditIcon} />
                </Button>

                <Drawer
                  isOpen={showDrawer}
                  size="full"
                  anchor="right"
                  onClose={() => {
                    setShowDrawer(false);
                  }}
                >
                  <DrawerBackdrop />
                  <DrawerContent>
                    <SafeAreaView style={{flex: 1}} edges={["top", "bottom"]}>
                      <DrawerHeader>
                        <Heading size="lg">Create mount</Heading>
                        <DrawerCloseButton>
                          <Icon as={CloseIcon} />
                        </DrawerCloseButton>
                      </DrawerHeader>
                      <DrawerBody>
                        <VStack>
                          <FormControl
                            isInvalid={false}
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
                              <InputField placeholder="Enter name here..." />
                            </Input>
                            <FormControlLabel>
                              <FormControlLabelText>
                                Machine
                              </FormControlLabelText>
                            </FormControlLabel>
                            <Select>
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
                                  <SelectItem
                                    label="marques512sv"
                                    value="marques512sv"
                                  />
                                  <SelectItem
                                    label="marques2673sv"
                                    value="marques2673sv"
                                  />
                                </SelectContent>
                              </SelectPortal>
                            </Select>
                            <FormControlLabel>
                              <FormControlLabelText>Path</FormControlLabelText>
                            </FormControlLabel>
                              <Input
                                variant="outline"
                                size="md"
                                isDisabled={false}
                                isInvalid={false}
                                isReadOnly={false}
                              >
                                <InputField
                                  placeholder="/"
                                />
                              </Input>
                              <Button
                                variant="solid"
                                size="md"
                                action="primary"
                                className="flex-1"
                              >
                                <ButtonText>Select Folder</ButtonText>
                              </Button>
                            <Checkbox
                              isDisabled={false}
                              isInvalid={false}
                              size="md"
                              value={"false"}
                            >
                              <CheckboxIndicator>
                                <CheckboxIcon as={CheckIcon} />
                              </CheckboxIndicator>
                              <CheckboxLabel>Slow HDD</CheckboxLabel>
                            </Checkbox>

                            <FormControlError>
                              <FormControlErrorIcon
                                as={AlertCircleIcon}
                                className="text-red-500"
                              />
                              <FormControlErrorText className="text-red-500">
                                At least 6 characters are required.
                              </FormControlErrorText>
                            </FormControlError>
                          </FormControl>
                          <Button
                            className="w-fit self-end mt-4"
                            size="sm"
                            variant="outline"
                            onPress={handleSubmit}
                          >
                            <ButtonText>Submit</ButtonText>
                          </Button>
                        </VStack>
                      </DrawerBody>
                      <DrawerFooter>
                        <Button
                          variant="outline"
                          onPress={() => {
                            setShowDrawer(false);
                          }}
                        >
                          <ButtonText>Cancel</ButtonText>
                        </Button>
                      </DrawerFooter>
                    </SafeAreaView>
                  </DrawerContent>
                </Drawer>
              </>
            )}
          </SafeAreaView>
        </ThemeProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
