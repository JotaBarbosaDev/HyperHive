import React from "react";
import { ScrollView } from "react-native";
import { Check } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel } from "@/components/ui/checkbox";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import type { CelldFleet, CelldFleetInput } from "@/types/celld";
import { ErrorMessage, modalClassName, mutedClassName, titleClassName } from "./shared";
import { parseFleetPorts } from "./ports";

type Props = {
  fleet?: CelldFleet;
  machines: string[];
  machinesError?: string | null;
  onClose: () => void;
  onSave: (input: CelldFleetInput) => Promise<void>;
};

export function FleetFormModal({ fleet, machines, machinesError, onClose, onSave }: Props) {
  const [name, setName] = React.useState(fleet?.name ?? "");
  const [servers, setServers] = React.useState(fleet?.servers.map((node) => node.name) ?? []);
  const [http, setHttp] = React.useState(fleet ? String(fleet.ports.http) : "");
  const [internal, setInternal] = React.useState(fleet ? String(fleet.ports.internal) : "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const editablePorts = !fleet || (fleet.desired_state === "stopped" && fleet.status === "stopped");
  const options = [...new Set([...machines, ...servers])].sort();
  const close = () => { if (!pending) onClose(); };

  const save = async () => {
    if (!name.trim() || servers.length === 0) { setError("Enter a name and select at least one server."); return; }
    const input: CelldFleetInput = { name: name.trim(), servers };
    try { if (editablePorts) input.ports = parseFleetPorts(http, internal); }
    catch (err) { setError((err as Error).message); return; }
    setPending(true); setError(null);
    try { await onSave(input); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to save the fleet."); }
    finally { setPending(false); }
  };

  return <Modal isOpen onClose={close} size="lg">
    <ModalBackdrop />
    <ModalContent className={modalClassName}>
      <ModalHeader><Heading size="lg" className={titleClassName}>{fleet ? "Edit fleet" : "Create fleet"}</Heading></ModalHeader>
      <ModalBody>
        <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
          <Box className="gap-5 py-2">
            <Box className="gap-2">
              <Text className={titleClassName}>Fleet name</Text>
              <Input className="rounded-xl" isDisabled={pending}><InputField accessibilityLabel="Fleet name" aria-label="Fleet name" value={name} onChangeText={setName} placeholder="e.g. payments" autoCapitalize="none" maxLength={128} /></Input>
            </Box>
            <Box className="gap-2">
              <Text className={titleClassName}>Servers · {servers.length} selected</Text>
              <Text className={mutedClassName}>Choose the servers for this fleet. A server can run several fleets.</Text>
              {options.length === 0 ? <Text className={mutedClassName}>No servers available. Refresh the machine list and try again.</Text> : null}
              {options.map((machine) => {
                const selected = servers.includes(machine);
                return <Checkbox key={machine} value={machine} isChecked={selected} isDisabled={pending} aria-label={machine}
                  onChange={(checked) => setServers((current) => checked ? [...new Set([...current, machine])] : current.filter((value) => value !== machine))}
                  className={"gap-3 p-3 rounded-xl border " + (selected ? "border-primary-500 bg-primary-50 dark:bg-[#12263F]" : "border-outline-100 dark:border-[#2A3B52]")}>
                  <CheckboxIndicator><CheckboxIcon as={Check} /></CheckboxIndicator>
                  <CheckboxLabel className={titleClassName}>{machine}</CheckboxLabel>
                </Checkbox>;
              })}
              <ErrorMessage message={machinesError} />
            </Box>
            <Box className="gap-2">
              <Text className={titleClassName}>Ports</Text>
              <Text className={mutedClassName}>{!fleet ? "Leave both blank for automatic assignment. Set HTTP only to use the next port internally, or choose both ports." : editablePorts ? "This fleet is stopped. You can change both ports, or set HTTP and leave internal blank to use the next port. Leave both blank to keep the current ports." : "Stop the fleet before changing its ports."}</Text>
              <Box className="flex-row gap-3">
                <Box className="flex-1 gap-1">
                  <Text className={mutedClassName}>HTTP port</Text>
                  <Input className="rounded-xl" isDisabled={pending || !editablePorts}><InputField accessibilityLabel="HTTP port" aria-label="HTTP port" value={http} onChangeText={setHttp} keyboardType="number-pad" placeholder="Auto" /></Input>
                </Box>
                <Box className="flex-1 gap-1">
                  <Text className={mutedClassName}>Internal port</Text>
                  <Input className="rounded-xl" isDisabled={pending || !editablePorts}><InputField accessibilityLabel="Internal port" aria-label="Internal port" value={internal} onChangeText={setInternal} keyboardType="number-pad" placeholder={/^\d+$/.test(http.trim()) && Number(http) > 0 && Number(http) < 65535 ? String(Number(http) + 1) + " (auto)" : "Auto"} /></Input>
                </Box>
              </Box>
            </Box>
            <Text className={mutedClassName}>{fleet ? "Membership changes keep the bucket. New servers are verified before removed servers drain. A stopped fleet stays stopped." : "Creation saves the fleet and starts provisioning in the background."}</Text>
            <ErrorMessage message={error} />
          </Box>
        </ScrollView>
      </ModalBody>
      <ModalFooter className="gap-3 pt-4">
        <Button className="flex-1 rounded-xl" variant="outline" action="secondary" onPress={close} isDisabled={pending}><ButtonText>Cancel</ButtonText></Button>
        <Button className="flex-1 rounded-xl gap-2" onPress={() => { void save(); }} isDisabled={pending}>
          {pending ? <ButtonSpinner /> : null}<ButtonText>{pending ? "Saving…" : fleet ? "Save changes" : "Create fleet"}</ButtonText>
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>;
}
