import { fetchCelldFleets } from "@/services/celld";
import { usePollingResource } from "./usePollingResource";

export function useCelldFleets(token: string | null, isChecking: boolean) {
  return usePollingResource(fetchCelldFleets, token, isChecking);
}
