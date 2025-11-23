import React from "react";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import {Button, ButtonIcon, ButtonText} from "@/components/ui/button";
import {Text} from "@/components/ui/text";
import {VStack} from "@/components/ui/vstack";
import {Pressable} from "@/components/ui/pressable";
import {Divider} from "@/components/ui/divider";
import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import {Icon} from "@/components/ui/icon";
import {HardDrive, Home, ShoppingCart, Wallet, LogOut} from "lucide-react-native";
import {usePathname, useRouter} from "expo-router";
import {setApiBaseUrl} from "@/config/apiConfig";
import {clearApiBaseUrl, clearAuthToken} from "@/services/auth-storage";
import {setAuthToken} from "@/services/api-client";

export type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const MENU_ITEMS = [
  {
    label: "Mounts",
    icon: Home,
    route: "/mounts",
  },
  {
    label: "ISO Downloads",
    icon: HardDrive,
    route: "/profile",
  },
  {
    label: "Orders",
    icon: ShoppingCart,
    route: "/orders",
  },
  {
    label: "Saved Cards",
    icon: Wallet,
    route: "/cards",
  },
];

export function AppSidebar({isOpen, onClose}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = React.useCallback(async () => {
    onClose();
    try {
      await Promise.all([clearAuthToken(), clearApiBaseUrl()]);
    } catch (err) {
      console.warn("Failed to clear stored session during logout", err);
    } finally {
      setAuthToken(null);
      setApiBaseUrl(null);
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

  return (
    <Drawer isOpen={isOpen} onClose={onClose} anchor="left" size="full">
      <DrawerBackdrop className="bg-background-950/50 dark:bg-black/70" />
      <DrawerContent className="w-[280px] max-w-[90%] md:w-[340px] bg-background-0 dark:bg-[#0E1524]">
        <DrawerBody contentContainerClassName="gap-1 px-3 py-2">
          {MENU_ITEMS.map(({label, icon, route}) => {
            const isActive =
              route === "/mounts" ? pathname === "/mounts" : pathname?.startsWith(route);
            return (
              <Pressable
                key={route}
                className={`gap-3 flex-row items-center rounded-xl px-4 py-3 transition-all ${
                  isActive
                    ? "bg-background-100 dark:bg-[#1A2637]"
                    : "hover:bg-background-50 dark:hover:bg-[#1A2637]/50 active:bg-background-100 dark:active:bg-[#1A2637]"
                }`}
                onPress={() => handleNavigate(route)}
              >
                <Icon
                  as={icon}
                  size="lg"
                  className={`${
                    isActive
                      ? "text-typography-900 dark:text-[#E8EBF0]"
                      : "text-typography-600 dark:text-typography-400"
                  }`}
                />
                <Text
                  className={`text-base ${
                    isActive
                      ? "text-typography-900 dark:text-[#E8EBF0] font-semibold"
                      : "text-typography-900 dark:text-typography-200 font-medium"
                  }`}
                  style={{fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium"}}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
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
