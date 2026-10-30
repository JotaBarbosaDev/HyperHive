// Android-only: other platforms receive notifications through web push.
export async function registerFirebaseDevice(): Promise<boolean> { return false; }
export async function unregisterFirebaseDevice(): Promise<void> {}
