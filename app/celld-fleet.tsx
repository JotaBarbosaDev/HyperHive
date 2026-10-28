import React from "react";
import { ScrollView } from "react-native";
import { Plus, RefreshCw } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useMachines } from "@/hooks/useMachines";
import { useCelldFleets } from "@/hooks/useCelldFleets";
import { celldSummary } from "@/utils/celld-summary";
import { getCelldFleet, runCelldAction, saveCelldFleet } from "@/services/celld";
import type { CelldAction, CelldDetailTab, CelldFleet } from "@/types/celld";
import { FleetHistoryModal } from "@/components/celld/FleetHistoryModal";
import { Field, Control } from "@/components/celld/FleetObservability";
import { FleetCard } from "@/components/celld/FleetCard";
import { FleetFormModal } from "@/components/celld/FleetFormModal";
import { FleetDetailsModal } from "@/components/celld/FleetDetailsModal";
import { FleetActionModal } from "@/components/celld/FleetActionModal";
import { cardClassName, ErrorMessage, mutedClassName, observedAt, StatusBadge, titleClassName } from "@/components/celld/shared";

export default function CelldFleetScreen() {
  const { token, isChecking } = useAuthGuard();
  const { data, setData, isLoading, isRefreshing, error, refresh } = useCelldFleets(token, isChecking);
  const { machines, error: machinesError, refresh: refreshMachines } = useMachines(token);
  const [showHistory, setShowHistory] = React.useState(false);
  const [detailsTab, setDetailsTab] = React.useState<CelldDetailTab>("overview");
  const [historyDraft, setHistoryDraft] = React.useState("");
  const [historyId, setHistoryId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<"create" | CelldFleet | null>(null);
  const [detailsId, setDetailsId] = React.useState<string | null>(null);
  const [confirmation, setConfirmation] = React.useState<{ fleet: CelldFleet; action: CelldAction } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState("");
  const [showBuckets, setShowBuckets] = React.useState(false);
  const requests = React.useRef(new Set<AbortController>());
  React.useEffect(() => () => { requests.current.forEach((request) => request.abort()); }, [token]);
  React.useEffect(() => {
    if (detailsId && data && !data.fleets.some((fleet) => fleet.id === detailsId)) setDetailsId(null);
  }, [data, detailsId]);

  const invoke = async <T,>(job: (signal: AbortSignal) => Promise<T>) => {
    const request = new AbortController(); requests.current.add(request);
    const timeout = setTimeout(() => request.abort(), 20000);
    try { return await job(request.signal); }
    catch (err) { if (request.signal.aborted) throw new Error("The request timed out. Refresh to check whether it was accepted before trying again."); throw err; }
    finally { clearTimeout(timeout); requests.current.delete(request); }
  };
  const performAction = async (fleet: CelldFleet, action: CelldAction) => {
    if (!token) return;
    setBusy(fleet.id); setActionError(null); setNotice("");
    try {
      await invoke((signal) => runCelldAction(token, fleet.id, action, signal));
      setNotice((action === "delete" ? "Deletion" : action[0].toUpperCase() + action.slice(1)) + " accepted for " + fleet.name + ". Progress is shown below.");
      await refresh(true); setConfirmation(null);
    } finally { setBusy(null); }
  };
  const action = (fleet: CelldFleet, selected: CelldAction) => {
    if (selected !== "start") { setConfirmation({ fleet, action: selected }); return; }
    void performAction(fleet, selected).catch((err) => setActionError(err instanceof Error ? err.message : "Unable to start the fleet."));
  };
  const details = async (fleet: CelldFleet) => {
    setDetailsTab("deployment");
    if (!token) return;
    setBusy(fleet.id); setActionError(null);
    try {
      const current = await invoke((signal) => getCelldFleet(token, fleet.id, signal));
      setData((previous) => previous ? { ...previous, fleets: previous.fleets.map((item) => item.id === current.id ? current : item) } : previous);
      setDetailsId(current.id);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to load fleet details."); }
    finally { setBusy(null); }
  };

  if (isChecking || !token) return null;
  const fleets = data?.fleets ?? [];
  const selected = fleets.find((fleet) => fleet.id === detailsId);
  const expected = fleets.filter((fleet) => fleet.desired_state === "running");
  const summary = celldSummary(data, error);
  const machineNames = [...new Set([...machines.map((machine) => machine.MachineName), ...fleets.flatMap((fleet) => fleet.servers.map((node) => node.name))])];

  return <Box className="flex-1 bg-background-0 dark:bg-[#070D19]">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
      <Box className="px-4 md:px-12 lg:px-20 pt-20 pb-12 web:max-w-7xl web:mx-auto web:w-full gap-6">
        <Box className="flex-col sm:flex-row justify-between items-start gap-4">
          <Box className="gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
            <Heading size="2xl" className={titleClassName + " web:text-4xl"} style={{ fontFamily: "Inter_700Bold" }}>celld Fleets</Heading>
            <Text className={mutedClassName}>Manage independent fleets across your servers. Each fleet keeps its own processes, ports and storage.</Text>
          </Box>
          <Button className="rounded-xl h-11 gap-2" isDisabled={!data || data.reset_pending || Boolean(busy)} onPress={() => { setNotice(""); setForm("create"); }}>
            <ButtonIcon as={Plus} /><ButtonText>Create fleet</ButtonText>
          </Button>
        </Box>
        <Box className="flex-row flex-wrap justify-between items-center gap-3">
          <Box className="flex-row items-center gap-2"><Text className={mutedClassName}>Fleet service</Text><StatusBadge value={summary.service} /></Box>
          <Button className="rounded-xl gap-2" variant="outline" action="secondary" isDisabled={isRefreshing} onPress={() => { void refresh(); void refreshMachines(); }}>
            {isRefreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} />}<ButtonText>{isRefreshing ? "Refreshing…" : "Refresh"}</ButtonText>
          </Button>
        </Box>
        <ErrorMessage message={error} />
        {error && data ? <Text className={mutedClassName}>The information below is the last successful report. Refresh to check current progress.</Text> : null}
        <ErrorMessage message={actionError} />
        {notice ? <Box aria-live="polite" className="p-4 rounded-xl bg-primary-50 dark:bg-[#12263F]"><Text className={titleClassName}>{notice}</Text></Box> : null}
        {data?.reset_pending ? <Box role="alert" className="p-4 rounded-xl bg-amber-50 dark:bg-[#261F10] gap-2">
          <Heading size="sm" className={titleClassName}>Legacy cleanup in progress</Heading>
          <Text className={mutedClassName}>New fleets can be created once all remembered agents have removed the old fleet and its data. Offline agents keep cleanup pending.</Text>
        </Box> : null}
        <ErrorMessage message={data?.error} />
        {isLoading ? <Box className={cardClassName}><Text accessibilityLiveRegion="polite" className={mutedClassName}>Loading fleets…</Text></Box> : data ? <>
          <Box className="flex-col md:flex-row gap-4">
            <Box className={cardClassName + " md:flex-1 gap-3"}>
              <Box className="flex-row justify-between items-center gap-3"><Heading size="md" className={titleClassName}>Fleets</Heading><StatusBadge value={summary.runtime} /></Box>
              <Text className={titleClassName + " text-3xl font-semibold"}>{fleets.length}</Text>
              <Text className={mutedClassName}>{expected.length} expected to run · {fleets.filter((fleet) => fleet.status === "stopped").length} stopped. Workload health is not assessed here.</Text>
            </Box>
            <Box className={cardClassName + " md:flex-1 gap-3"}>
              <Box className="flex-row justify-between items-center gap-3"><Heading size="md" className={titleClassName}>SILO storage</Heading><StatusBadge value={error ? "unknown" : data.storage.healthy ? "connected" : "unavailable"} /></Box>
              <Text className={titleClassName + " text-3xl font-semibold"}>{data.storage.bucket_count === null ? "Unknown" : data.storage.bucket_count} <Text className={mutedClassName}>buckets</Text></Text>
              <Text className={mutedClassName}>{data.storage.managed_bucket_count} managed fleets · Checked: {observedAt(data.storage.checked_at)}</Text>
              <ErrorMessage message={data.storage.error} />
              {data.storage.buckets?.length ? <Box className="gap-2">
                <Button className="self-start rounded-xl" size="sm" variant="outline" action="secondary" onPress={() => setShowBuckets((value) => !value)}><ButtonText>{showBuckets ? "Hide bucket names" : "Show bucket names"}</ButtonText></Button>
                {showBuckets ? <Text selectable className={mutedClassName}>{data.storage.buckets.join(" · ")}</Text> : null}
              </Box> : data.storage.bucket_count === 0 ? <Text className={mutedClassName}>No buckets found.</Text> : null}
            </Box>
          </Box>
          {fleets.length === 0 ? <Box className={cardClassName + " items-start gap-3"}>
            <Heading size="md" className={titleClassName}>Create your first fleet</Heading>
            <Text className={mutedClassName}>Select one or more servers to provision an isolated bucket and start your application runtime.</Text>
          </Box> : <Box className="gap-4">{fleets.map((fleet) => <FleetCard key={fleet.id} fleet={fleet} busy={Boolean(busy)} onInspect={(tab) => { setDetailsTab(tab); setDetailsId(fleet.id); }} onDetails={() => { void details(fleet); }} onEdit={() => setForm(fleet)} onAction={(selectedAction) => action(fleet, selectedAction)} />)}</Box>}
        </> : null}
        <Control label={showHistory ? "Hide deleted fleet history" : "Find a deleted fleet"} onPress={() => setShowHistory((value) => !value)} />
        {showHistory ? <>
        <Box className={cardClassName + " gap-3"}><Heading size="sm" className={titleClassName}>Deleted fleet history</Heading><Text className={mutedClassName}>Use the ID only for a deleted fleet that no longer has a card. History may expire before 7 days.</Text><Box className="flex-row flex-wrap items-end gap-3"><Field label="Deleted fleet ID" value={historyDraft} onChange={setHistoryDraft} /><Control label="Open history" disabled={!historyDraft.trim()} onPress={() => setHistoryId(historyDraft.trim())} /></Box></Box>
        </> : null}
      </Box>
    </ScrollView>
    {historyId ? <FleetHistoryModal key={historyId} fleetId={historyId} token={token} onClose={() => setHistoryId(null)} /> : null}
    {form ? <FleetFormModal key={form === "create" ? "create" : form.id} fleet={form === "create" ? undefined : form} machines={machineNames} machinesError={machinesError} onClose={() => setForm(null)} onSave={async (input) => {
      const result = await invoke((signal) => saveCelldFleet(token, input, form === "create" ? undefined : form.id, signal));
      setNotice("Changes accepted for " + result.name + ". Provisioning continues in the background."); await refresh(true); setForm(null);
    }} /> : null}
    {selected ? <FleetDetailsModal key={selected.id + detailsTab} initialTab={detailsTab} fleet={selected} token={token} onClose={() => setDetailsId(null)} /> : null}
    {confirmation ? <FleetActionModal fleet={confirmation.fleet} action={confirmation.action} onClose={() => setConfirmation(null)} onConfirm={() => performAction(confirmation.fleet, confirmation.action)} /> : null}
  </Box>;
}
