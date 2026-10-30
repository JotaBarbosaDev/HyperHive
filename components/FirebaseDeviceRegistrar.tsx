import React from "react";
import { AppState } from "react-native";
import { onAuthTokenChange } from "@/services/api-client";
import { onApiBaseUrlChange } from "@/config/apiConfig";
import { registerFirebaseDevice } from "@/services/firebase-device-registration";

// Keeps this Android device registered for real notifications. Renders nothing.
export function FirebaseDeviceRegistrar() {
  React.useEffect(() => {
    const register = () => {
      registerFirebaseDevice().catch((error) => console.warn("Firebase device registration failed", error));
    };
    register();
    const offAuth = onAuthTokenChange(register);
    const offBase = onApiBaseUrlChange(register);
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") register(); });
    return () => { offAuth(); offBase(); appState.remove(); };
  }, []);
  return null;
}
