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
  [key: string]: unknown;
};

export type PciHostResponse = {
  gpus?: PciGpu[];
} | PciGpu[];

export type PciVmGpuActionPayload = {
  vm_name: string;
  gpu_ref: string;
};
