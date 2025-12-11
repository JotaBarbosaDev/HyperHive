import React from "react";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
} from "@/components/ui/drawer";
import {Button, ButtonIcon, ButtonText} from "@/components/ui/button";
import {Text} from "@/components/ui/text";
import {Box} from "@/components/ui/box";
import {Pressable} from "@/components/ui/pressable";
import {Divider} from "@/components/ui/divider";
import {Icon} from "@/components/ui/icon";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalCloseButton,
} from "@/components/ui/modal";
import {Radio, RadioGroup, RadioIndicator, RadioLabel, RadioIcon} from "@/components/ui/radio";
import {Heading} from "@/components/ui/heading";
import {
  HardDrive,
  Disc,
  Server,
  LogOut,
  LayoutDashboard,
  Share2,
  Shield,
  RefreshCw,
  FileText,
  ChevronRight,
  Network,
  Settings,
  Dot,
  MoonStar,
  MonitorSmartphone,
  SunMedium,
} from "lucide-react-native";
import {usePathname, useRouter} from "expo-router";
import { clearAuthToken} from "@/services/auth-storage";
import {setAuthToken} from "@/services/api-client";

export type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  themePreference: "light" | "dark" | "system";
  onChangeThemePreference: (pref: "light" | "dark" | "system") => void;
};

type MenuItem = {
  label: string;
  route?: string;
  icon?: React.ComponentType<any>;
  children?: MenuItem[];
};

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    route: "/dashboard",
  },
  {
    label: "Storage",
    icon: HardDrive,
    children: [
      {label: "BTRFS / RAIDs", route: "/btrfs-raids"},
      {label: "SmartDisk", route: "/smartdisk"},
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
    icon: Server,
    children: [
      {label: "Virtual Machines", route: "/vms"},
      {label: "Backups", route: "/backups"},
      {label: "Auto-Backups", route: "/autobackups"},
    ],
  },
  {
    label: "WireGuard VPN",
    icon: Shield,
    route: "/wireguard",
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
    label: "Nginx",
    icon: Network,
    children: [
      {label: "404", route: "/404"},
      {label: "Certificates", route: "/certificates"},
      {label: "Proxy", route: "/proxy"},
      {label: "Redirection", route: "/redirection"},
      {label: "Streams", route: "/streams"},
    ],
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

export function AppSidebar({isOpen, onClose, themePreference, onChangeThemePreference}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedParents, setExpandedParents] = React.useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = React.useState(false);

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
    (route: string) => {
      if (route !== pathname) {
        router.replace(route as any);
      }
      onClose();
    },
    [onClose, pathname, router]
  );

  const isRouteActive = React.useCallback(
    (route?: string) => {
      if (!route) {
        return false;
      }
      return route === "/mounts" ? pathname === "/mounts" : Boolean(pathname?.startsWith(route));
    },
    [pathname]
  );

  const isItemActive = (item: MenuItem): boolean => {
    if (item.route && isRouteActive(item.route)) {
      return true;
    }
    return item.children?.some((child) => isItemActive(child)) ?? false;
  };

  const toggleParent = React.useCallback((key: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const renderMenuItems = (items: MenuItem[], level = 0): React.ReactNode => {
    return items.map((item) => {
      const itemKey = item.route ?? item.label;
      const hasChildren = Boolean(item.children?.length);
      const isExpanded = hasChildren ? Boolean(expandedParents[itemKey]) : false;
      const isActive = isItemActive(item);
      const paddingLeft = level * 12;

      const handlePress = () => {
        if (hasChildren) {
          toggleParent(itemKey);
          return;
        }
        if (item.route) {
          handleNavigate(item.route);
        }
      };

      return (
        <React.Fragment key={itemKey}>
          <Pressable
            className={`gap-3 flex-row items-center rounded-xl px-4 py-3 transition-all ${
              isActive
                ? "bg-background-100 dark:bg-[#1A2637]"
                : "hover:bg-background-50 dark:hover:bg-[#1A2637]/50 active:bg-background-100 dark:active:bg-[#1A2637]"
            }`}
            style={{marginLeft: paddingLeft}}
            onPress={handlePress}
          >
            <Box
              className="w-6 h-6 shrink-0 !items-center !justify-center"
              style={{alignItems: "center", justifyContent: "center"}}
            >
              {item.icon ? (
                <Icon
                  as={item.icon}
                  size="md"
                  className={`shrink-0 ${
                    isActive
                      ? "text-typography-900 dark:text-[#E8EBF0]"
                      : "text-typography-600 dark:text-typography-400"
                  }`}
                />
              ) : null}
            </Box>
            <Text
              className={`flex-1 text-base ${
                isActive
                  ? "text-typography-900 dark:text-[#E8EBF0] font-semibold"
                  : "text-typography-900 dark:text-typography-200 font-medium"
              }`}
              style={{
                fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium",
              }}
            >
              {item.label}
            </Text>
            {hasChildren ? (
              <Icon
                as={ChevronRight}
                size="sm"
                className={`ml-auto text-typography-500 dark:text-typography-400 transition-transform origin-center ${
                  isExpanded ? "rotate-45" : ""
                }`}
              />
            ) : null}
          </Pressable>
          {hasChildren && isExpanded ? (
            <Box className="mt-1">
              {renderMenuItems(item.children!, level + 1)}
            </Box>
          ) : null}
        </React.Fragment>
      );
    });
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} anchor="left" size="full">
      <DrawerBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <DrawerContent className="w-[280px] max-w-[90%] md:w-[340px] bg-background-0 dark:bg-[#0E1524]">
        <DrawerBody contentContainerClassName="gap-1 px-3 py-2">
          {renderMenuItems(MENU_ITEMS)}
        </DrawerBody>
        <DrawerFooter className="px-4 pb-6 flex-col">
          <Button
            className="w-full gap-2 h-12 rounded-xl mb-3"
            variant="outline"
            action="secondary"
            onPress={() => setShowSettings(true)}
          >
            <ButtonIcon as={Settings} className="text-typography-700 dark:text-typography-300" />
            <ButtonText className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
              Settings
            </ButtonText>
          </Button>
          <Button
            className="w-full gap-2 h-12 rounded-xl"
            variant="outline"
            action="secondary"
            onPress={handleLogout}
          >
            <ButtonIcon as={LogOut} className="text-typography-700 dark:text-typography-300" />
            <ButtonText className="text-base font-semibold text-typography-900 dark:text-[#E8EBF0]">
              Logout
            </ButtonText>
          </Button>
        </DrawerFooter>
      </DrawerContent>

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} size="md">
        <ModalBackdrop className="bg-background-950/60 dark:bg-black/70" />
        <ModalContent className="bg-background-0 dark:bg-[#0E1524] rounded-2xl border border-outline-100 dark:border-[#2A3B52] shadow-soft-2 web:max-w-xl">
          <ModalHeader className="flex-row items-start justify-between gap-3 pb-4 border-b border-outline-100 dark:border-[#2A3B52]">
            <Box className="flex-row items-center gap-3 flex-1">
              <Box className="w-11 h-11 rounded-xl items-center justify-center from-primary-50 to-background-0 dark:from-[#16263D] dark:to-[#0F1A2E] border border-outline-100 dark:border-[#2A3B52]">
                <Icon as={Settings} size="lg" className="text-primary-700 dark:text-[#8AB9FF]" />
              </Box>
              <Box className="flex-1">
                <Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">
                  Settings
                </Heading>
                <Text className="text-sm text-typography-600 dark:text-typography-300">
                  Quickly personalize the dashboard experience.
                </Text>
              </Box>
            </Box>
            <ModalCloseButton className="mt-1 rounded-full border border-outline-100 dark:border-[#2A3B52]" />
          </ModalHeader>
          <ModalBody className="gap-5 pt-5">
            <Box className="rounded-xl border border-outline-100 dark:border-[#2A3B52] bg-background-50/70 dark:bg-[#0F1A2E] p-4 gap-3">
              <Text
                className="text-xs font-semibold uppercase text-typography-500 dark:text-typography-300 tracking-[0.08em]"
                style={{fontFamily: "Inter_600SemiBold"}}
              >
                Theme
              </Text>
              <Text className="text-sm text-typography-600 dark:text-typography-300">
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
                      className={`flex-row items-center gap-3 rounded-xl border px-3 py-3 transition-all ${
                        isActive
                          ? "border-primary-500 bg-primary-50/60 dark:border-[#4A7DFF] dark:bg-[#121C2D]"
                          : "border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0E1524]"
                      }`}
                    >
                      <RadioIndicator
                        className={`self-center ${
                          isActive
                            ? "border-primary-600 bg-primary-50/70 dark:bg-[#1B2F4B] dark:border-[#4A7DFF]"
                            : ""
                        }`}
                      >
                        {isActive ? (
                          <RadioIcon as={Dot} size="sm" className="text-primary-700 dark:text-[#8AB9FF]" />
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
                                ? "text-primary-700 dark:text-[#8AB9FF]"
                                : "text-typography-600 dark:text-typography-200"
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
                          <Text className="text-xs text-typography-500 dark:text-typography-300 mt-0.5">
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
          <ModalFooter className="justify-end border-t border-outline-100 dark:border-[#2A3B52] pt-4 mt-2">
            <Button
              variant="outline"
              action="secondary"
              className="rounded-xl px-4 h-11 border-outline-100 dark:border-[#2A3B52]"
              onPress={() => setShowSettings(false)}
            >
              <ButtonText className="font-semibold text-typography-900 dark:text-[#E8EBF0]">
                Close
              </ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Drawer>
  );
}
