export type K8sTlsSansResponse = {
	ips: string[];
};

export type K8sClusterNode = {
	machine: string;
	addr: string;
	connected: boolean;
	lastSeen: string;
	tlsSANs?: string[];
	error?: string;
};

export type K8sClusterStatusResponse = {
	connected: K8sClusterNode[];
	disconnected: K8sClusterNode[];
};
