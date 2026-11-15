import React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  formatCost,
  formatKWh,
  formatWatts,
  getEnergySummary,
  setEnergyPrice,
  type EnergySummary,
} from "@/services/energy";

// Decimal keypads in comma locales type "0,21".
const parsePrice = (value: string) => Number(value.trim().replace(",", "."));

const validatePrice = (value: string): string | null => {
  if (!value.trim()) return "Enter a price.";
  const price = parsePrice(value);
  if (!Number.isFinite(price)) return "Enter a valid number.";
  if (price < 0) return "Price cannot be negative.";
  if (price > 10) return "Price must be at most €10.";
  return null;
};

export default function EnergyCard({ token }: { token: string | null }) {
  const [summary, setSummary] = React.useState<EnergySummary | null>(null);
  const [draft, setDraft] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [attempted, setAttempted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async (signal?: AbortSignal, syncDraft = false) => {
    try {
      const loaded = await getEnergySummary(signal);
      if (signal?.aborted) return;
      setSummary(loaded);
      setLoadError("");
      if (syncDraft) setDraft(loaded.pricePerKWh === null ? "" : String(loaded.pricePerKWh));
    } catch (err) {
      if (!signal?.aborted) {
        setLoadError(err instanceof Error ? err.message : "Could not load estimated energy.");
      }
    }
  }, []);

  React.useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void load(controller.signal, true);
    // Matches the master's 10-second energy tick.
    const interval = setInterval(() => void load(controller.signal), 10000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [load, token]);

  const priceError = validatePrice(draft);
  const showValidation = (attempted || draft.trim() !== "") && !!priceError;
  const price = summary?.pricePerKWh ?? null;

  const save = async () => {
    setAttempted(true);
    setMessage("");
    const error = validatePrice(draft);
    if (error || !token) return;
    setSaving(true);
    try {
      const saved = await setEnergyPrice(parsePrice(draft));
      setSummary((prev) => (prev ? { ...prev, pricePerKWh: saved.pricePerKWh } : prev));
      setDraft(String(saved.pricePerKWh));
      setMessage("Saved");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save the price.");
    } finally {
      setSaving(false);
    }
  };

  return <Box className="rounded-2xl border border-outline-200 dark:border-[#1F2A3C] bg-background-0 dark:bg-[#0A1628] p-4 gap-4">
    <Box className="gap-0.5">
      <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">Estimated energy</Heading>
      <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Cluster totals</Text>
    </Box>

    {loadError ? <Text className="text-sm text-typography-500 dark:text-[#8A94A8]" numberOfLines={1}>{loadError}</Text> : null}
    {!summary && !loadError ? <Text className="text-sm text-typography-500 dark:text-[#8A94A8]">Loading…</Text> : null}

    {summary ? <>
      <HStack className="flex-row flex-wrap gap-3">
        <Box className="flex-1 min-w-[120px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
          <Text className="text-xs text-typography-600 dark:text-[#5EEAD4] uppercase font-semibold tracking-[0.08em]">Live</Text>
          <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{formatWatts(summary.totals.liveWatts)}</Text>
        </Box>
        <Box className="flex-1 min-w-[120px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
          <Text className="text-xs text-typography-600 dark:text-[#5EEAD4] uppercase font-semibold tracking-[0.08em]">This month</Text>
          <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{formatKWh(summary.totals.monthKWh)}</Text>
        </Box>
        {price !== null ? (
          <Box className="flex-1 min-w-[120px] rounded-xl bg-background-100/80 dark:bg-[#0E1A2B] p-3">
            <Text className="text-xs text-typography-600 dark:text-[#5EEAD4] uppercase font-semibold tracking-[0.08em]">This month cost</Text>
            <Text className="text-lg font-semibold text-typography-900 dark:text-[#E8EBF0]">{formatCost(summary.totals.monthCost)}</Text>
          </Box>
        ) : null}
      </HStack>

      {price === null ? <Text className="text-xs text-typography-500 dark:text-[#8A94A8]">Enter your electricity price to see costs.</Text> : null}

      <Box className="gap-2">
        <Text className="text-xs text-typography-600 dark:text-[#94A3B8]">Price per kWh (€)</Text>
        <HStack className="flex-row items-center gap-3">
          <Input variant="outline" className="flex-1 rounded-xl">
            <InputField
              accessibilityLabel="Price per kWh (€)"
              keyboardType="decimal-pad"
              value={draft}
              onChangeText={(value: string) => {
                setDraft(value);
                setMessage("");
              }}
              placeholder="e.g. 0.25"
            />
          </Input>
          <Button size="sm" isDisabled={saving} onPress={save} className="rounded-xl" style={{ minHeight: 44 }}>
            <ButtonText>{saving ? "Saving…" : "Save"}</ButtonText>
          </Button>
        </HStack>
        {showValidation ? <Text accessibilityRole="alert" className="text-xs text-error-700 dark:text-error-400">{priceError}</Text> : null}
        {message ? <Text accessibilityRole="alert" className="text-xs text-typography-600 dark:text-[#94A3B8]">{message}</Text> : null}
      </Box>

      <Text className="text-[11px] text-typography-500 dark:text-[#8A94A8]">Estimate from detected hardware and CPU load. GPUs are not counted.</Text>
    </> : null}
  </Box>;
}
