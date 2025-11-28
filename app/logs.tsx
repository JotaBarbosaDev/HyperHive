import React from "react";
import {ScrollView, RefreshControl, useColorScheme, Pressable} from "react-native";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {VStack} from "@/components/ui/vstack";
import {HStack} from "@/components/ui/hstack";
import {Input, InputField, InputSlot, InputIcon} from "@/components/ui/input";
import {Badge, BadgeText} from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
} from "@/components/ui/select";
import {Icon, ChevronDownIcon} from "@/components/ui/icon";
import {AlertCircle, AlertTriangle, CheckCircle, Info, Search} from "lucide-react-native";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";

// Tipos de Log
type LogLevel = "error" | "warning" | "success" | "info";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  machine: string;
  message: string;
}

// Mock Data Realista
const MOCK_LOGS: LogEntry[] = [
  {
    id: "log-001",
    timestamp: "2025-11-28 14:32:15",
    level: "error",
    machine: "node-01",
    message: "Failed to scrub RAID: disk /dev/sdb not responding",
  },
  {
    id: "log-002",
    timestamp: "2025-11-28 14:28:03",
    level: "success",
    machine: "node-02",
    message: "VM vm-web-01 started successfully",
  },
  {
    id: "log-003",
    timestamp: "2025-11-28 14:15:42",
    level: "warning",
    machine: "node-01",
    message: "Disk /dev/sdc temperature: 45°C (high)",
  },
  {
    id: "log-004",
    timestamp: "2025-11-28 13:58:21",
    level: "info",
    machine: "node-03",
    message: "Automatic backup completed for vm-db-01",
  },
  {
    id: "log-005",
    timestamp: "2025-11-28 13:45:09",
    level: "error",
    machine: "node-02",
    message: "Network timeout: failed to mount NFS share //10.0.0.5/backups",
  },
  {
    id: "log-006",
    timestamp: "2025-11-28 13:30:55",
    level: "info",
    machine: "node-01",
    message: "Scheduled maintenance completed: system updated to latest version",
  },
];

export default function LogsScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const [logs, setLogs] = React.useState<LogEntry[]>(MOCK_LOGS);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState<LogLevel | "all">("all");

  // Helper: Retorna ícone colorido por nível
  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case "error":
        return <AlertCircle size={16} className="text-[#DC2626]" />;
      case "warning":
        return <AlertTriangle size={16} className="text-[#EAB308]" />;
      case "success":
        return <CheckCircle size={16} className="text-[#16A34A]" />;
      case "info":
        return <Info size={16} className="text-[#3B82F6]" />;
    }
  };

  // Helper: Retorna badge colorido por nível
  const getLevelBadge = (level: LogLevel) => {
    const configs = {
      error: {bg: "#FEE2E2", text: "#991B1B", label: "ERROR"},
      warning: {bg: "#FEF3C7", text: "#92400E", label: "WARNING"},
      success: {bg: "#DCFCE7", text: "#166534", label: "SUCCESS"},
      info: {bg: "#DBEAFE", text: "#1E40AF", label: "INFO"},
    };

    const config = configs[level];
    return (
      <Badge
        size="sm"
        variant="solid"
        className="rounded-sm px-2 py-0.5"
        style={{backgroundColor: config.bg}}
      >
        <BadgeText className="text-xs" style={{color: config.text, fontFamily: "Inter_600SemiBold"}}>
          {config.label}
        </BadgeText>
      </Badge>
    );
  };

  // Filtros Combinados
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    const matchesSearch =
      searchTerm === "" ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.machine.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise((res) => setTimeout(res, 800));
    setLoading(false);
    toast.show({
      placement: "top",
      render: ({id}) => (
        <Toast
          nativeID={"toast-" + id}
          className="px-5 py-3 gap-3 shadow-soft-1 items-center flex-row"
          action="success"
        >
          <ToastTitle size="sm">Logs atualizados</ToastTitle>
        </Toast>
      ),
    });
  };

  const refreshControlTint = colorScheme === "dark" ? "#F8FAFC" : "#0F172A";
  const refreshControlBackground = colorScheme === "dark" ? "#0E1524" : "#E2E8F0";

  return (
    <Box className="flex-1 bg-background-50 dark:bg-[#070D19] web:bg-background-0">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={refreshControlTint}
            colors={[refreshControlTint]}
            progressBackgroundColor={refreshControlBackground}
          />
        }
      >
        <Box className="p-4 pt-16 web:p-10 web:max-w-7xl web:mx-auto web:w-full">
          <Heading
            size="2xl"
            className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl"
            style={{fontFamily: "Inter_700Bold"}}
          >
            Logs
          </Heading>
          <Text className="text-typography-600 dark:text-typography-400 text-sm web:text-base max-w-3xl mb-6">
            Visualize logs do sistema em tempo real com filtros por nível de severidade e busca por mensagem ou
            máquina.
          </Text>

          {/* Filtros Responsivos */}
          <VStack className="gap-3 mb-6 web:flex-row web:items-center">
            {/* Search Input */}
            <Input
              variant="outline"
              size="md"
              className="flex-1 rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
            >
              <InputSlot className="pl-3">
                <InputIcon as={Search} className="text-typography-400" />
              </InputSlot>
              <InputField
                placeholder="Buscar por mensagem ou máquina..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                className="text-typography-900 dark:text-[#E8EBF0]"
              />
            </Input>

            {/* Select Nível */}
            <Select selectedValue={levelFilter} onValueChange={(value) => setLevelFilter(value as LogLevel | "all")}>
              <SelectTrigger
                variant="outline"
                size="md"
                className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] web:w-[200px]"
              >
                <SelectInput
                  placeholder="Todos os níveis"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                  style={{fontFamily: "Inter_400Regular"}}
                />
                <SelectIcon className="mr-3" as={ChevronDownIcon} />
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
                <SelectContent className="bg-background-0 dark:bg-[#151F30] border border-outline-100 dark:border-[#2A3B52] rounded-xl">
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>
                  <SelectItem label="Todos os níveis" value="all" />
                  <SelectItem label="Error" value="error" />
                  <SelectItem label="Warning" value="warning" />
                  <SelectItem label="Success" value="success" />
                  <SelectItem label="Info" value="info" />
                </SelectContent>
              </SelectPortal>
            </Select>
          </VStack>

          {/* Lista de Cards de Log */}
          {filteredLogs.length === 0 ? (
            <Box className="py-12 items-center">
              <Text
                className="text-sm text-typography-500 dark:text-typography-400"
                style={{fontFamily: "Inter_400Regular"}}
              >
                Nenhum log encontrado
              </Text>
            </Box>
          ) : (
            <VStack className="gap-3">
              {filteredLogs.map((log) => (
                <Pressable key={log.id}>
                  <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#151F30] p-4 active:bg-background-50 dark:active:bg-[#0A1628]">
                    <HStack className="gap-3 items-start">
                      {/* Ícone Colorido */}
                      <Box className="mt-0.5">{getLevelIcon(log.level)}</Box>

                      {/* Conteúdo */}
                      <VStack className="flex-1 gap-2">
                        {/* Linha 1: Timestamp + Badges */}
                        <HStack className="items-center gap-2 flex-wrap">
                          <Text
                            className="text-xs text-typography-500 dark:text-typography-400"
                            style={{fontFamily: "Inter_500Medium"}}
                          >
                            {log.timestamp}
                          </Text>
                          <Badge
                            size="sm"
                            variant="outline"
                            action="muted"
                            className="rounded-sm border-outline-200 dark:border-[#2A3B52]"
                          >
                            <BadgeText
                              className="text-xs text-typography-600 dark:text-typography-400"
                              style={{fontFamily: "Inter_400Regular"}}
                            >
                              {log.machine}
                            </BadgeText>
                          </Badge>
                          {getLevelBadge(log.level)}
                        </HStack>

                        {/* Linha 2: Mensagem */}
                        <Text
                          className="text-sm text-typography-900 dark:text-[#E8EBF0]"
                          style={{fontFamily: "Inter_400Regular"}}
                        >
                          {log.message}
                        </Text>
                      </VStack>
                    </HStack>
                  </Box>
                </Pressable>
              ))}
            </VStack>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
