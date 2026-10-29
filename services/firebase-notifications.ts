export type FirebaseNotificationStatus = {
  packageName: string;
  projectId: string | null;
  enabled: boolean;
  restartRequired: boolean;
  permissionGranted: boolean;
  channelEnabled: boolean;
  testChannels?: Record<"info" | "warn" | "error" | "critical", boolean>;
  lastMessageId?: string | null;
  lastReceivedAt?: number;
};
export type FirebaseNotificationsModule = {
  getStatus(): FirebaseNotificationStatus;
  getConfiguration(): FirebaseClientConfiguration | null;
  saveConfiguration(raw: string): FirebaseNotificationStatus;
  activate(): FirebaseNotificationStatus;
  getToken(): Promise<string>;
  disable(): Promise<FirebaseNotificationStatus>;
};

export type FirebaseClientConfiguration = { projectId: string; appId: string; senderId: string; apiKey: string };
