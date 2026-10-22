import React from "react";
import {useFocusEffect} from "expo-router";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Button, ButtonText} from "@/components/ui/button";
import {Select, SelectTrigger, SelectPortal, SelectBackdrop, SelectContent, SelectItem} from "@/components/ui/select";
import {getUpstreamCapabilities, listUpstreams, upstreamErrorMessage} from "@/services/upstreams";
import {Upstream, UpstreamContext} from "@/types/upstream";

type PoolsState = {pools: Upstream[]; error: string; loading: boolean; refresh: () => void};
const PoolsContext = React.createContext<PoolsState>({pools: [], error: "Pool data is unavailable. Reopen this page to retry.", loading: false, refresh: () => {}});
export const useUpstreamPools = () => React.useContext(PoolsContext);
export function UpstreamPoolsProvider({children}: React.PropsWithChildren) {
  const [pools, setPools] = React.useState<Upstream[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [version, setVersion] = React.useState(0);
  useFocusEffect(React.useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([listUpstreams(controller.signal), getUpstreamCapabilities(controller.signal)]).then(([items, capabilities]) => {
      if (controller.signal.aborted) return;
      setPools(items);
      setError(capabilities.status === "verified" ? "" : "Pool application is unavailable. Check the NPM image and recovery status.");
    }).catch(e => {if (!controller.signal.aborted) setError(upstreamErrorMessage(e));}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [version]));
  const refresh = React.useCallback(() => setVersion(v => v + 1), []);
  const state = React.useMemo(() => ({pools, error, loading, refresh}), [pools, error, loading, refresh]);
  return <PoolsContext.Provider value={state}>{children}</PoolsContext.Provider>;
}
export function UpstreamSelector({context, value, onChange, poolsState}: {context: UpstreamContext; value?: number | null; onChange: (id: number | null) => void; poolsState?: PoolsState}) {
  const inheritedState = useUpstreamPools();
  // Gluestack overlays reparent modal children outside the page provider.
  const {pools, error, loading, refresh} = poolsState ?? inheritedState;
  const compatible = pools.filter(p => p.context === context);
  const selected = compatible.find(p => p.id === value);
  return <Box className="gap-2">
    <Text className="font-semibold text-typography-900">Target</Text>
    <Select selectedValue={value ? String(value) : "direct"} onValueChange={v => onChange(v === "direct" ? null : Number(v))}>
      <SelectTrigger accessibilityLabel="Forwarding target" className="h-11 px-4 rounded-xl border-outline-200">
        <Text className="text-typography-900">{value ? selected?.name ?? `Pool #${value} (unavailable)` : "Direct host and port"}</Text>
      </SelectTrigger>
      <SelectPortal><SelectBackdrop/><SelectContent>
        <SelectItem label="Direct host and port" value="direct"/>
        {compatible.map(p => <SelectItem key={p.id} label={`${p.name} · ${p.server_arr.length} members · ${p.apply_status}`} value={String(p.id)} isDisabled={Boolean(error) || p.apply_status !== "applied"}/>)}
      </SelectContent></SelectPortal>
    </Select>
    {value && context === "http" ? <Text className="text-sm text-typography-600">HTTPS backends use the public hostname for SNI. Backend certificate verification is off by default; advanced configuration can set backend TLS policy.</Text> : null}
    {error ? <Text className="text-sm text-error-700">{error} You can retry or use a direct target.</Text> : null}
    <Button variant="link" size="sm" onPress={refresh} isDisabled={loading}><ButtonText>{loading ? "Loading pools…" : "Refresh pools"}</ButtonText></Button>
  </Box>;
}
export function upstreamTargetLabel(id: number | null | undefined, direct: string) {return id ? `Upstream #${id}` : direct;}
