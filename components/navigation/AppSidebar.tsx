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
  HardDrive,
  Disc,
  Server,
  LogOut,
  LayoutDashboard,
  Share2,
  Shield,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react-native";
import {usePathname, useRouter} from "expo-router";
import { clearAuthToken} from "@/services/auth-storage";
import {setAuthToken} from "@/services/api-client";

export type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
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
];

export function AppSidebar({isOpen, onClose}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedParents, setExpandedParents] = React.useState<Record<string, boolean>>({});

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
            {item.icon ? (
              <Icon
                as={item.icon}
                size="lg"
                className={
                  isActive
                    ? "text-typography-900 dark:text-[#E8EBF0]"
                    : "text-typography-600 dark:text-typography-400"
                }
              />
            ) : (
              <Box className="w-6" />
            )}
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
        <Divider className="my-2 bg-outline-100 dark:bg-[#2A3B52]" />
        <DrawerFooter className="px-4 pb-6">
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
    </Drawer>
  );
}
