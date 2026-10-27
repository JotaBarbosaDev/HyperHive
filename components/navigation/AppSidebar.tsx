import React from "react";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useColorScheme } from "@/components/useColorScheme";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalCloseButton,
} from "@/components/ui/modal";
import { Radio, RadioGroup, RadioIndicator, RadioLabel } from "@/components/ui/radio";
import { Heading } from "@/components/ui/heading";
import {
  HardDrive,
  Disc,
  Server,
  Boxes,
  LogOut,
  Share2,
  Shield,
  WifiPen,
  CloudCog,
  RefreshCw,
  FileText,
  ChevronRight,
  ChevronDown,
  Globe,
  Settings,
  MoonStar,
  MonitorSmartphone,
  Monitor,
  SunMedium,
  KeyRound,
  Lock,
  EthernetPort,
  Layers,
  PlugZap,
  Gauge,
  ServerCog,
  DatabaseBackup,
  History,
  TriangleAlert,
  ShieldCheck,
  GitFork,
  ArrowLeftRight,
  ChevronsLeftRightEllipsis,
  Image as ImageIcon,
  Box as BoxIcon,
  Database,
  GitBranch,
  Gpu,
  StickyNote,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react-native";
import { usePathname, useRouter } from "expo-router";
import { clearAuthToken } from "@/services/auth-storage";
import { setAuthToken } from "@/services/api-client";
import { Image } from "@/components/ui/image";
import type { SupportApp } from "@/types/support";
import { resetSupportNavigation, selectSupportApp, useSupportNavigation } from "@/hooks/useSupportNavigation";
import { SIDEBAR_RAIL_WIDTH } from "@/hooks/useSidebarLayout";

export type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  width: number;
  onResize: (width: number) => void;
  compact: boolean;
  connected: boolean;
  themePreference: "light" | "dark" | "system";
  onChangeThemePreference: (pref: "light" | "dark" | "system") => void;
};

type MenuItem = {
  key?: string;
  supportTabId?: string;
  supportApp?: SupportApp;
  label: string;
  route?: string;
  icon?: React.ComponentType<any>;
  iconProps?: Omit<Partial<React.ComponentProps<typeof Icon>>, "as">;
  children?: MenuItem[];
};

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Dashboard",
    icon: Gauge,
    route: "/dashboard",
  },
  {
    label: "Storage",
    icon: HardDrive,
    children: [
      {label: "BTRFS / RAIDs", route: "/btrfs-raids", icon: Layers},
      {label: "Auto-Mounts", route: "/btrfs-automatic-mounts", icon: PlugZap},
      {label: "SmartDisk", route: "/smartdisk", icon: Gauge},
    ],
  },
  {
    label: "NFS",
    icon: Share2,
    route: "/mounts",
  },
  {
    label: "ISOs",
    icon: Disc,
    route: "/isos",
  },
  {
    label: "VMs",
    icon: Monitor,
    iconProps: { size: "md" },
    children: [
      {label: "Virtual Machines", route: "/vms", icon: ServerCog},
      {label: "VMs Disks", route: "/vms-disks", icon: HardDrive},
      {label: "XML Templates", route: "/vms-xml-templates", icon: FileText},
      {label: "GPUs", route: "/gpus", icon: Gpu, iconProps: { size: "md" }},
      {label: "Backups", route: "/backups", icon: DatabaseBackup},
      {label: "Auto-Backups", route: "/autobackups", icon: History},
    ],
  },
  {
    label: "WireGuard VPN",
    icon: Shield,
    route: "/wireguard",
  },
  {
    label: "DNS",
    icon: Globe,
    route: "/dns",
  },
  {
    label: "K8 Cluster",
    icon: CloudCog,
    route: "/k8s-cluster",
  },
  {
    label: "celld Fleets",
    icon: Server,
    iconProps: { size: 20 },
    route: "/celld-fleet",
  },
  {
    label: "SPA",
    icon: KeyRound,
    route: "/spa",
  },
  {
    label: "Updates",
    icon: RefreshCw,
    route: "/updates",
  },
  {
    label: "Logs",
    icon: FileText,
    route: "/logs",
  },
  {
    label: "HH Support",
    icon: Gauge,
    route: "/support",
    children: [],
  },
  {
    label: "Nginx",
    icon: EthernetPort,
    children: [
      {label: "404", route: "/404", icon: TriangleAlert},
      {label: "Certificates", route: "/certificates", icon: ShieldCheck},
      {label: "Access Lists", route: "/access-lists", icon: Lock},
      {label: "Proxy", route: "/proxy", icon: GitFork},
      {label: "Upstreams", route: "/upstreams", icon: GitFork},
      {label: "Redirection", route: "/redirection", icon: ArrowLeftRight},
      {label: "Streams", route: "/streams", icon: ChevronsLeftRightEllipsis},
    ],
  },
  {
    label: "Docker",
    icon: Boxes,
    children: [
      {label: "Images", route: "/docker/images", icon: ImageIcon},
      {label: "Containers", route: "/docker/containers", icon: BoxIcon},
      {label: "Volumes", route: "/docker/volumes", icon: Database},
      {label: "Networks", route: "/docker/networks", icon: WifiPen},
      {label: "Git", route: "/docker/git", icon: GitBranch},
    ],
  },
  {
    label: "Notes",
    icon: StickyNote,
    route: "/notes",
  },
];

const THEME_OPTIONS = [
  {
    value: "light" as const,
    label: "Always light",
    description: "More brightness and contrast for well-lit spaces.",
    icon: SunMedium,
  },
  {
    value: "dark" as const,
    label: "Always dark",
    description: "Subtle background and high contrast for long sessions.",
    icon: MoonStar,
  },
  {
    value: "system" as const,
    label: "Follow system",
    description: "Automatically adapts to your device theme.",
    icon: MonitorSmartphone,
  },
];

export function AppSidebar({ isOpen, onClose, onToggle, width, onResize, compact, connected, themePreference, onChangeThemePreference }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const support = useSupportNavigation();
  React.useEffect(() => () => resetSupportNavigation(), []);
  const systemScheme = useColorScheme();
  const resolvedMode = themePreference === "system" ? (systemScheme === "dark" ? "dark" : "light") : themePreference;
  const { width: viewportWidth } = useWindowDimensions();
  const [expandedParents, setExpandedParents] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    if (pathname === "/support" && support.tabId) setExpandedParents((current) => ({ ...current, ["support-tab-" + support.tabId]: true }));
  }, [pathname, support.tabId]);
  const [showSettings, setShowSettings] = React.useState(false);
  const settingsRef = React.useRef<React.ElementRef<typeof Pressable>>(null);
  const closeSettings = () => {
    setShowSettings(false);
    // Wait for the modal exit animation before restoring focus.
    if (Platform.OS === "web") setTimeout(() => (settingsRef.current as unknown as HTMLElement | null)?.focus(), 300);
  };
  const dragging = React.useRef<{ x: number; width: number } | null>(null);
  const resizeRef = React.useRef(onResize);
  resizeRef.current = onResize;
  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const move = (event: PointerEvent) => {
      if (dragging.current) resizeRef.current(dragging.current.width + event.clientX - dragging.current.x);
    };
    const stop = () => { dragging.current = null; };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { stop(); if (compact && isOpen && !showSettings) onClose(); }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", key);
    };
  }, [compact, isOpen, onClose, showSettings]);
  const dark = resolvedMode === "dark";
  const muted = dark ? "#94A3B8" : "#64748B";
  const targetHeight = Platform.OS === "android" ? 48 : 44;

  const handleLogout = React.useCallback(async () => {
    onClose();
    try {
      await Promise.all([clearAuthToken()]);
    } catch (err) {
      console.warn("Failed to clear stored session during logout", err);
    } finally {
      setAuthToken(null);
      router.replace("/");
    }
  }, [onClose, router]);

  const handleNavigate = React.useCallback(
    (route: string, keepOpen = false) => {
      if (useSupportNavigation.getState().dirty && route !== pathname) return;
      if (route !== pathname) {
        router.replace(route as any);
      }
      if (compact && !keepOpen) onClose();
    },
    [compact, onClose, pathname, router]
  );

  const isRouteActive = React.useCallback(
    (route?: string) => {
      if (!route) {
        return false;
      }
      if (!pathname) {
        return false;
      }
      return pathname === route || pathname.startsWith(`${route}/`);
    },
    [pathname]
  );

  const supportItems = MENU_ITEMS.map((item) => item.route !== "/support" ? item : { ...item, children: support.tabs.map((tab) => ({
    key: "support-tab-" + tab.id, label: tab.name, route: "/support", supportTabId: tab.id,
    children: support.apps.filter((app) => app.tab_id === tab.id).map((app) => ({ key: "support-app-" + app.id, label: app.name, route: "/support", supportTabId: tab.id, supportApp: app })),
  })) });
  const isItemActive = (item: MenuItem): boolean => {
    if (item.supportApp) return pathname === "/support" && support.selectedId === item.supportApp.id;
    if (item.supportTabId) return pathname === "/support" && support.tabId === item.supportTabId;
    if (item.route && isRouteActive(item.route)) {
      return true;
    }
    return item.children?.some((child) => isItemActive(child)) ?? false;
  };

  const renderMenuItems = (items: MenuItem[], level = 0): React.ReactNode => items.map((item) => {
    const key = item.key ?? item.route ?? item.label;
    const hasChildren = item.children !== undefined;
    const active = isItemActive(item);
    const expanded = expandedParents[key] ?? active;
    const app = item.supportApp;
    const live = support.connection === "live";
    const appStatus = app ? live ? `${app.connectivity}, ${app.health}` : "status unavailable" : "";
    const dotColor = !live || app?.connectivity === "unknown" || app?.health === "unknown" ? (dark ? "#94A3B8" : "#64748B") : app?.connectivity === "offline" || app?.health === "unhealthy" ? (dark ? "#E88070" : "#BA4F3D") : app?.health === "degraded" ? (dark ? "#E9BD62" : "#946A18") : (dark ? "#2DD4BF" : "#147D78");
    return (
      <React.Fragment key={key}>
        <Box className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={app ? `${app.name}: ${appStatus}${app.tags.length ? ". Tags: " + app.tags.join(", ") : ""}` : item.label}
          accessibilityState={{ selected: active, ...(hasChildren ? { expanded: isOpen && expanded } : {}) }}
          {...(Platform.OS === "web" ? { title: app ? `${app.name}: ${appStatus}${app.tags.length ? ". Tags: " + app.tags.join(", ") : ""}` : item.label } : {})}
          onPress={() => {
            if (item.supportTabId) {
              const selected = item.supportApp ?? support.apps.find((app) => app.id === support.selectedId && app.tab_id === item.supportTabId) ?? support.apps.find((app) => app.tab_id === item.supportTabId);
              if (!selectSupportApp(item.supportTabId, selected?.id ?? null)) return;
              handleNavigate("/support", hasChildren);
            }
            if (hasChildren) {
              if (!isOpen) { onToggle(); setExpandedParents((prev) => ({ ...prev, [key]: true })); }
              else setExpandedParents((prev) => ({ ...prev, [key]: !expanded }));
              if (item.route === "/support" && !item.supportTabId) handleNavigate("/support", true);
            } else if (item.route && !item.supportTabId) handleNavigate(item.route);
          }}
          className={`flex-row items-center gap-3 rounded-lg active:opacity-70 focus-visible:outline-2 focus-visible:outline-[#2DD4BF] ${active ? "bg-[#E2E8F0] dark:bg-[#263244] hover:bg-[#D8E0EA] dark:hover:bg-[#2D3B50]" : "hover:bg-background-100 dark:hover:bg-[#1A2637]"}`}
          style={{ flex: 1, minHeight: targetHeight, paddingVertical: 8, paddingHorizontal: isOpen ? 12 : 0, justifyContent: isOpen ? "flex-start" : "center", marginLeft: isOpen ? level * 16 : 0 }}
        >
          {app ? <Box accessibilityElementsHidden className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} /> : null}
          {item.icon ? <Box className="w-5 items-center shrink-0"><Icon as={item.icon} size={level ? 18 : 20} aria-hidden={true} className={active ? "text-[#1E293B] dark:text-[#F1F5F9]" : "text-[#64748B] dark:text-[#94A3B8]"} /></Box> : null}
          {isOpen ? <>
            {app ? <Box className="flex-1 min-w-0 gap-1"><Text className={`text-sm web:[overflow-wrap:anywhere] ${active ? "text-typography-900 dark:text-[#F1F5F9]" : "text-typography-700 dark:text-[#CBD5E1]"}`}>{app.name}</Text>{app.tags.length ? <Box className="flex-row flex-wrap gap-1">{app.tags.map((tag) => <Text key={tag} className="text-xs px-1 rounded bg-background-100 dark:bg-[#1A2637] text-typography-600 dark:text-[#94A3B8] max-w-full web:[overflow-wrap:anywhere]">{tag}</Text>)}</Box> : null}</Box> : <Text numberOfLines={1} className={`flex-1 text-sm ${active ? "text-typography-900 dark:text-[#F1F5F9]" : "text-typography-700 dark:text-[#CBD5E1]"}`} style={{ fontFamily: active ? "Inter_600SemiBold" : level ? "Inter_400Regular" : "Inter_500Medium" }}>{item.label}</Text>}
            {hasChildren ? <Box className="w-5 h-5 shrink-0 items-center justify-center"><Icon as={expanded ? ChevronDown : ChevronRight} size={16} aria-hidden={true} className="text-[#64748B] dark:text-[#94A3B8]" /></Box> : null}
          </> : null}
        </Pressable>

        </Box>
        {isOpen && hasChildren && expanded ? <Box className="gap-1 my-1">{renderMenuItems(item.children!, level + 1)}{item.supportTabId && !item.children?.length ? <Text className="text-xs px-3 py-2 text-typography-600 dark:text-[#94A3B8]" style={{ marginLeft: (level + 1) * 16 }}>No Apps in this workspace</Text> : null}</Box> : null}
      </React.Fragment>
    );
  });

  return (
    <>
      {compact && isOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Close navigation" onPress={onClose} className="absolute inset-0 bg-black/40" style={{ zIndex: 29 }} /> : null}
      <Box
        className="absolute left-0 top-0 bottom-0 bg-[#F8FAFC] dark:bg-[#0E1524] border-r border-[#D9E0E9] dark:border-[#293548]"
        style={{ width: isOpen ? Math.min(width, viewportWidth - 48) : SIDEBAR_RAIL_WIDTH, zIndex: 30 }}
      >
        <Box className="px-2 pt-3 pb-5 gap-2" style={{ flexDirection: isOpen ? "row" : "column", alignItems: "center" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="HyperHive dashboard" onPress={() => handleNavigate("/dashboard")} className="flex-row items-center gap-3 rounded-lg px-1 py-1 active:opacity-70 focus-visible:outline-2 focus-visible:outline-[#2DD4BF]" style={{ flex: isOpen ? 1 : undefined, minHeight: targetHeight }}>
            <Box className="h-10 w-10 items-center justify-center shrink-0 rounded-lg bg-[#0E1524] dark:bg-transparent">
              <Image source={require("../../assets/images/android-chrome-192x192.png")} alt="HyperHive" resizeMode="contain" size="none" className="h-7 w-7" />
            </Box>
            {isOpen ? <Box className="flex-1"><Text className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">HyperHive</Text><Text className="text-xs" style={{ color: muted }}>{connected ? "Connected" : "Disconnected"}</Text></Box> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isOpen ? "Collapse sidebar" : "Expand sidebar"} accessibilityState={{ expanded: isOpen }} {...(Platform.OS === "web" ? { title: isOpen ? "Collapse sidebar" : "Expand sidebar" } : {})} onPress={onToggle} className="flex-row items-center gap-3 px-3 py-2 rounded-lg active:opacity-70 hover:bg-background-100 dark:hover:bg-[#1A2637] focus-visible:outline-2 focus-visible:outline-[#2DD4BF]" style={{ minWidth: 44, minHeight: targetHeight, justifyContent: isOpen ? "flex-start" : "center" }}>
            <Icon as={isOpen ? PanelLeftClose : PanelLeftOpen} size={18} aria-hidden={true} className="text-[#64748B] dark:text-[#94A3B8]" />
          </Pressable>
        </Box>
        <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 16, gap: 4 }}>
          {renderMenuItems(supportItems)}
        </ScrollView>
        <Box className="px-2 pt-3 pb-2 gap-1 border-t border-[#D9E0E9] dark:border-[#293548] bg-[#F1F5F9] dark:bg-[#111C2D]">
          {[{ label: "Settings", icon: Settings, action: () => setShowSettings(true) }, { label: "Logout", icon: LogOut, action: handleLogout }].map((item) => (
            <Pressable key={item.label} ref={item.label === "Settings" ? settingsRef : undefined} accessibilityRole="button" accessibilityLabel={item.label} {...(Platform.OS === "web" ? { title: item.label } : {})} onPress={item.action} className="flex-row items-center gap-3 px-3 py-2 rounded-lg active:opacity-70 hover:bg-background-100 dark:hover:bg-[#1A2637] focus-visible:outline-2 focus-visible:outline-[#2DD4BF]" style={{ minWidth: 44, minHeight: targetHeight, justifyContent: isOpen ? "flex-start" : "center" }}>
              <Box className="w-5 items-center shrink-0"><Icon as={item.icon} size={16} aria-hidden={true} className="text-[#64748B] dark:text-[#94A3B8]" /></Box>
              {isOpen ? <Text className="text-xs" style={{ color: muted }}>{item.label}</Text> : null}
            </Pressable>
          ))}
        </Box>
        {isOpen && !compact && Platform.OS === "web" ? <View
          {...({ role: "separator", tabIndex: 0, "aria-label": "Resize sidebar", "aria-orientation": "vertical", "aria-valuemin": 240, "aria-valuemax": 400, "aria-valuenow": width,
            onPointerDown: (event: PointerEvent) => { event.preventDefault(); dragging.current = { x: event.clientX, width }; },
            onKeyDown: (event: KeyboardEvent) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                onResize(event.key === "Home" ? 240 : event.key === "End" ? 400 : width + (event.key === "ArrowLeft" ? -16 : 16));
              }
            },
          } as any)}
          className="absolute top-0 bottom-0 hover:bg-[#2DD4BF]/30 focus-visible:bg-[#2DD4BF]/30"
          style={{ right: -4, width: 8, cursor: "col-resize", touchAction: "none" } as any}
        /> : null}
      </Box>

      <Modal
        isOpen={showSettings}
        onClose={closeSettings}
        size="md"
      >
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="bg-background-0 dark:bg-[#0E1524] rounded-2xl shadow-soft-2 web:max-w-xl">
          <ModalHeader className="flex-row items-start justify-between gap-3 pb-4">
            <Box className="flex-row items-center gap-3 flex-1">
              <Box className="w-11 h-11 rounded-xl items-center justify-center from-primary-50 to-background-0 dark:from-[#16263D] dark:to-[#0F1A2E]">
                <Icon
                  as={Settings}
                  size="lg"
                  className="text-primary-700 dark:text-[#2dd4be88]"
                />
              </Box>
              <Box className="flex-1">
                <Heading
                  size="md"
                  className="text-typography-900 dark:text-[#E8EBF0]"
                >
                  Settings
                </Heading>
                <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                  Quickly personalize the dashboard experience.
                </Text>
              </Box>
            </Box>
            <ModalCloseButton accessibilityLabel="Close settings" className="mt-1 rounded-full">
              <Icon as={X} size="md" aria-hidden={true} className="text-typography-600 dark:text-[#8A94A8]" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody className="gap-5 pt-5">
            <Box className="rounded-xl bg-background-50/70 dark:bg-[#0F1A2E] p-4 gap-3">
              <Text
                className="text-xs font-semibold uppercase text-typography-500 dark:text-[#8A94A8] tracking-[0.08em]"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                Theme
              </Text>
              <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">
                Choose how HyperHive adapts to your environment.
              </Text>
              <RadioGroup
                value={themePreference}
                onChange={(val: any) => onChangeThemePreference(val)}
                className="gap-3 mt-1"
              >
                {THEME_OPTIONS.map((option) => {
                  const isActive = themePreference === option.value;
                  return (
                    <Radio
                      key={option.value}
                      value={option.value}
                      aria-label={option.label}
                      className={`flex-row items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                        isActive
                          ? "bg-primary-50/60 dark:bg-[#121C2D]"
                          : "bg-background-0 dark:bg-[#0E1524]"
                      }`}
                    >
                      <RadioIndicator
                        className={`self-center ${
                          isActive
                            ? "border-primary-600 bg-primary-50/70 dark:bg-[#1B2F4B] dark:border-[#2DD4BF]"
                            : ""
                        }`}
                      >
                        {isActive ? (
                          <Box className="w-2 h-2 rounded-full bg-primary-700 dark:bg-[#E8EBF0]"></Box>
                        ) : null}
                      </RadioIndicator>
                      <Box className="flex-row items-start gap-3 flex-1">
                        <Box
                          className={`w-10 h-10 rounded-lg items-center justify-center ${
                            isActive
                              ? "bg-primary-500/10 dark:bg-[#1B2F4B]"
                              : "bg-background-100 dark:bg-[#1A2637]"
                          }`}
                        >
                          <Icon
                            as={option.icon}
                            size="md"
                            className={
                              isActive
                                ? "text-primary-700 dark:text-[#2dd4be88]"
                                : "text-typography-600 dark:text-[#8A94A8]"
                            }
                          />
                        </Box>
                        <Box className="flex-1">
                          <RadioLabel
                            className="text-base text-typography-900 dark:text-[#E8EBF0]"
                            style={{fontFamily: "Inter_600SemiBold"}}
                          >
                            {option.label}
                          </RadioLabel>
                          <Text className="text-xs text-typography-500 dark:text-[#8A94A8] mt-0.5">
                            {option.description}
                          </Text>
                        </Box>
                      </Box>
                    </Radio>
                  );
                })}
              </RadioGroup>
            </Box>
          </ModalBody>
          <ModalFooter className="justify-end pt-4 mt-2">
            <Button
              variant="outline"
              action="secondary"
              className="rounded-xl px-4 h-11 dark:hover:bg-[#1A2637]/50 dark:active:bg-[#1A2637]"
              onPress={closeSettings}
            >
              <ButtonText className="font-semibold text-typography-900 dark:text-[#E8EBF0]">
                Close
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
