export type DockerImage = {
	id: string;
	created: number;
	size?: number;
	shared_size?: number;
	containers?: number;
	repo_tags?: string[];
	repo_digests?: string[];
	labels?: Record<string, string>;
};

export type DockerContainerPort = {
	IP?: string;
	PrivatePort: number;
	PublicPort?: number;
	Type?: string;
};

export type DockerContainer = {
	Id: string;
	Names: string[];
	Image: string;
	ImageID?: string;
	Command?: string;
	Created: number;
	Ports?: DockerContainerPort[];
	Labels?: Record<string, string>;
	State?: number | string;
	Status?: string;
	HostConfig?: {
		NetworkMode?: string;
	};
	NetworkSettings?: {
		Networks?: Record<
			string,
			{
				MacAddress?: string;
				NetworkID?: string;
				EndpointID?: string;
				Gateway?: string;
				IPAddress?: string;
				IPPrefixLen?: number;
			}
		>;
	};
	Mounts?: Array<{
		Source?: string;
		Destination?: string;
		RW?: boolean;
		Propagation?: string;
	}>;
	Memory?: number;
	CPUS?: number;
	Restart?: "no" | "always" | "unless-stopped";
};

export type DockerVolume = {
	CreatedAt: string;
	Driver: string;
	Mountpoint: string;
	Name: string;
	Labels?: Record<string, string>;
	Options?: Record<string, string>;
	Scope?: string;
	DiskSpace?: {
		Total?: number;
		Free?: number;
		Used?: number;
	};
};

export type DockerNetwork = {
	Name: string;
	Id: string;
	Scope?: string;
	Driver?: string;
	IPAM?: {
		Driver?: string;
		Config?: Array<{
			Subnet?: string;
			Gateway?: string;
		}>;
	};
	Options?: Record<string, string>;
};

export type DockerGitEntry = {
	Name: string;
	RepoLink: string;
};

export type PullImageInput = {
	image: string;
	registry?: string;
};

export type RemoveImageInput = {
	image_id: string;
	force?: boolean;
	prune_child?: boolean;
};

export type PortMappingInput = {
	ContainerPort: string;
	HostPort?: string;
};

export type VolumeMappingInput = {
	HostPath: string;
	ContainerPath: string;
};

export type EnvVarInput = {
	Key: string;
	Value: string;
};

export type CreateContainerInput = {
	Image: string;
	Name?: string;
	Command?: string[];
	EntryPoint?: string[];
	Ports?: PortMappingInput[];
	Volumes?: VolumeMappingInput[];
	Envs?: EnvVarInput[];
	Network?: string;
	Restart?: "no" | "always" | "unless-stopped";
	Detach?: boolean;
	Memory?: number;
	CPUS?: number;
};

export type UpdateContainerInput = {
	container_id: string;
	memory?: number;
	cpus?: number;
	restart?: "no" | "always" | "unless-stopped";
};

export type RenameContainerInput = {
	container_id: string;
	new_name: string;
};

export type CreateVolumeInput = {
	Name: string;
	Folder?: string;
	nfs_id?: number;
	Labels?: Record<string, string>;
};

export type RemoveVolumeInput = {
	VolumeId: string;
	Force?: boolean;
};

export type CreateNetworkInput = {
	name: string;
	type: "macvlan" | "bridge";
};

export type CloneGitInput = {
	link: string;
	folder_to_run?: string;
	name: string;
	id?: string;
	env?: Record<string, string>;
};

export type UpdateGitInput = {
	name: string;
	id?: string;
	env?: Record<string, string>;
};
