import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
} from "react-native";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import {useLogs} from "@/hooks/useLogs";
import {LogEntry, LogLevel} from "@/types/log";
import {useAppTheme} from "@/hooks/useAppTheme";

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  error: "#EF4444",
  warn: "#F59E0B",
  info: "#3B82F6",
  debug: "#22C55E",
};

const formatTime = (ts: string) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString("pt-PT", {hour: "2-digit", minute: "2-digit", second: "2-digit"});
};

type Theme = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  accent: string;
  accentText: string;
};

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 56,
      width: "100%",
      maxWidth: 1180,
      alignSelf: "center",
    },
    wrapper: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },
    subtitle: {
      color: theme.muted,
      marginBottom: 12,
    },
    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
    },
    sectionTitle: {
      color: theme.text,
      fontWeight: "700",
      marginBottom: 8,
      fontSize: 14,
    },
    filters: {
      marginBottom: 12,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    filterItem: {
      marginBottom: 10,
    },
    flexItem: {
      flex: 1,
      marginRight: 10,
    },
    smallColumn: {
      width: 150,
      marginRight: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
      color: theme.text,
      backgroundColor: theme.cardAlt,
    },
    smallInput: {
      width: 120,
    },
    rowInline: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    toggleItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    label: {
      color: theme.muted,
      marginRight: 8,
    },
    button: {
      backgroundColor: theme.accent,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
    },
    buttonText: {
      color: theme.accentText,
      fontWeight: "600",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.subtle,
      borderRadius: 10,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerText: {
      color: theme.muted,
      fontWeight: "700",
      fontSize: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
    },
    listContainer: {
      flex: 1,
    },
    listCard: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    levelDot: {
      width: 6,
      height: 16,
      borderRadius: 4,
      marginRight: 8,
    },
    time: {
      width: 96,
      color: theme.muted,
      fontSize: 12,
    },
    machine: {
      width: 112,
      color: theme.text,
      fontSize: 12,
    },
    levelTag: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginRight: 8,
    },
    levelTagText: {
      fontSize: 11,
      fontWeight: "700",
    },
    message: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
    },
    center: {
      paddingVertical: 20,
      alignItems: "center",
    },
    errorText: {
      color: "#DC2626",
    },
    empty: {
      color: theme.muted,
      textAlign: "center",
      paddingVertical: 20,
    },
    detailHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    detailTitle: {
      fontWeight: "700",
      color: theme.text,
      fontSize: 16,
    },
    detailMeta: {
      color: theme.muted,
      fontSize: 12,
      marginBottom: 6,
    },
    detailBodyScroll: {
      maxHeight: 220,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.cardAlt,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    detailBodyContent: {
      paddingBottom: 4,
    },
    detailBody: {
      color: theme.text,
      lineHeight: 20,
    },
    close: {
      color: theme.accent,
      fontWeight: "700",
    },
  });

export default function LogsScreen() {
  const {token, isChecking} = useAuthGuard();
  const {resolvedMode} = useAppTheme();
  const isDark = resolvedMode === "dark";
  const theme: Theme = React.useMemo(
    () => ({
      bg: isDark ? "#070D19" : "#F8FAFC",
      card: isDark ? "#0F172A" : "#FFFFFF",
      cardAlt: isDark ? "#0B1424" : "#F8FAFC",
      border: isDark ? "#1E2B3C" : "#E2E8F0",
      text: isDark ? "#E8EBF0" : "#0F172A",
      muted: isDark ? "#9AA4B8" : "#475569",
      subtle: isDark ? "#0B1424" : "#F1F5F9",
      accent: "#2563EB",
      accentText: "#FFFFFF",
    }),
    [isDark]
  );
  const styles = React.useMemo(() => makeStyles(theme), [theme]);

  const [search, setSearch] = React.useState("");
  const [limitInput, setLimitInput] = React.useState("100");
  const [limit, setLimit] = React.useState(5000);
  const [apiLevel, setApiLevel] = React.useState<string>("all");
  const [machineFilter, setMachineFilter] = React.useState<string>("all");
  const [showInfo, setShowInfo] = React.useState(false);
  const [showDebug, setShowDebug] = React.useState(false);
  const [selected, setSelected] = React.useState<LogEntry | null>(null);

  const levelNumber = apiLevel === "all" ? undefined : parseInt(apiLevel);

  const {logs, isLoading, isRefreshing, error, refresh} = useLogs({
    token,
    limit,
    level: levelNumber,
  });

  const visibleLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (!showInfo && log.level === "info") return false;
      if (!showDebug && log.level === "debug") return false;
      if (machineFilter !== "all" && log.machine !== machineFilter) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        log.message.toLowerCase().includes(term) ||
        log.machine.toLowerCase().includes(term) ||
        log.timestamp.toLowerCase().includes(term)
      );
    });
  }, [logs, showInfo, showDebug, machineFilter, search]);

  const refreshControl =
    Platform.OS === "web"
      ? undefined
      : (
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          tintColor={theme.text}
          colors={[theme.text]}
        />
      );

  const applyLimit = () => {
    const parsed = parseInt(limitInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      setLimit(parsed);
    }
  };

  const renderItem = ({item}: {item: LogEntry}) => (
    <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.6}>
      <View style={styles.row}>
        <View style={[styles.levelDot, {backgroundColor: LEVEL_COLOR[item.level]}]} />
        <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
        <Text style={styles.machine} numberOfLines={1}>
          {item.machine}
        </Text>
        <View style={[styles.levelTag, {borderColor: LEVEL_COLOR[item.level]}]}>
          <Text style={[styles.levelTagText, {color: LEVEL_COLOR[item.level]}]}>{LEVEL_LABEL[item.level]}</Text>
        </View>
        <Text style={styles.message} numberOfLines={1}>
          {item.message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isChecking || !token) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.screen}>
        <Text style={styles.title}>Logs</Text>
        <Text style={styles.subtitle}>
          Inline view ordered from newest to oldest. Tap a line to see details.
        </Text>

      <View style={[styles.card, styles.filters]}>
        <Text style={styles.sectionTitle}>Filters and controls</Text>

        <View style={styles.filterItem}>
          <Text style={styles.label}>Quick search</Text>
          <TextInput
            style={styles.input}
            placeholder="Filter by message, machine, or timestamp..."
            placeholderTextColor={theme.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={[styles.filterItem, styles.flexItem]}>
            <Text style={styles.label}>Machine</Text>
            <TextInput
              style={styles.input}
              placeholder="all for all"
              placeholderTextColor={theme.muted}
              value={machineFilter}
              onChangeText={setMachineFilter}
            />
          </View>
          <View style={[styles.filterItem, styles.smallColumn]}>
            <Text style={styles.label}>Level (API)</Text>
            <TextInput
              style={styles.input}
              placeholder="all/0/1/2/3"
              placeholderTextColor={theme.muted}
              value={apiLevel}
              onChangeText={setApiLevel}
            />
          </View>
          <View style={[styles.filterItem, styles.smallColumn]}>
            <Text style={styles.label}>Limit</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={limitInput}
              onChangeText={setLimitInput}
              onBlur={applyLimit}
              onSubmitEditing={applyLimit}
            />
          </View>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleItem}>
            <Text style={styles.label}>Show INFO</Text>
            <Switch value={showInfo} onValueChange={setShowInfo} />
          </View>
          <View style={styles.toggleItem}>
            <Text style={styles.label}>Show DEBUG</Text>
            <Switch value={showDebug} onValueChange={setShowDebug} />
          </View>
          <TouchableOpacity style={styles.button} onPress={refresh} activeOpacity={0.7}>
            <Text style={styles.buttonText}>Reload</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.headerRow}>
        <Text style={{width: 6}} />
        <Text style={[styles.headerText, {width: 96}]}>Time</Text>
        <Text style={[styles.headerText, {width: 112}]}>Machine</Text>
        <Text style={[styles.headerText, {width: 64}]}>Level</Text>
        <Text style={[styles.headerText, {flex: 1}]}>Message</Text>
      </View>

      <View style={styles.listContainer}>
        <View style={[styles.card, styles.listCard]}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.text} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={visibleLogs}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListEmptyComponent={<Text style={styles.empty}>No logs found</Text>}
              refreshControl={refreshControl}
              contentContainerStyle={{paddingBottom: 12}}
            />
          )}
        </View>
        </View>

        {selected ? (
          <View style={styles.card}>
            <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>Detalhe do log</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailMeta}>
            {formatTime(selected.timestamp)} • {selected.machine} • {LEVEL_LABEL[selected.level]}
          </Text>
          <ScrollView
            style={styles.detailBodyScroll}
            contentContainerStyle={styles.detailBodyContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.detailBody}>{selected.message}</Text>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}
