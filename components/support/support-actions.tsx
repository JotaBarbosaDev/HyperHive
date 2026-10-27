import React from "react";
import { Platform, Pressable, useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Popover, PopoverBackdrop, PopoverContent } from "@/components/ui/popover";
import { ink } from "./support-ui";

type Item = { label: string; onPress: () => void; disabled?: boolean };
const panel = "p-1 rounded-xl border border-outline-200 dark:border-[#26364A] bg-background-0 dark:bg-[#101B2B] shadow-hard-3";
const row = "min-h-11 px-3 py-2 rounded-lg flex-row items-center justify-between gap-4 web:hover:bg-background-100 dark:web:hover:bg-[#263244] web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-[#147D78]";

export function SupportActions({ createApp, manageApps, manageTabs, actions }: { createApp: Item; manageApps: Item[]; manageTabs: Item; actions: Item[] }) {
  const narrow = useWindowDimensions().width < 520;
  const [open, setOpen] = React.useState(false);
  const [managing, setManaging] = React.useState(false);
  const first = React.useRef<React.ComponentRef<typeof Pressable>>(null);
  const manage = React.useRef<React.ComponentRef<typeof Pressable>>(null);
  const childFirst = React.useRef<React.ComponentRef<typeof Pressable>>(null);
  const close = () => { setManaging(false); setOpen(false); };
  const keyboard = (event: React.KeyboardEvent<HTMLElement>, child: boolean) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (child && event.key === "ArrowLeft") { event.preventDefault(); setManaging(false); manage.current?.focus(); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(event.currentTarget.closest('[role="menu"]')?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
      if (!items.length) return;
      const index = items.indexOf(event.currentTarget);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  };
  const item = (action: Item, child = false, ref?: React.Ref<React.ComponentRef<typeof Pressable>>) => <Pressable key={action.label} ref={ref} accessibilityRole="menuitem" accessibilityLabel={action.label} disabled={action.disabled} accessibilityState={{ disabled: !!action.disabled }}
    {...(Platform.OS === "web" ? { tabIndex: -1, "aria-disabled": !!action.disabled, onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => keyboard(event, child) } : {})}
    onHoverIn={() => { if (!child) setManaging(false); }} onPress={() => { close(); action.onPress(); }} className={row} style={{ opacity: action.disabled ? 0.4 : 1 }}><Text className={ink + " text-sm"}>{action.label}</Text></Pressable>;
  const manageTrigger = (props: any = {}) => <Pressable {...props} ref={(node) => { manage.current = node; if (typeof props.ref === "function") props.ref(node); else if (props.ref) props.ref.current = node; }} accessibilityRole="menuitem" accessibilityLabel="Manage Apps" accessibilityState={{ expanded: managing }}
    {...(Platform.OS === "web" ? { tabIndex: -1, "aria-haspopup": "menu" as const, "aria-expanded": managing, onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => { if (event.key === "ArrowRight") { event.preventDefault(); setManaging(true); } else keyboard(event, false); } } : {})}
    onPress={() => setManaging(true)} onHoverIn={() => { if (!narrow) setManaging(true); }} className={row}><Text className={ink + " text-sm"}>Manage Apps</Text><Text aria-hidden className={ink}>›</Text></Pressable>;
  const managementItems = manageApps.map((action, index) => item(action, true, index === manageApps.findIndex((entry) => !entry.disabled) ? childFirst : undefined));
  React.useEffect(() => { if (narrow && open) (managing ? childFirst : createApp.disabled ? manage : first).current?.focus(); }, [narrow, open, managing, createApp.disabled]);
  return <Popover isOpen={open} onOpen={() => setOpen(true)} onClose={close} placement="bottom right" trapFocus={false} initialFocusRef={createApp.disabled ? manage : first} trigger={(props) => <Pressable {...props} accessibilityRole="button" accessibilityLabel="Dashboard actions" className="h-10 w-10 items-center justify-center rounded-lg border border-outline-200 dark:border-[#26364A] web:hover:bg-background-100 web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-[#147D78]"><Text className={ink + " text-xl"}>⋯</Text></Pressable>}>
    <PopoverBackdrop />
    <PopoverContent className={panel} style={{ width: 216, maxWidth: "90%" }}>
      {narrow && managing ? <Box role="menu" accessibilityLabel="Manage Apps">
        <Pressable accessibilityRole="menuitem" accessibilityLabel="Back to dashboard actions" onPress={() => setManaging(false)} className={row}><Text className={ink + " text-sm"}>‹ Back</Text></Pressable>
        {managementItems}
      </Box> : <Box role="menu" accessibilityLabel="Dashboard actions">
        {item(createApp, false, first)}
        {narrow ? manageTrigger() : <Popover isOpen={managing} onOpen={() => setManaging(true)} onClose={() => setManaging(false)} placement="right top" offset={0} trapFocus={false} initialFocusRef={childFirst} finalFocusRef={manage} trigger={manageTrigger}>
          <PopoverContent className={panel} style={{ width: 216, maxWidth: "90%" }}><Box role="menu" accessibilityLabel="Manage Apps">{managementItems}</Box></PopoverContent>
        </Popover>}
        {item(manageTabs)}
        <Box role="separator" className="h-px my-1 bg-outline-100 dark:bg-[#26364A]" />
        {actions.map((action) => item(action))}
      </Box>}
    </PopoverContent>
  </Popover>;
}
