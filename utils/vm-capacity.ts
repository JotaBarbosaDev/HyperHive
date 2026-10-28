import type { VirtualMachine } from "@/services/vms-client";

export function vmAllocation(vms: VirtualMachine[] | null, host: string) {
  if (!vms) return { cpu: null, ram: null };
  const selected = vms.filter(vm => vm.machineName === host);
  const sum = (field: "DefinedCPUS" | "DefinedRam") => selected.every(vm => typeof vm[field] === "number" && Number.isFinite(vm[field]) && vm[field] >= 0)
    ? selected.reduce((total, vm) => total + vm[field], 0) : null;
  return { cpu: sum("DefinedCPUS"), ram: sum("DefinedRam") };
}
