import { requireOptionalNativeModule } from "expo-modules-core";
import type { FirebaseNotificationsModule } from "./firebase-notifications";
export const firebaseNotifications = requireOptionalNativeModule<FirebaseNotificationsModule>("FirebaseNotifications");
