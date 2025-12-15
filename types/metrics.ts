export type CpuCoreInfo = {
	usage: number;
	temp?: number;
};

export type CpuInfo = {
	cores: CpuCoreInfo[];
};

export type UptimeInfo = {
	uptime: string;
};

export type MemInfo = {
	usedPercent: number;
	freePercent: number;
	totalMb: number;
	usedMb: number;
	freeMb: number;
};

export type DiskDevice = {
	device: string;
	mountPoint: string;
	fstype: string;
	total: string;
	free: string;
	used: string;
	usedPercent: number;
	opts: string[];
	temperatureC?: string | number;
};

export type DiskIoStat = {
	device: string;
	readCount: string;
	writeCount: string;
	readBytes: string;
	writeBytes: string;
	readTime: string;
	writeTime: string;
	iopsInProgress: string;
	ioTime: string;
	weightedIo: string;
	mergedReadCount?: string;
	mergedWriteCount?: string;
};

export type DiskInfo = {
	disks: DiskDevice[];
	usage?: Record<string, number>;
	io?: DiskIoStat[];
	systemCache?: {
		device: string;
		dirtyKb: string;
		writebackKb: string;
		writebackTmpKb: string;
	} | null;
};

export type NetworkInterface = {
	name: string;
	mtu: number;
	hardwareAddr: string;
	flags: string[];
	addrs: string[];
};

export type NetworkStat = {
	name: string;
	bytesSent: string;
	bytesRecv: string;
	packetsSent: string;
	packetsRecv: string;
};

export type NetworkInfo = {
	interfaces: NetworkInterface[];
	stats: NetworkStat[];
	usage?: Record<string, string | number>;
};

export type HistoryEntry<TInfo> = {
	id: number;
	machine_name: string;
	captured_at: string;
	info: TInfo;
};
