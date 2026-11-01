// Example automation scripts shown in the IDE's "See examples" dialog. They only
// use globals from the generated SDK (hh.d.ts); App, stream and VM names are
// placeholders to adapt.
export type AutomationExample = {
  id: string;
  title: string;
  summary: string;
  /** Suggested "Run when" condition; empty for manual runs. */
  condition: string;
  code: string;
};

export const automationExamples: AutomationExample[] = [
  {
    id: "recheck",
    title: "Re-check before warning",
    summary: "Wait 10 s, read the live value again and only warn if it is still high.",
    condition: "app('db').cpu > 95",
    code: `// Fires on "app('db').cpu > 95". A short spike is ignored: the value is read
// again after 10 seconds and the warning goes out only if it is still high.
export default async function ({ ctx, hh, log }: HHAutomationArgs) {
  log.info("fired with", ctx.snapshot);

  await hh.sleep(10_000);

  const cpu = await hh.support.value<number>("db", "cpu");
  if (cpu === undefined) {
    log.warn("db has no current cpu value (missing, or its sender is offline)");
    return;
  }
  if (cpu > 95) {
    await hh.api.notification.sendWarning(\`db CPU still at \${cpu}% after 10 s\`, {
      url: "/automations",
      dedupKey: "db-cpu-high",
    });
  } else {
    log.info(\`false alarm, cpu back to \${cpu}%\`);
  }
}
`,
  },
  {
    id: "wait-recover",
    title: "Wait for recovery, then escalate",
    summary: "Give an offline App two minutes to come back before sending a critical alert.",
    condition: "app('web').connectivity == 'offline'",
    code: `// Fires when the web App goes offline. waitFor polls the condition every
// 5 s for up to 2 minutes and resolves true as soon as it holds.
export default async function ({ hh, log }: HHAutomationArgs) {
  const recovered = await hh.support.waitFor("app('web').connectivity == 'online'", {
    waitMs: 120_000,
    intervalMs: 5_000,
  });

  if (recovered) {
    log.info("web came back on its own");
    return;
  }

  const web = await hh.support.app("web");
  await hh.api.notification.sendCritical(
    \`web has been offline for 2 minutes (health: \${web.health}, \${web.health_message || "no message"})\`,
    { dedupKey: "web-offline" },
  );
}
`,
  },
  {
    id: "restart-vm",
    title: "Restart a VM when its App is unhealthy",
    summary: "Restart the VM that hosts an App, then check that the App recovers.",
    condition: "app('api').health == 'unhealthy'",
    code: `const VM = "api-vm"; // the HyperHive VM that runs the "api" App

export default async function ({ hh, log }: HHAutomationArgs) {
  // Re-check first: the App may have recovered while the run was starting.
  if ((await hh.support.value("api", "health")) !== "unhealthy") {
    log.info("api is no longer unhealthy, nothing to do");
    return;
  }

  log.warn(\`restarting \${VM}\`);
  await hh.api.virsh.postRestartvmByVmName(VM);

  const healthy = await hh.support.waitFor("app('api').health == 'healthy'", { waitMs: 300_000, intervalMs: 10_000 });
  if (healthy) {
    await hh.api.notification.sendInfo(\`\${VM} was restarted and api is healthy again\`);
  } else {
    await hh.api.notification.sendError(\`\${VM} was restarted but api is still not healthy after 5 minutes\`);
  }
}
`,
  },
  {
    id: "vm-report",
    title: "VM status report",
    summary: "List every VM, count running and stopped ones and send a summary.",
    condition: "",
    code: `// Manual run: summarises every VM. state uses the VmState numbers
// (1 running, 3 paused, 5 shut off, 6 crashed).
type VM = { name: string; machineName: string; state: number; currentCpuUsage: number; autoStart: boolean };

const STATE: Record<number, string> = { 0: "unknown", 1: "running", 2: "blocked", 3: "paused", 4: "shutdown", 5: "shut off", 6: "crashed", 7: "suspended", 8: "no state" };

export default async function ({ hh, log }: HHAutomationArgs) {
  const vms: VM[] = await hh.api.virsh.getGetallvms();

  for (const vm of vms) {
    log.info(\`\${vm.machineName.padEnd(12)} \${vm.name.padEnd(24)} \${STATE[vm.state] ?? vm.state}  cpu \${vm.currentCpuUsage}%\`);
  }

  const running = vms.filter((vm) => vm.state === 1).length;
  const crashed = vms.filter((vm) => vm.state === 6).map((vm) => vm.name);
  const message = \`\${running}/\${vms.length} VMs running\` + (crashed.length ? \`, crashed: \${crashed.join(", ")}\` : "");

  if (crashed.length) await hh.api.notification.sendError(message);
  else await hh.api.notification.sendInfo(message);
}
`,
  },
  {
    id: "start-autostart",
    title: "Start VMs that should be running",
    summary: "Start every autostart VM that is shut off.",
    condition: "",
    code: `type VM = { name: string; state: number; autoStart: boolean };
const SHUTOFF = 5;

export default async function ({ hh, log }: HHAutomationArgs) {
  const vms: VM[] = await hh.api.virsh.getGetallvms();
  const stopped = vms.filter((vm) => vm.autoStart && vm.state === SHUTOFF);

  if (!stopped.length) {
    log.info("every autostart VM is running");
    return;
  }

  const failed: string[] = [];
  for (const vm of stopped) {
    try {
      await hh.api.virsh.postStartvmByVmName(vm.name);
      log.info(\`started \${vm.name}\`);
    } catch (err) {
      failed.push(vm.name);
      log.error(\`could not start \${vm.name}:\`, (err as Error).message);
    }
  }

  if (failed.length) {
    await hh.api.notification.sendError(\`Could not start: \${failed.join(", ")}\`);
  }
}
`,
  },
  {
    id: "read-app",
    title: "Read every value of an App",
    summary: "Log health, connectivity and all current streams of an App or one instance.",
    condition: "",
    code: `export default async function ({ hh, log }: HHAutomationArgs) {
  // The App by name or ID; pass an instance ID as the second argument for one instance.
  const db = await hh.support.app("db");

  log.info(\`\${db.name}: \${db.connectivity}, \${db.health}\`, db.health_message);
  for (const [stream, value] of Object.entries(db.streams)) {
    log.info(\`  \${stream} = \${JSON.stringify(value)}\`);
  }

  // Any condition expression can be evaluated on demand as well.
  const result = await hh.support.evaluate("app('db').cpu > 80 && app('db')['disk.used'] > 90");
  log.info("busy and nearly full:", result.value, result.error || "", result.snapshot);
}
`,
  },
  {
    id: "host-load",
    title: "Check host CPU and memory",
    summary: "Read live CPU and memory of every connected host and warn above a limit.",
    condition: "",
    code: `// /protocol/list returns the connected slaves; /info/* reads one host live.
type Host = { MachineName: string; Addr: string; LastSeen: string };

const LIMIT = 90;

export default async function ({ hh, log }: HHAutomationArgs) {
  const hosts: Host[] = await hh.api.protocol.getList();
  const busy: string[] = [];

  for (const host of hosts) {
    const name = host.MachineName;
    const cpu = await hh.api.info.getCpuByMachineName(name);
    const mem = await hh.api.info.getMemByMachineName(name);
    log.info(name, "cpu", cpu, "mem", mem);
    // Inspect the logged shapes once and pick the fields you need, e.g.:
    // if (cpu.usage > LIMIT) busy.push(name);
  }

  if (busy.length) await hh.api.notification.sendWarning(\`Hosts above \${LIMIT}%: \${busy.join(", ")}\`);
}
`,
  },
  {
    id: "webhook",
    title: "Post to a webhook",
    summary: "Forward the fired values to Discord, Slack or any HTTP endpoint with fetch.",
    condition: "app('db').connectivity == 'offline'",
    code: `// Node's built-in fetch needs no package. Scripts have no secrets store, so
// keep this file private or read the URL from a root-only file on the master.
const WEBHOOK = "https://discord.com/api/webhooks/…";

export default async function ({ ctx, log }: HHAutomationArgs) {
  const lines = Object.entries(ctx.snapshot).map(([key, value]) => \`• \${key} = \${JSON.stringify(value)}\`);
  const response = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: \`**\${ctx.automationName}** fired (\${ctx.trigger})\\n\${lines.join("\\n")}\` }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(\`webhook returned \${response.status}: \${await response.text()}\`);
  log.info("webhook sent");
}
`,
  },
  {
    id: "errors",
    title: "Raw requests and errors",
    summary: "Call any master path with hh.request and handle HTTP errors by status.",
    condition: "",
    code: `export default async function ({ hh, log }: HHAutomationArgs) {
  // Every master route also works through hh.request / hh.get / hh.post.
  const vm = "does-not-exist";
  try {
    const info = await hh.get(\`/virsh/getvmbyname/\${encodeURIComponent(vm)}\`, { timeoutMs: 15_000 });
    log.info(info);
  } catch (err: any) {
    // Failed requests throw with .status and .body.
    if (err.status === 404 || err.status === 500) log.warn(\`\${vm}: \${err.status}\`, err.body);
    else throw err; // anything else fails the run and sends automation.failed
  }
}
`,
  },
];
