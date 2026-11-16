import React from "react";
import { Pressable, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { formatEnergy, getEnergySummary, parseEnergyPrice, projectionText, setEnergyPrice, type EnergySummary } from "@/services/energy";

const REFRESH_MS = 10_000; // the master samples every 10 seconds

const muted = "text-xs text-typography-500 dark:text-[#8A94A8]";
const strong = "text-typography-900 dark:text-[#E8EBF0]";

// Estimated cluster power, this month's energy and cost. token comes from useAuthGuard:
// loading waits for it because the API base URL is restored with the session.
export default function EnergyCard({ token }: { token: string | null }) {
  const [summary, setSummary] = React.useState<EnergySummary | null>(null);
  const [price, setPrice] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async (signal?: AbortSignal, syncPrice = false) => {
    try {
      const loaded = await getEnergySummary(signal);
      if (signal?.aborted) return;
      setSummary(loaded);
      setLoadError("");
      if (syncPrice && loaded.pricePerKWh != null) setPrice(String(loaded.pricePerKWh));
    } catch (err) {
      if (!signal?.aborted) setLoadError(err instanceof Error ? err.message : "Could not load the energy estimate.");
    }
  }, []);

  React.useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void load(controller.signal, true);
    const interval = setInterval(() => void load(controller.signal), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [load, token]);

  const parsed = parseEnergyPrice(price);
  const hasPrice = summary?.pricePerKWh != null;
  const changed = parsed != null && parsed !== summary?.pricePerKWh;

  const save = async () => {
    if (parsed == null) return;
    setSaving(true);
    setMessage("");
    try {
      await setEnergyPrice(parsed);
      setMessage("Saved");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return <Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-4">
    <Box className="gap-0.5">
      <Heading size="md" className={strong}>Power and cost</Heading>
      <Text className={muted}>Estimated from hardware and CPU load, not measured</Text>
    </Box>

    {loadError ? <Text role="alert" className="text-sm text-error-700 dark:text-error-400">{loadError}</Text> : null}
    {!summary && !loadError ? <Text className="text-sm text-typography-500 dark:text-[#8A94A8]">Loading…</Text> : null}

    {summary ? <>
      <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
        {[
          ["Now", `~${Math.round(summary.totals.liveWatts)} W`],
          ["This month", `${summary.totals.monthKWh.toFixed(1)} kWh`],
          ["Cost this month", hasPrice ? `€${summary.totals.monthCost.toFixed(2)}` : "Set a price"],
          ["Projected this month", projectionText(summary.totals, hasPrice)],
        ].map(([label, value]) => value == null ? null : <Box key={label} className="gap-0.5">
          <Text className={muted}>{label}</Text>
          <Text className={`text-xl font-semibold ${strong}`}>{value}</Text>
        </Box>)}
      </Box>

      {summary.months?.length ? <EnergyMonthsChart months={summary.months} hasPrice={hasPrice} /> : null}

      {summary.machines.length ? <Box className="gap-1">
        {summary.machines.map((m) => <Box key={m.machine} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 12 }}>
          <Text className={`text-sm ${strong}`}>{m.machine}</Text>
          <Text className="text-sm text-typography-600 dark:text-[#94A3B8]">
            {formatEnergy(m, hasPrice)}{projectionText(m, hasPrice) ? ` · projected ${projectionText(m, hasPrice)}` : ""}{m.cpuEstimate === "generic" ? " · generic CPU guess" : ""}
          </Text>
        </Box>)}
      </Box> : <Text className={muted}>No machine has reported power data yet. Slaves need the current version.</Text>}

      <Box className="flex-row flex-wrap items-end gap-3">
        <Box className="gap-1" style={{ width: 140 }}>
          <Text className={muted}>Price per kWh (€)</Text>
          <Input variant="outline" className="rounded-lg">
            <InputField aria-label="Price per kWh in euros" keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="0.22" />
          </Input>
        </Box>
        <Button size="sm" isDisabled={saving || !changed} onPress={save} className="rounded-xl" style={{ minHeight: 44 }}>
          <ButtonText>{saving ? "Saving…" : "Save"}</ButtonText>
        </Button>
        {price.trim() && parsed == null ? <Text role="alert" className="text-xs text-error-700 dark:text-error-400">Enter a price from 0 to 10.</Text> : null}
        {message ? <Text role="alert" className="text-xs text-typography-600 dark:text-[#94A3B8]">{message}</Text> : null}
      </Box>
    </> : null}
  </Box>;
}

const CHART_HEIGHT = 72;

// One column per month. Heights are relative to the highest month, so the tallest column fills the chart.
function EnergyMonthsChart({ months, hasPrice }: { months: NonNullable<EnergySummary["months"]>; hasPrice: boolean }) {
  const max = Math.max(...months.map((m) => m.kWh));
  // Hovering (or tapping, on touch) a column shows its value in the caption line.
  const [active, setActive] = React.useState<string | null>(null);
  const narrow = useWindowDimensions().width < 640; // twelve short names do not fit a phone
  return <Box className="gap-1">
    <Text className={active ? `text-xs ${strong}` : muted}>{active ?? `Last 12 months${max > 0 ? ` · peak ${max.toFixed(1)} kWh` : ""}`}</Text>
    <Box style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
      {months.map((m, i) => {
        const [year, month] = m.month.split("-").map(Number);
        const name = new Date(year, month - 1, 1).toLocaleString(undefined, { month: "short" });
        const label = `${name} ${year}: ${m.kWh.toFixed(1)} kWh${hasPrice ? `, €${m.cost.toFixed(2)}` : ""}`;
        const current = i === months.length - 1;
        return <Pressable key={m.month} role="img" aria-label={label} onHoverIn={() => setActive(label)} onHoverOut={() => setActive(null)} onPress={() => setActive((a) => (a === label ? null : label))} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4 }}>
          <Box style={{ height: CHART_HEIGHT, width: "100%", justifyContent: "flex-end" }}>
            <Box
              className={current || active === label ? "bg-primary-500" : "bg-primary-300 dark:bg-[#2B4A7A]"}
              style={{ height: max > 0 && m.kWh > 0 ? Math.max(2, (m.kWh / max) * CHART_HEIGHT) : 0, borderRadius: 3 }}
            />
          </Box>
          <Text className="text-[10px] text-typography-500 dark:text-[#8A94A8]">{narrow ? name.slice(0, 1) : name}</Text>
        </Pressable>;
      })}
    </Box>
  </Box>;
}
