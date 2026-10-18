import React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import type { CelldAction, CelldFleet } from "@/types/celld";
import { ErrorMessage, modalClassName, mutedClassName, titleClassName } from "./shared";

export function FleetActionModal({ fleet, action, onClose, onConfirm }: {
  fleet: CelldFleet; action: CelldAction; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const label = action[0].toUpperCase() + action.slice(1);
  const close = () => { if (!pending) onClose(); };
  const confirm = async () => {
    setPending(true); setError(null);
    try { await onConfirm(); } catch (err) { setError(err instanceof Error ? err.message : "The request failed."); }
    finally { setPending(false); }
  };
  return <Modal isOpen onClose={close} size="md">
    <ModalBackdrop /><ModalContent className={modalClassName}>
      <ModalHeader><Heading size="lg" className={titleClassName}>{label} {fleet.name}?</Heading></ModalHeader>
      <ModalBody><Box className="gap-4 py-2">
        <Text className={mutedClassName}>{action === "delete" ?
          "This permanently removes the fleet's processes, local data, bucket contents and credentials. Cleanup waits for offline servers; deletion stays pending until every server is cleaned up." :
          action === "stop" ? "Drain the selected servers and disable automatic resume. The bucket and local data are kept for the next start." :
          fleet.servers.length === 1 ? "This fleet has one server. Its application will be interrupted while the process restarts." :
          "Restart one server at a time, waiting for readiness before continuing. The bucket and application data are kept."}</Text>
        {action === "delete" ? <>
          <Text selectable className={mutedClassName}>Bucket: {fleet.storage.bucket}</Text>
          <Text className={titleClassName}>Type {fleet.name} to confirm</Text>
          <Input className="rounded-xl" isDisabled={pending}><InputField accessibilityLabel="Confirm fleet name" aria-label="Confirm fleet name" value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" /></Input>
        </> : null}
        <ErrorMessage message={error} />
      </Box></ModalBody>
      <ModalFooter className="gap-3 pt-4">
        <Button className="flex-1 rounded-xl" variant="outline" action="secondary" onPress={close} isDisabled={pending}><ButtonText>Cancel</ButtonText></Button>
        <Button className="flex-1 rounded-xl gap-2" action={action === "delete" ? "negative" : "primary"} isDisabled={pending || (action === "delete" && confirmation !== fleet.name)} onPress={() => { void confirm(); }}>
          {pending ? <ButtonSpinner /> : null}<ButtonText>{pending ? "Sending…" : label + " fleet"}</ButtonText>
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>;
}
