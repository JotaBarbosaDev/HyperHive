import { fetchCelldHealth } from "@/services/celld";
import { usePollingResource } from "./usePollingResource";

export function useCelldHealth(token: string | null, isChecking: boolean) {
  const { data: health, ...state } = usePollingResource(fetchCelldHealth, token, isChecking);
  return { health, ...state };
}
