import React from "react";
import { AppState, Linking, PermissionsAndroid, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { firebaseNotifications as nativeModule } from "@/services/firebase-notifications.android";
import type { FirebaseNotificationStatus, FirebaseClientConfiguration } from "@/services/firebase-notifications";
import { apiFetch, getAuthToken, onAuthTokenChange } from "@/services/api-client";
import { getApiBaseUrl, onApiBaseUrlChange } from "@/config/apiConfig";

type Check = { state: "unchecked" | "working" | "failed"; message: string };
const unchecked: Check = { state: "unchecked", message: "Not checked" };
const empty: FirebaseClientConfiguration = { projectId: "", appId: "", senderId: "", apiKey: "" };

export default function FirebaseNotificationSettings() {
  const native = nativeModule;
  const [status, setStatus] = React.useState<FirebaseNotificationStatus | null>(null);
  const [fields, setFields] = React.useState(empty);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [clientCheck, setClientCheck] = React.useState<Check>(unchecked);
  const [backendCheck, setBackendCheck] = React.useState<Check>(unchecked);
  const [expectedMessage, setExpectedMessage] = React.useState<string | null>(null);
  const [deliveryLate, setDeliveryLate] = React.useState(false);
  const [signedIn, setSignedIn] = React.useState(!!getAuthToken() && !!getApiBaseUrl());
  const pending = React.useRef<AbortController | null>(null);
  const refresh = () => { if (native) setStatus(native.getStatus()); };
  const checkBackendFile = async (signal: AbortSignal) => {
    try {
      const result = await apiFetch<{ configured: boolean; projectId?: string; message: string }>("/notification/firebase/status", { signal, reportResult: false });
      if (!signal.aborted) setBackendCheck({ state: result.configured ? "unchecked" : "failed", message: result.message });
    } catch (error) {
      if (!signal.aborted) setBackendCheck({ state: "failed", message: error instanceof Error ? error.message : "Backend status unavailable. Update the HyperHive backend." });
    }
  };
  React.useEffect(() => {
    refresh();
    if (native?.getConfiguration) setFields(native.getConfiguration() ?? empty);
    let controller = new AbortController();
    if (getAuthToken() && getApiBaseUrl()) void checkBackendFile(controller.signal);
    const cancel = () => {
      pending.current?.abort(); controller.abort(); controller = new AbortController();
      setSignedIn(!!getAuthToken() && !!getApiBaseUrl());
      setMessage(""); setBusy(false); setClientCheck(unchecked); setBackendCheck(unchecked); setExpectedMessage(null);
      if (getAuthToken() && getApiBaseUrl()) void checkBackendFile(controller.signal);
    };
    const offAuth = onAuthTokenChange(cancel);
    const offBase = onApiBaseUrlChange(cancel);
    const appState = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    const poll = setInterval(refresh, 1000);
    return () => { pending.current?.abort(); controller.abort(); clearInterval(poll); offAuth(); offBase(); appState.remove(); };
  }, []);
  React.useEffect(() => {
    if (!expectedMessage) return;
    setDeliveryLate(false);
    const timer = setTimeout(() => setDeliveryLate(true), 20000);
    return () => clearTimeout(timer);
  }, [expectedMessage]);

  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setMessage("");
    try { await action(controller.signal); }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Notification action failed."); }
    finally {
      if (!controller.signal.aborted) { refresh(); setBusy(false); }
      if (pending.current === controller) pending.current = null;
    }
  };
  const checkConnection = async (signal: AbortSignal) => {
    setClientCheck(unchecked); setBackendCheck(unchecked);
    let token: string;
    try {
      token = await native!.getToken();
      if (signal.aborted) return;
      setClientCheck({ state: "working", message: "Firebase issued a device token" });
    } catch (error) {
      if (!signal.aborted) setClientCheck({ state: "failed", message: error instanceof Error ? error.message : "Device registration failed" });
      return;
    }
    try {
      await apiFetch("/notification/firebase/check", { method: "POST", body: { token, projectId: native!.getStatus().projectId }, signal, reportResult: false });
      if (!signal.aborted) setBackendCheck({ state: "working", message: "Firebase validated credentials, project and device token. No notification was sent." });
    } catch (error) {
      if (!signal.aborted) setBackendCheck({ state: "failed", message: error instanceof Error ? error.message : "Firebase validation failed" });
    }
  };
  const saved = (raw: string) => {
    const imported = native!.saveConfiguration(raw);
    setStatus(imported); setClientCheck(unchecked); setBackendCheck(unchecked); setExpectedMessage(null);
    setFields(native!.getConfiguration() ?? empty);
    setMessage(imported.restartRequired ? "Configuration saved. Force-stop and reopen the app before enabling notifications." : "Configuration saved. Enable notifications, then check the connection.");
  };
  const indicator = (label: string, check: Check) => <Box className="gap-1">
    <Text accessibilityRole="alert" className={`text-sm font-semibold ${check.state === "working" ? "text-success-700 dark:text-success-400" : check.state === "failed" ? "text-error-700 dark:text-error-400" : "text-warning-700 dark:text-warning-400"}`}>{label}: {check.state === "working" ? "Working" : check.state === "failed" ? "Not working" : "Not checked"}</Text>
    <Text className="text-sm text-typography-700">{check.message}</Text>
  </Box>;
  if (!native) return <Text className="text-sm text-typography-700">Firebase requires a new Android build. It is unavailable in Expo Go.</Text>;
  const blocked = !!status && (!status.permissionGranted || !status.channelEnabled);
  const ready = !!status?.projectId && status.enabled && !status.restartRequired && !blocked && signedIn;
  const received = !!expectedMessage && !!status?.lastMessageId && (expectedMessage === status.lastMessageId || expectedMessage.endsWith("/" + status.lastMessageId));
  return <Box className="gap-3">
    <Text className="text-sm font-semibold text-typography-900">Android Firebase · {status?.projectId ?? "No project configured"}</Text>
    <Text className="text-sm text-typography-700">These fields are Android client settings. The backend needs a separate service-account credential. Never enter its private key here.</Text>
    {indicator("Android client", blocked ? { state: "failed", message: "Android notification permission or the notification channel is blocked." } : clientCheck)}
    {indicator("Backend credentials", backendCheck)}
    {([
      ["projectId", "Project ID"], ["appId", "Firebase Android App ID"], ["senderId", "Sender ID / project number"], ["apiKey", "Android API key"],
    ] as const).map(([key, label]) => <Box key={key} className="gap-1">
      <Text className="text-sm text-typography-900">{label}</Text>
      <Input isDisabled={busy || status?.enabled}><InputField accessibilityLabel={label} value={fields[key]} autoCapitalize="none" autoCorrect={false} onChangeText={value => { setFields(current => ({ ...current, [key]: value })); setClientCheck(unchecked); setBackendCheck(unchecked); }} /></Input>
    </Box>)}
    <Button variant="outline" action="secondary" isDisabled={busy || status?.enabled || Object.values(fields).some(value => !value.trim())} onPress={() => run(async () => {
      const values = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim()])) as FirebaseClientConfiguration;
      saved(JSON.stringify({ project_info: { project_id: values.projectId, project_number: values.senderId }, client: [{ client_info: { mobilesdk_app_id: values.appId, android_client_info: { package_name: status?.packageName } }, api_key: [{ current_key: values.apiKey }] }] }));
    })} className="h-12 rounded-lg"><ButtonText>Save manual configuration</ButtonText></Button>
    <Button variant="outline" action="secondary" isDisabled={busy || status?.enabled} onPress={() => run(async signal => {
      const selected = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "application/octet-stream"], copyToCacheDirectory: true });
      if (selected.canceled) return;
      const file = new File(selected.assets[0].uri);
      try { if (signal.aborted) return; if (file.size > 65536) throw new Error("Configuration exceeds 64 KiB."); const raw = await file.text(); if (!signal.aborted) saved(raw); }
      finally { if (file.exists) file.delete(); }
    })} className="h-12 rounded-lg"><ButtonText>Import google-services.json</ButtonText></Button>
    <Button variant="outline" action="secondary" isDisabled={busy || !status?.projectId || status.enabled || status.restartRequired} onPress={() => run(async signal => {
      if (Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (signal.aborted) return;
      setStatus(native.activate()); setMessage("Notifications enabled. Check the connection before sending a test.");
    })} className="h-12 rounded-lg"><ButtonText>Enable notifications</ButtonText></Button>
    <Button variant="outline" action="secondary" isDisabled={busy || !ready} onPress={() => run(checkConnection)} className="h-12 rounded-lg"><ButtonText>Check Firebase connection</ButtonText></Button>
    <Button variant="outline" action="secondary" isDisabled={busy || !status?.projectId} onPress={() => run(async signal => {
      const disabled = await native.disable();
      if (!signal.aborted) { setStatus(disabled); setClientCheck(unchecked); setBackendCheck(unchecked); setExpectedMessage(null); setMessage("Notifications disabled."); }
    })} className="h-12 rounded-lg"><ButtonText>Disable notifications</ButtonText></Button>
    {blocked || status?.restartRequired ? <Button variant="link" className="h-12 self-start" onPress={() => Linking.openSettings()}><ButtonText>Open Android app settings</ButtonText></Button> : null}
    {status?.restartRequired ? <Text accessibilityRole="alert" className="text-sm text-typography-700">Force-stop and reopen the app to use the imported project.</Text> : null}
    <Button variant="outline" action="secondary" size="sm" isDisabled={busy || !ready || backendCheck.state !== "working" || clientCheck.state !== "working"} onPress={() => run(async signal => {
      const session = getAuthToken(); const backend = getApiBaseUrl();
      const token = await native.getToken();
      if (signal.aborted || !session || session !== getAuthToken() || backend !== getApiBaseUrl()) return;
      const result = await apiFetch<{ messageId: string }>("/notification/firebase/test", { method: "POST", token: session, body: { token, projectId: native.getStatus().projectId }, signal, reportResult: false });
      if (!signal.aborted) { setExpectedMessage(result.messageId); setMessage("Test accepted by Firebase. Waiting for this device to receive it…"); }
    })} className="h-12 self-start rounded-lg"><ButtonText>{busy ? "Please wait…" : "Send test notification"}</ButtonText></Button>
    {expectedMessage ? indicator("Device receipt", received ? { state: "working", message: "This app received the test message." } : { state: deliveryLate ? "failed" : "unchecked", message: deliveryLate ? "Firebase accepted the test, but this app has not confirmed receipt. Keep Settings open; check Google Play services, VPN/firewall and battery restrictions. Background display may not report a foreground receipt." : "Waiting for a foreground receipt from Firebase…" }) : null}
    {message ? <Text accessibilityRole="alert" className="text-sm text-typography-700">{message}</Text> : null}
  </Box>;
}
