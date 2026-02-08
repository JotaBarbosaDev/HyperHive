// ----- CPU Topology (GET /virsh/cputopology/:machine_name) -----

export type CpuCore = {
  coreIndex: number;
  physicalId: number;
  siblings: number[];
};

export type CpuSocket = {
  socketId: number;
  cores: CpuCore[];
};

export type CpuTopology = {
  sockets: CpuSocket[];
};

// ----- CPU Pinning (GET /virsh/cpupinning/:vm_name) -----

export type CpuPin = {
  vcpu: number;
  cpuset: string;
  isHt: boolean;
};

export type CpuPinningInfo = {
  hasPinning: boolean;
  pins: CpuPin[];
  rangeStart: number;
  rangeEnd: number;
  hyperThreading: boolean;
  socketId: number;
};

// ----- CPU Pinning Save (POST /virsh/cpupinning/:vm_name) -----

export type CpuPinningPayload = {
  range_start: number;
  range_end: number;
  hyper_threading: boolean;
  SocketID: number;
};
