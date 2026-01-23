import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from "react-native";
import { useRouter } from "expo-router";
import { Box } from "@/components/ui/box";
import { Image } from "@/components/ui/image";
import {
  FormControl,
  FormControlError,
  FormControlErrorIcon,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { normalizeApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { login, listMachines } from "@/services/hyperhive";
import { ApiError, getAuthToken, setAuthToken } from "@/services/api-client";
import { loadApiBaseUrl, saveApiBaseUrl, saveAuthToken } from "@/services/auth-storage";

const APP_ICON = require("../assets/images/android-chrome-192x192.png");

export default function LoginScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [baseUrlError, setBaseUrlError] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const emailInputRef = React.useRef<TextInput | null>(null);
  const passwordInputRef = React.useRef<TextInput | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const isWeb = Platform.OS === "web";
  const currentYear = new Date().getFullYear();

  const togglePasswordVisibility = React.useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  React.useEffect(() => {
    let isActive = true;
    const hydrateBaseUrl = async () => {
      const storedBase = await loadApiBaseUrl();
      if (storedBase && isActive) {
        setBaseUrl(storedBase);
        setApiBaseUrl(storedBase);
      }
    };
    hydrateBaseUrl();
    return () => {
      isActive = false;
    };
  }, []);

  React.useEffect(() => {
    let isActive = true;
    const redirectIfAuthenticated = async () => {
      const token = getAuthToken();
      if (!token) {
        return;
      }
      try {
        await listMachines();
        if (!isActive) return;
        router.replace("/dashboard");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Handled globally via unauthorized listeners.
        }
      }
    };
    redirectIfAuthenticated();
    return () => {
      isActive = false;
    };
  }, [router]);

  const handleSubmit = React.useCallback(async () => {
    // Reset errors
    setError("");
    setBaseUrlError("");
    setEmailError("");
    setPasswordError("");

    // Validate fields
    let hasError = false;
    let normalizedBaseUrl: string | null = null;

    if (!baseUrl.trim()) {
      setBaseUrlError("Domain or API base is required");
      hasError = true;
    } else {
      normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
      if (!normalizedBaseUrl) {
        setBaseUrlError("Invalid domain or API base");
        hasError = true;
      }
    }

    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!validateEmail(email)) {
      setEmailError("Invalid email");
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      hasError = true;
    }

    if (hasError || !normalizedBaseUrl) return;

    setApiBaseUrl(normalizedBaseUrl);

    setIsLoading(true);
    try {
      const normalizedEmail = email.trim();
      const { token } = await login({
        email: normalizedEmail,
        password,
      });

      if (!token) {
        throw new Error("Invalid token returned by the API.");
      }

      setAuthToken(token);
      await Promise.all([saveAuthToken(token), saveApiBaseUrl(normalizedBaseUrl)]);
      router.replace("/dashboard");
    } catch (err) {
      let message = "Error signing in. Please try again.";
      if (err instanceof ApiError) {
        if (typeof err.data === "string" && err.data.trim().length > 0) {
          message = err.data;
        } else if (
          typeof err.data === "object" &&
          err.data !== null &&
          "message" in err.data &&
          typeof (err.data as { message?: unknown }).message === "string"
        ) {
          message = (err.data as { message: string }).message;
        } else if (err.message) {
          message = err.message;
        }
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, email, password, router]);

  const handleFormSubmit = React.useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!isLoading) {
        void handleSubmit();
      }
    },
    [handleSubmit, isLoading]
  );

  const handleEmailSubmit = React.useCallback(
    (_event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      passwordInputRef.current?.focus();
    },
    []
  );

  const formFields = (
    <VStack className="gap-6">
      <Box>
        <Heading
          size="lg"
          className="text-typography-900 dark:text-[#E8EBF0] font-heading web:text-2xl"
        >
          Welcome back
        </Heading>
        <Text className="text-typography-500 dark:text-[#8A94A8] text-sm font-body mt-2 web:text-base">
          Sign in with your credentials to access the dashboard.
        </Text>
      </Box>

      {error ? (
        <Box className="p-3 bg-error-50 dark:bg-error-900/20 rounded-xl border border-error-300 dark:border-error-700">
          <Text className="text-error-700 dark:text-error-400 text-sm">
            {error}
          </Text>
        </Box>
      ) : null}

      <FormControl isInvalid={!!baseUrlError}>
        <FormControlLabel>
          <FormControlLabelText className="text-sm text-typography-600 dark:text-[#8A94A8] font-semibold web:text-base">
            Domain or API Base
          </FormControlLabelText>
        </FormControlLabel>
        <Input className="mt-2" variant="outline" isInvalid={!!baseUrlError}>
          <InputField
            value={baseUrl ?? ""}
            onChangeText={(text) => {
              setBaseUrl(text);
              setBaseUrlError("");
              setError("");
            }}
            placeholder="https://hyperhiveapi.domain.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="URL"
            inputMode="url"
            keyboardType="url"
            returnKeyType="next"
            enablesReturnKeyAutomatically
            nativeID="login-base-url"
            onSubmitEditing={() => {
              emailInputRef.current?.focus();
            }}
            className="web:text-base"
          />
        </Input>
        {baseUrlError ? (
          <FormControlError>
            <FormControlErrorIcon as={AlertCircleIcon} />
            <FormControlErrorText>{baseUrlError}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <FormControl isInvalid={!!emailError}>
        <FormControlLabel>
          <FormControlLabelText className="text-sm text-typography-600 dark:text-[#8A94A8] font-semibold web:text-base">
            Email
          </FormControlLabelText>
        </FormControlLabel>
        <Input className="mt-2" variant="outline" isInvalid={!!emailError}>
          <InputField
            ref={(node) => {
              emailInputRef.current = node as unknown as TextInput | null;
            }}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError("");
              setError("");
            }}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            importantForAutofill="yes"
            inputMode="email"
            returnKeyType="next"
            enablesReturnKeyAutomatically
            nativeID="login-email"
            onSubmitEditing={handleEmailSubmit}
            className="web:text-base"
          />
        </Input>
        {emailError ? (
          <FormControlError>
            <FormControlErrorIcon as={AlertCircleIcon} />
            <FormControlErrorText>{emailError}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <FormControl isInvalid={!!passwordError}>
        <FormControlLabel>
          <FormControlLabelText className="text-sm text-typography-600 dark:text-[#8A94A8] font-semibold web:text-base">
            Password
          </FormControlLabelText>
        </FormControlLabel>
        <Input className="mt-2" variant="outline" isInvalid={!!passwordError}>
          <InputField
            ref={(node) => {
              passwordInputRef.current = node as unknown as TextInput | null;
            }}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError("");
              setError("");
            }}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            textContentType="password"
            importantForAutofill="yes"
            returnKeyType="go"
            enablesReturnKeyAutomatically
            nativeID="login-password"
            onSubmitEditing={() => {
              if (isWeb) {
                if (formRef.current?.requestSubmit) {
                  formRef.current.requestSubmit();
                } else {
                  handleFormSubmit();
                }
              } else if (!isLoading) {
                void handleSubmit();
              }
            }}
            className="web:text-base"
          />
          <InputSlot className="pr-3" onPress={togglePasswordVisibility}>
            <InputIcon
              as={showPassword ? EyeOffIcon : EyeIcon}
              className="text-typography-500 dark:text-[#8A94A8]"
            />
          </InputSlot>
        </Input>
        {passwordError ? (
          <FormControlError>
            <FormControlErrorIcon as={AlertCircleIcon} />
            <FormControlErrorText>{passwordError}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <Button
        className="mt-2 h-12 rounded-xl web:h-14 w-full items-center justify-center"
        onPress={() => {
          if (isWeb) {
            if (formRef.current?.requestSubmit) {
              formRef.current.requestSubmit();
            } else {
              handleFormSubmit();
            }
          } else {
            handleSubmit();
          }
        }}
        action="primary"
        isDisabled={isLoading}
      >
        {isLoading ? (
          <HStack className="items-center justify-center gap-2">
            <ButtonSpinner />
            <ButtonText className="text-base font-semibold web:text-lg text-center flex-shrink-0">
              Signing in...
            </ButtonText>
          </HStack>
        ) : (
          <ButtonText className="text-base font-semibold web:text-lg text-center flex-shrink-0">
            Sign in
          </ButtonText>
        )}
      </Button>
    </VStack>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Box className="flex-1 bg-background-50 dark:bg-[#070D19] px-6 py-10 items-center justify-center web:px-10">
          <Box className="w-full max-w-md">
            {/* Logo */}
            <Box className="items-center mb-8 web:mb-10">
              <Box className="mb-4 web:mb-6">
                <Box className="h-20 w-20 web:h-24 web:w-24 items-center justify-center rounded-2xl bg-[#0E1524] shadow-soft-3">
                  <Image
                    source={APP_ICON}
                    alt="HyperHive logo"
                    resizeMode="contain"
                    size="none"
                    className="h-12 w-12 web:h-14 web:w-14"
                  />
                </Box>
              </Box>
              <Heading
                size="2xl"
                className="text-typography-900 dark:text-[#E8EBF0] font-heading text-center web:text-4xl"
              >
                HyperHive
              </Heading>
              <Text className="text-typography-500 dark:text-[#8A94A8] text-sm text-center mt-2 web:text-base">
                Simplified Mounts Management
              </Text>
            </Box>

            {/* Login Form */}
            {isWeb ? (
              <form
                ref={formRef}
                onSubmit={handleFormSubmit}
                autoComplete="on"
                className="contents"
              >
                <Box className="w-full rounded-2xl border border-outline-200 bg-background-0 p-6 shadow-soft-3 dark:border-[#1F2937] dark:bg-[#0E1524] web:p-8">
                  {formFields}
                </Box>
              </form>
            ) : (
              <Box className="w-full rounded-2xl border border-outline-200 bg-background-0 p-6 shadow-soft-3 dark:border-[#1F2937] dark:bg-[#0E1524] web:p-8">
                {formFields}
              </Box>
            )}

            {/* Footer */}
            <Text className="text-typography-500 dark:text-[#8A94A8] text-xs text-center mt-6 web:text-sm">
              © {currentYear} HyperHive. All rights reserved.
            </Text>
          </Box>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
