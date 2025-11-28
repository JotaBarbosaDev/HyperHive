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
import {AlertCircle, AlertTriangle, CheckCircle, Info, Search, Settings2} from "lucide-react-native";
import {Toast, ToastTitle, useToast} from "@/components/ui/toast";
import {useLogs} from "@/hooks/useLogs";
import {LogEntry, LogLevel, LOG_LEVEL_MAP} from "@/types/log";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import {Spinner} from "@/components/ui/spinner";

export default function LogsScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const {token} = useAuthGuard();
  
  // Configurações de filtro
  const [limit, setLimit] = React.useState(200);
  const [levelFilter, setLevelFilter] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  
  // Handler para mudança de nível
  const handleLevelChange = (value: string) => {
    console.log('Level dropdown changed to:', value);
    setLevelFilter(value);
  };
  
  // Converter levelFilter para número ou undefined
  const levelNumber = levelFilter === "all" ? undefined : parseInt(levelFilter);
  
  // Buscar logs com os filtros
  const {logs, isLoading, isRefreshing, error, refresh} = useLogs({
    token,
    limit,
    level: levelNumber,
  });

  // Filtro de busca local
  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (searchTerm === "") return true;
      
      const search = searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(search) ||
        log.machine.toLowerCase().includes(search) ||
        log.timestamp.toLowerCase().includes(search)
      );
    });
  }, [logs, searchTerm]);

  // Debug
  React.useEffect(() => {
    console.log('Level filter changed:', {levelFilter, levelNumber});
    console.log('Total logs loaded:', logs.length);
  }, [levelFilter, levelNumber, logs.length]);

  // Helper: Retorna ícone colorido por nível
  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case "error":
        return <AlertCircle size={16} className="text-[#DC2626]" />;
      case "warn":
        return <AlertTriangle size={16} className="text-[#EAB308]" />;
      case "debug":
        return <CheckCircle size={16} className="text-[#16A34A]" />;
      case "info":
      default:
        return <Info size={16} className="text-[#3B82F6]" />;
    }
  };

  // Helper: Retorna badge colorido por nível
  const getLevelBadge = (level: LogLevel) => {
    const configs: Record<LogLevel, {bg: string; text: string; label: string}> = {
      error: {bg: "#FEE2E2", text: "#991B1B", label: "ERROR"},
      warn: {bg: "#FEF3C7", text: "#92400E", label: "WARN"},
      debug: {bg: "#DCFCE7", text: "#166534", label: "DEBUG"},
      info: {bg: "#DBEAFE", text: "#1E40AF", label: "INFO"},
    };

    const config = configs[level] || configs.info;
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

  const handleRefresh = async () => {
    await refresh();
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
            refreshing={isRefreshing}
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
          <VStack className="gap-3 mb-6">
            <HStack className="gap-3 web:items-center flex-wrap">
              {/* Search Input */}
              <Input
                variant="outline"
                size="md"
                className="flex-1 min-w-[200px] rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"
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
              <Select 
                selectedValue={levelFilter} 
                onValueChange={handleLevelChange}
              >
                <SelectTrigger
                  variant="outline"
                  size="md"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] web:w-[180px]"
                >
                  <SelectInput
                    placeholder="Nível"
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
                    <SelectItem label="Info" value="0" />
                    <SelectItem label="Error" value="1" />
                    <SelectItem label="Warn" value="2" />
                    <SelectItem label="Debug" value="3" />
                  </SelectContent>
                </SelectPortal>
              </Select>

              {/* Select Limite */}
              <Select 
                selectedValue={limit.toString()} 
                onValueChange={(value) => setLimit(parseInt(value))}
              >
                <SelectTrigger
                  variant="outline"
                  size="md"
                  className="rounded-lg border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] web:w-[150px]"
                >
                  <SelectInput
                    placeholder="Limite"
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
                    <SelectItem label="50 logs" value="50" />
                    <SelectItem label="100 logs" value="100" />
                    <SelectItem label="200 logs" value="200" />
                    <SelectItem label="500 logs" value="500" />
                  </SelectContent>
                </SelectPortal>
              </Select>
            </HStack>
            
            {/* Indicador de filtros ativos */}
            {!isLoading && (
              <HStack className="gap-2 items-center">
                <Text
                  className="text-xs text-typography-500 dark:text-typography-400"
                  style={{fontFamily: "Inter_400Regular"}}
                >
                  {filteredLogs.length} {filteredLogs.length === 1 ? 'log encontrado' : 'logs encontrados'}
                  {levelFilter !== "all" && ` • Filtrando por: ${levelFilter === "0" ? "Info" : levelFilter === "1" ? "Error" : levelFilter === "2" ? "Warn" : "Debug"}`}
                  {searchTerm && ` • Busca: "${searchTerm}"`}
                </Text>
              </HStack>
            )}
          </VStack>

          {/* Loading State */}
          {isLoading ? (
            <Box className="py-12 items-center">
              <Spinner size="large" className="text-typography-600 dark:text-typography-400" />
              <Text
                className="text-sm text-typography-500 dark:text-typography-400 mt-4"
                style={{fontFamily: "Inter_400Regular"}}
              >
                Carregando logs...
              </Text>
            </Box>
          ) : error ? (
            <Box className="py-12 items-center">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <Text
                className="text-sm text-red-500 dark:text-red-400"
                style={{fontFamily: "Inter_500Medium"}}
              >
                {error}
              </Text>
            </Box>
          ) : filteredLogs.length === 0 ? (
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
                          {typeof log.message === 'string' ? log.message : JSON.stringify(log.message)}
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
