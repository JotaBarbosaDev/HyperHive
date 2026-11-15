export type GpuMode = "none" | "host" | "vm";

export type PciGpu = {
  node_name?: string;
  path?: string;
  address?: string;
  bus?: number;
  vendor?: string;
  vendor_id?: string;
  product?: string;
  product_id?: string;
  class?: string;
  iommu_group?: number;
  numa_node?: number;
  attached_to_vms?: string[];
  attachedToVms?: string[];
  driver?: string;
  /** What the GPU is bound to right now. */
  actual_mode?: GpuMode;
  /** What HyperHive enforces when the machine connects. */
  desired_mode?: GpuMode;
  desired_vm?: string;
  /** Why the desired mode could not be applied last time. */
  last_error?: string;
  boot_vga?: boolean;
  /** Driver used by host mode; missing when the vendor is not supported. */
  host_driver?: string;
  [key: string]: unknown;
};

export type PciHostResponse = {
  gpus?: PciGpu[];
} | PciGpu[];

export type PciGpuModePayload = {
  gpu_ref: string;
  mode: GpuMode;
  vm_name?: string;
};
