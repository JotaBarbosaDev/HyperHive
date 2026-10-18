import React from "react";
import * as Clipboard from "expo-clipboard";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { getCelldCredentials } from "@/services/celld";
import type {
  CelldCredentials,
  CelldDetailTab,
  CelldFleet,
} from "@/types/celld";
import { FleetOverview, FleetRecords } from "./FleetObservability";
import type { CelldObservationQuery } from "@/types/celld";
import { useOperationsNavigation } from "@/hooks/useOperationsNavigation";
import { FleetWorkloads } from "./OperationsWorkloads";
import { OperationsShell } from "./OperationsShell";
import {
  ErrorMessage,
  mutedClassName,
  observedAt,
  StatusBadge,
  titleClassName,
} from "./shared";

const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
export function FleetDetailsModal({
  fleet,
  token,
  onClose,
  initialTab = "overview",
}: {
  fleet: CelldFleet;
  token: string;
  onClose: () => void;
  initialTab?: CelldDetailTab;
}) {
  const navigation = useOperationsNavigation(initialTab);
  const { tab } = navigation;
  const [keys, setKeys] = React.useState<CelldCredentials | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  const controller = React.useRef<AbortController | null>(null);
  const active = React.useRef(true);
  const tabRef = React.useRef(tab);
  tabRef.current = tab;
  React.useEffect(() => {
    active.current = true;
    setKeys(null);
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, [fleet.id, token]);
  React.useEffect(() => {
    if (tab !== "deployment") {
      controller.current?.abort();
      setKeys(null);
      setPending(false);
      setMessage("");
      setError(null);
    }
  }, [tab]);
  const reveal = async () => {
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 20000);
    setPending(true);
    setError(null);
    try {
      const result = await getCelldCredentials(token, fleet.id, request.signal);
      if (active.current && !request.signal.aborted) setKeys(result);
    } catch (err) {
      if (
        active.current &&
        tabRef.current === "deployment" &&
        controller.current === request
      )
        setError(
          request.signal.aborted
            ? "The request timed out."
            : err instanceof Error
              ? err.message
              : "Unable to load credentials.",
        );
    } finally {
      clearTimeout(timeout);
      if (active.current && controller.current === request) setPending(false);
    }
  };
  const copy = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      if (active.current && tabRef.current === "deployment")
        setMessage(label + " copied.");
    } catch {
      if (active.current && tabRef.current === "deployment")
        setError(
          "Unable to access the clipboard. Select and copy the text instead.",
        );
    }
  };
  const environment = keys
    ? "export AWS_ACCESS_KEY_ID=" +
      shellQuote(keys.aws_access_key_id) +
      "\nexport AWS_SECRET_ACCESS_KEY=" +
      shellQuote(keys.aws_secret_access_key) +
      "\nexport AWS_REGION=" +
      shellQuote(fleet.storage.region)
    : "";
  return (
    <OperationsShell
      name={fleet.name}
      fleetId={fleet.id}
      status={fleet.status}
      tab={tab}
      onTab={(name) => {
        navigation.selectTab(name);
        if (name !== "deployment") setKeys(null);
      }}
      onClose={onClose}
    >
      <Box className="gap-5">
        {tab === "overview" ? (
          <FleetOverview
            token={token}
            fleetId={fleet.id}
            onNavigate={navigation.inspect}
            onWorkloads={navigation.openWorkloads}
          />
        ) : tab === "workloads" ? (
          <FleetWorkloads
            token={token}
            fleetId={fleet.id}
            initialNode={navigation.workloadNode}
            onNodeChange={navigation.setWorkloadNode}
            onNavigate={navigation.inspect}
          />
        ) : tab !== "deployment" ? (
          <FleetRecords
            key={tab}
            token={token}
            fleetId={fleet.id}
            kind={tab as "logs" | "metrics" | "events" | "trace"}
            initialTrace={navigation.selection?.traceId}
            initialQuery={navigation.selection?.query}
            onTrace={navigation.openTrace}
            onStateChange={navigation.remember}
          />
        ) : (
          <Box className="bg-background-0 dark:bg-[#0E1524] p-5 rounded-lg gap-5">
            <Box className="gap-1">
              <Text selectable className={mutedClassName}>
                ID: {fleet.id}
              </Text>
              <Text className={mutedClassName}>
                Desired: {fleet.desired_state} · Checked:{" "}
                {observedAt(fleet.checked_at)}
              </Text>
            </Box>
            <ErrorMessage message={fleet.error} />
            <Box className="gap-3">
              <Heading size="sm" className={titleClassName}>
                Servers
              </Heading>
              {fleet.servers.map((node) => (
                <Box
                  key={node.name}
                  className="gap-2 p-3 rounded-xl border border-outline-100 dark:border-[#2A3B52]"
                >
                  <Box className="flex-row flex-wrap justify-between gap-2">
                    <Text
                      selectable
                      className={"font-semibold " + titleClassName}
                    >
                      {node.name}
                    </Text>
                    <StatusBadge
                      value={
                        node.healthy
                          ? "ready"
                          : node.running
                            ? "starting"
                            : node.connected
                              ? "stopped"
                              : "offline"
                      }
                    />
                  </Box>
                  <Text selectable className={mutedClassName}>
                    {node.ip || "IP pending"} · HTTP{" "}
                    {node.ports?.http || "pending"} · Internal{" "}
                    {node.ports?.internal || "pending"}
                  </Text>
                  {node.url ? (
                    <Text
                      selectable
                      className="text-sm text-primary-600 dark:text-primary-300"
                    >
                      {node.url}
                    </Text>
                  ) : null}
                  <ErrorMessage message={node.error} />
                </Box>
              ))}
            </Box>
            <Box className="gap-2">
              <Heading size="sm" className={titleClassName}>
                Deploy from the CLI
              </Heading>
              {fleet.desired_state === "deleting" ? (
                <Text className={mutedClassName}>
                  Deployment is unavailable while deletion is pending.
                </Text>
              ) : null}
              <Text className={mutedClassName}>
                Use a machine on the management network. Set the fleet
                credentials in your shell, then run this command in your
                Wrangler project.
              </Text>
              <Text selectable className={mutedClassName}>
                Bucket: {fleet.storage.bucket}
              </Text>
              <Text selectable className={mutedClassName}>
                Endpoint: {fleet.storage.endpoint || "Pending storage setup"}
              </Text>
              <Text selectable className={mutedClassName}>
                Region: {fleet.storage.region}
              </Text>
              <Box className="p-3 rounded-xl bg-background-50 dark:bg-[#070D19]">
                <Text
                  selectable
                  className={"text-sm font-mono " + titleClassName}
                >
                  {fleet.deploy.command}
                </Text>
              </Box>
              <Button
                className="self-start rounded-xl"
                variant="outline"
                action="secondary"
                isDisabled={
                  !fleet.storage.endpoint || fleet.desired_state === "deleting"
                }
                onPress={() => {
                  void copy(fleet.deploy.command, "Deploy command");
                }}
              >
                <ButtonText>Copy deploy command</ButtonText>
              </Button>
              {fleet.urls.length ? (
                <Box className="gap-1">
                  <Text className={titleClassName}>Application URLs</Text>
                  {fleet.urls.map((url) => (
                    <Text
                      key={url}
                      selectable
                      className="text-sm text-primary-600 dark:text-primary-300"
                    >
                      {url}
                    </Text>
                  ))}
                </Box>
              ) : (
                <Text className={mutedClassName}>
                  Application URLs appear when the servers become ready.
                </Text>
              )}
            </Box>
            <Box className="gap-3">
              <Heading size="sm" className={titleClassName}>
                Scoped credentials
              </Heading>
              <Text className={mutedClassName}>
                Credentials control this fleet's bucket. They are fetched only
                when you reveal them and cleared when you close this view.
              </Text>
              {keys ? (
                <>
                  <Box className="p-3 rounded-xl bg-background-50 dark:bg-[#070D19] gap-2">
                    <Text
                      selectable
                      className={"text-sm font-mono " + titleClassName}
                    >
                      {environment}
                    </Text>
                  </Box>
                  <Box className="flex-row flex-wrap gap-2">
                    <Button
                      className="rounded-xl"
                      variant="outline"
                      action="secondary"
                      onPress={() => {
                        void copy(environment, "Environment settings");
                      }}
                    >
                      <ButtonText>Copy environment</ButtonText>
                    </Button>
                    <Button
                      className="rounded-xl"
                      variant="outline"
                      action="secondary"
                      onPress={() => {
                        setKeys(null);
                        setMessage("");
                      }}
                    >
                      <ButtonText>Hide credentials</ButtonText>
                    </Button>
                  </Box>
                </>
              ) : (
                <Button
                  className="self-start rounded-xl gap-2"
                  variant="outline"
                  action="secondary"
                  isDisabled={pending || fleet.desired_state === "deleting"}
                  onPress={() => {
                    void reveal();
                  }}
                >
                  {pending ? <ButtonSpinner /> : null}
                  <ButtonText>
                    {pending ? "Loading credentials…" : "Reveal credentials"}
                  </ButtonText>
                </Button>
              )}
            </Box>
          </Box>
        )}
        <ErrorMessage message={error} />
        {message ? (
          <Text accessibilityLiveRegion="polite" className={mutedClassName}>
            {message}
          </Text>
        ) : null}
      </Box>
    </OperationsShell>
  );
}
