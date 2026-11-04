import React from "react";
import { useColorScheme } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Skeleton } from "@/components/ui/skeleton";
import { DiskHealthDisk, DiskHealthSample } from "@/types/diskhealth";
import { BAND_RANGES, bandColor, bandLabel, bandTextColor, hasScore, powerOnText, remainingText } from "@/utils/diskhealth";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  Eye,
  Gauge,
  Layers,
  type LucideIcon,
  OctagonAlert,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  TriangleAlert,
} from "lucide-react-native";
import { cardClass, imageLabel, mutedText, strongText, tabularNumbers } from "./shared";

const BAND_ICON: Record<string, LucideIcon> = {
  good: ShieldCheck,
  watch: Eye,
  at_risk: TriangleAlert,
  critical: OctagonAlert,
};

// The active band stays solid so the scale reads as "which band, how close to the next".
function ScoreScale({ score, band }: { score: number; band: string }) {
  return (
    <Box aria-hidden className="mt-3">
      <Box style={{ height: 18, justifyContent: "flex-end" }}>
        <Box
          className="bg-typography-900 dark:bg-[#E8EBF0] rounded-full"
          style={{ position: "absolute", top: 0, left: `${score}%`, width: 3, height: 18, marginLeft: -1.5 }}
        />
        <HStack style={{ gap: 2, marginBottom: 4 }}>
          {BAND_RANGES.map((range) => (
            <Box
              key={range.band}
              style={{
                flex: range.to - range.from,
                height: 10,
                borderRadius: 2,
                backgroundColor: range.color,
                opacity: range.band === band ? 1 : 0.28,
              }}
            />
          ))}
        </HStack>
      </Box>
      <HStack style={{ gap: 2 }} className="mt-1">
        {BAND_RANGES.map((range, index) => (
          <HStack key={range.band} style={{ flex: range.to - range.from, justifyContent: "space-between" }}>
            <Text className={`text-xs ${mutedText}`} style={tabularNumbers}>
              {range.from}
            </Text>
            {index === BAND_RANGES.length - 1 ? (
              <Text className={`text-xs ${mutedText}`} style={tabularNumbers}>
                {range.to}
              </Text>
            ) : null}
          </HStack>
        ))}
      </HStack>
    </Box>
  );
}

export function ScoreHero({ disk }: { disk: DiskHealthDisk }) {
  const isDark = useColorScheme() === "dark";
  const scored = hasScore(disk);
  const score = scored ? disk.score : null;
  const tone = bandTextColor(scored ? disk.band : "", isDark);
  const BandIcon = (scored && BAND_ICON[disk.band]) || CircleHelp;
  const label = scored ? bandLabel(disk.band) : "No SMART data";
  const clean = scored && disk.reasons.length === 1 && disk.reasons[0] === "No problems found";
  const ReasonIcon = clean ? CircleCheck : CircleAlert;

  return (
    <Box className={cardClass} style={{ flexDirection: "row", flexWrap: "wrap", gap: 24, padding: 20 }}>
      <VStack
        {...imageLabel(score !== null ? `Health score ${score} of 100, ${label}` : `Health score unavailable, ${label}`)}
        style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, maxWidth: 420 }}
      >
        <Text className={`text-sm font-medium ${mutedText}`}>Health score</Text>
        {score !== null ? (
          <HStack className="items-baseline gap-2">
            <Text className="text-[56px] leading-[64px] font-bold" style={{ color: tone, ...tabularNumbers }}>
              {score}
            </Text>
            <Text className={`text-base ${mutedText}`}>/ 100</Text>
          </HStack>
        ) : null}
        <HStack className={`items-center gap-1.5 ${score === null ? "mt-1" : ""}`}>
          <BandIcon size={18} color={tone} />
          <Text className="text-base font-semibold" style={{ color: tone }}>
            {label}
          </Text>
        </HStack>
        {score !== null ? <ScoreScale score={score} band={disk.band} /> : null}
      </VStack>

      {disk.reasons.length ? (
        <VStack className="gap-2" style={{ flexGrow: 2, flexShrink: 1, flexBasis: 300, minWidth: 0 }}>
          <Text className={`text-sm font-medium ${mutedText}`}>{scored ? "Why this score" : "Details"}</Text>
          {disk.reasons.map((reason) => (
            <HStack key={reason} className="items-start gap-2">
              <Box style={{ marginTop: 2 }}>
                <ReasonIcon size={16} color={scored ? bandTextColor(clean ? "good" : disk.band, isDark) : tone} />
              </Box>
              <Text className={`text-sm flex-1 ${strongText}`}>{reason}</Text>
            </HStack>
          ))}
        </VStack>
      ) : null}
    </Box>
  );
}

function ReadingTile({
  icon: Icon,
  label,
  value,
  note,
  noteColor,
  meter,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
  noteColor?: string;
  meter?: number;
}) {
  const isDark = useColorScheme() === "dark";
  return (
    <Box className={cardClass} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 150 }}>
      <HStack className="items-center gap-1.5">
        <Icon size={14} color={isDark ? "#9AA4B8" : "#475569"} />
        <Text className={`text-xs ${mutedText}`}>{label}</Text>
      </HStack>
      <Text className={`text-xl font-semibold mt-1 ${strongText}`} style={tabularNumbers}>
        {value}
      </Text>
      {meter !== undefined ? (
        <Box aria-hidden className="h-1.5 rounded-full mt-1.5 bg-background-100 dark:bg-[#1E2F47] overflow-hidden">
          <Box className="h-full rounded-full" style={{ width: `${Math.min(meter, 100)}%`, backgroundColor: isDark ? "#A78BFA" : "#7C3AED" }} />
        </Box>
      ) : null}
      {note ? (
        <Text className={`text-xs mt-1 ${noteColor ? "" : mutedText}`} style={noteColor ? { color: noteColor } : undefined}>
          {note}
        </Text>
      ) : null}
    </Box>
  );
}

const verdictText = (latest: DiskHealthSample) => {
  if (!latest.smartPassed) return "Failed";
  return latest.healthStatus ? "Passed" : "Not reported";
};

const wearNote = (disk: DiskHealthDisk) => {
  if (disk.pastRatedEndurance) return "Past rated endurance";
  const at = disk.wearOutAt ? Date.parse(disk.wearOutAt) : NaN;
  return Number.isFinite(at) ? `${remainingText(at - Date.now())} left (estimate)` : undefined;
};

export function ReadingTiles({ disk, latest, flash }: { disk: DiskHealthDisk; latest: DiskHealthSample; flash: boolean }) {
  const isDark = useColorScheme() === "dark";
  const alertColor = bandTextColor("critical", isDark);
  const hasSpare = latest.availableSpare > 0 || latest.availableSpareThreshold > 0;

  return (
    <VStack className="gap-2">
      {!disk.smartAvailable ? <Text className={`text-xs ${mutedText}`}>Last known values — this disk does not report SMART.</Text> : null}
      <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <ReadingTile icon={Thermometer} label="Temperature" value={latest.temperatureC ? `${latest.temperatureC} °C` : "—"} />
        <ReadingTile
          icon={Clock}
          label="Power-on time"
          value={`${latest.powerOnHours.toLocaleString()} h`}
          note={latest.powerOnHours >= 48 ? powerOnText(latest.powerOnHours) : undefined}
        />
        <ReadingTile
          icon={latest.smartPassed && !latest.selfTestFailed ? ShieldCheck : ShieldAlert}
          label="SMART verdict"
          value={verdictText(latest)}
          note={latest.selfTestFailed ? "Latest self-test failed" : undefined}
          noteColor={latest.selfTestFailed ? alertColor : undefined}
        />
        {flash ? (
          <ReadingTile
            icon={Gauge}
            label="Wear"
            value={`${latest.percentageUsed}%`}
            meter={latest.percentageUsed}
            note={wearNote(disk)}
            noteColor={disk.pastRatedEndurance ? alertColor : undefined}
          />
        ) : null}
        {flash && hasSpare ? (
          <ReadingTile
            icon={Layers}
            label="Available spare"
            value={`${latest.availableSpare}%`}
            note={latest.availableSpareThreshold ? `Threshold ${latest.availableSpareThreshold}%` : undefined}
          />
        ) : null}
      </Box>
    </VStack>
  );
}

// Same blocks as the loaded page, so the content does not jump when it arrives.
export function DiskHealthSkeleton() {
  return (
    <VStack className="gap-5" role="status" aria-label="Loading disk health">
      <VStack className="gap-2">
        <Skeleton className="h-7 w-1/2 rounded-lg" />
        <Skeleton className="h-4 w-1/3 rounded-lg" />
      </VStack>
      <Skeleton className="h-52 rounded-2xl" />
      <HStack className="gap-3">
        <Skeleton className="h-24 flex-1 rounded-2xl" />
        <Skeleton className="h-24 flex-1 rounded-2xl" />
        <Skeleton className="h-24 flex-1 rounded-2xl" />
      </HStack>
      <Skeleton className="h-72 rounded-2xl" />
    </VStack>
  );
}
