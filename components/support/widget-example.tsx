import React from "react";
import { ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { Sample, SupportStream, Widget } from "@/types/support";
import { widgetLabels } from "@/services/support-client";
import { SupportDialog } from "./support-dialogs";
import { Action, ink, muted } from "./support-ui";
import { SupportWidget } from "./support-widget";

export function exampleValues(stream: SupportStream): Sample["value"][] {
  switch (stream.type) {
    case "number": return [18, 42, 68];
    case "text": return [stream.name === "machine_info" ? JSON.stringify({ hostname: "server-01", cpu_cores: 8, ram_bytes: 17179869184 }) : "v2.4.1"];
    case "boolean": return [false, true];
    case "log": return [{ message: "Application started", severity: "info" }, { message: "Worker connected", severity: "info" }, { message: "Retrying upstream connection", severity: "warn" }];
    case "event": {
      const fields: Record<string, Record<string, unknown>> = {
        filesystems: { items: [{ mount_point: "/", device: "/dev/sda1", filesystem_type: "ext4", capacity_bytes: 107374182400, free_bytes: 34359738368, available_bytes: 32212254720 }] },
        top_processes: { items: [{ pid: 1248, name: "worker", cpu_percent: 24.5, resident_memory_bytes: 268435456 }, { pid: 1250, name: "api", cpu_percent: 8.2, resident_memory_bytes: 134217728 }] },
        network_interfaces: { items: [{ name: "eth0", link_state: "up", receive_bytes_per_second: 1048576, transmit_bytes_per_second: 524288, ip_addresses: ["192.0.2.10/24"] }] },
        services: { items: [{ unit: "worker.service", active_state: "active", substate: "running", restart_count: 0 }] },
        hardware: { sensors: [{ sensor: "cpu-temp", value: 42000, unit: "millidegrees_celsius" }], disk_health: [{ device: "/dev/sda", available: true, passed: true }] },
      };
      return [{ name: fields[stream.name] ? "System snapshot" : "Deployment completed", fields: fields[stream.name] ?? { version: "v2.4.1", environment: "production" } }];
    }
  }
}

export function WidgetExample({ stream, widget, onClose }: { stream: SupportStream; widget: Widget; onClose: () => void }) {
  const [width, setWidth] = React.useState(360);
  const samples = React.useMemo(() => exampleValues(stream).map((value, index): Sample => {
    const time = new Date(Date.now() - (3 - index) * 15000).toISOString();
    return { id: index + 1, app_id: "example", stream: stream.name, instance_id: null, timestamp: time, received_at: time, value };
  }), [stream.name, stream.type]);
  const input = { samples: samples.map(({ stream: name, value }) => ({ stream: name, value })), streams: [stream] };
  return <SupportDialog title={`${stream.type} example`} onClose={onClose} footer={<Action label="Back to widget settings" onPress={onClose} />}>
    <Text className={muted}>Sample data only · this preview does not send data or add a widget.</Text>
    <Text className={ink + " font-semibold"}>Input · JSON ingestion body</Text>
    <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }}><Box testID="widget-example-input" className="rounded-lg bg-background-50 dark:bg-[#0A1422]" style={{ padding: 12 }}><Text selectable className={ink + " font-mono text-xs"}>{JSON.stringify(input, null, 2)}</Text></Box></ScrollView>
    <Text className={ink + " font-semibold"}>Output · {widgetLabels[widget.kind]}</Text>
    <Box testID="widget-example-output" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: 240, position: "relative" }}>
      <SupportWidget widget={{ ...widget, id: "example", x: 0, y: 0, w: 12, h: 4 }} stream={stream} page={{ samples, next_before: null }} token="" appId="example" retentionDays={7} cellWidth={width / 12} editing={false} onChange={() => {}} onRemove={() => {}} />
    </Box>
  </SupportDialog>;
}
