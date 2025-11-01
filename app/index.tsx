import React from "react";
import {KeyboardAvoidingView, Platform, ScrollView} from "react-native";
import {useRouter} from "expo-router";
import {Box} from "@/components/ui/box";
import {
  FormControl,
  FormControlError,
  FormControlErrorIcon,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import {VStack} from "@/components/ui/vstack";
import {Heading} from "@/components/ui/heading";
import {Text} from "@/components/ui/text";
import {Input, InputField, InputIcon, InputSlot} from "@/components/ui/input";
import {Button, ButtonSpinner, ButtonText} from "@/components/ui/button";
import {AlertCircleIcon, EyeIcon, EyeOffIcon} from "@/components/ui/icon";
import Logo from "@/assets/icons/Logo";

export default function LoginScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");

  const togglePasswordVisibility = React.useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = React.useCallback(async () => {
    // Reset errors
    setError("");
    setEmailError("");
    setPasswordError("");

    // Validate fields
    let hasError = false;

    if (!email.trim()) {
      setEmailError("Email é obrigatório");
      hasError = true;
    } else if (!validateEmail(email)) {
      setEmailError("Email inválido");
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError("Password é obrigatória");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password deve ter pelo menos 6 caracteres");
      hasError = true;
    }

    if (hasError) return;

    // Simulate login
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.replace("/mounts");
    } catch (err) {
      setError("Erro ao fazer login. Tenta novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [email, password, router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{flex: 1}}
    >
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled"
      >
        <Box className="flex-1 bg-background-50 dark:bg-[#070D19] px-6 py-10 items-center justify-center web:px-10">
          <Box className="w-full max-w-md">
            {/* Logo */}
            <Box className="items-center mb-8 web:mb-10">
              <Box className="mb-4 web:mb-6">
                <Logo />
              </Box>
              <Heading
                size="2xl"
                className="text-typography-900 dark:text-typography-0 font-heading text-center web:text-4xl"
              >
                HyperHive
              </Heading>
              <Text className="text-typography-500 dark:text-typography-400 text-sm text-center mt-2 web:text-base">
                Gestão de Mounts Simplificada
              </Text>
            </Box>

            {/* Login Form */}
            <Box className="w-full rounded-2xl border border-outline-200 bg-background-0 p-6 shadow-soft-3 dark:border-[#1F2937] dark:bg-[#0E1524] web:p-8">
              <VStack className="gap-6">
                <Box>
                  <Heading
                    size="lg"
                    className="text-typography-900 dark:text-typography-0 font-heading web:text-2xl"
                  >
                    Bem-vindo de volta
                  </Heading>
                  <Text className="text-typography-500 dark:text-typography-400 text-sm font-body mt-2 web:text-base">
                    Entra com as tuas credenciais para acederes ao painel de mounts.
                  </Text>
                </Box>

                {/* General Error */}
                {error && (
                  <Box className="p-3 bg-error-50 dark:bg-error-900/20 rounded-xl border border-error-300 dark:border-error-700">
                    <Text className="text-error-700 dark:text-error-400 text-sm">
                      {error}
                    </Text>
                  </Box>
                )}

                {/* Email Field */}
                <FormControl isInvalid={!!emailError}>
                  <FormControlLabel>
                    <FormControlLabelText className="text-sm text-typography-600 dark:text-typography-300 font-semibold web:text-base">
                      Email
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input
                    className="mt-2"
                    variant="outline"
                    isInvalid={!!emailError}
                  >
                    <InputField
                      type="text"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        setEmailError("");
                        setError("");
                      }}
                      placeholder="nome@exemplo.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="web:text-base"
                    />
                  </Input>
                  {emailError && (
                    <FormControlError>
                      <FormControlErrorIcon as={AlertCircleIcon} />
                      <FormControlErrorText>{emailError}</FormControlErrorText>
                    </FormControlError>
                  )}
                </FormControl>

                {/* Password Field */}
                <FormControl isInvalid={!!passwordError}>
                  <FormControlLabel>
                    <FormControlLabelText className="text-sm text-typography-600 dark:text-typography-300 font-semibold web:text-base">
                      Password
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input
                    className="mt-2"
                    variant="outline"
                    isInvalid={!!passwordError}
                  >
                    <InputField
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        setPasswordError("");
                        setError("");
                      }}
                      secureTextEntry={!showPassword}
                      placeholder="••••••••"
                      className="web:text-base"
                    />
                    <InputSlot className="pr-3" onPress={togglePasswordVisibility}>
                      <InputIcon
                        as={showPassword ? EyeOffIcon : EyeIcon}
                        className="text-typography-500 dark:text-typography-400"
                      />
                    </InputSlot>
                  </Input>
                  {passwordError && (
                    <FormControlError>
                      <FormControlErrorIcon as={AlertCircleIcon} />
                      <FormControlErrorText>{passwordError}</FormControlErrorText>
                    </FormControlError>
                  )}
                </FormControl>

                {/* Submit Button */}
                <Button
                  className="mt-2 h-12 rounded-xl web:h-14"
                  onPress={handleSubmit}
                  action="primary"
                  isDisabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <ButtonSpinner />
                      <ButtonText className="text-base font-semibold ml-2 web:text-lg">
                        A entrar...
                      </ButtonText>
                    </>
                  ) : (
                    <ButtonText className="text-base font-semibold web:text-lg">
                      Entrar
                    </ButtonText>
                  )}
                </Button>
              </VStack>
            </Box>

            {/* Footer */}
            <Text className="text-typography-500 dark:text-typography-400 text-xs text-center mt-6 web:text-sm">
              © 2025 HyperHive. Todos os direitos reservados.
            </Text>
          </Box>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
