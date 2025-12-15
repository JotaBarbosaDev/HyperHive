import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { apiFetch, setAuthToken, triggerUnauthorized } from "@/services/api-client";
import { loadApiBaseUrl, loadAuthToken } from "@/services/auth-storage";
import {
	CloneGitInput,
	CreateContainerInput,
	CreateNetworkInput,
	CreateVolumeInput,
	DockerContainer,
	DockerGitEntry,
	DockerImage,
	DockerNetwork,
	DockerVolume,
	PullImageInput,
	RemoveImageInput,
	RemoveVolumeInput,
	RenameContainerInput,
	UpdateContainerInput,
	UpdateGitInput,
} from "@/types/docker";

const ensureApiBaseUrl = async () => {
	let baseUrl = getApiBaseUrl();
	if (baseUrl) return baseUrl;
	const storedBaseUrl = await loadApiBaseUrl();
	if (storedBaseUrl) {
		baseUrl = setApiBaseUrl(storedBaseUrl) ?? null;
	}
	if (!baseUrl) {
		throw new Error("Base domain/API not configured. Sign in again.");
	}
	return baseUrl;
};

const resolveToken = async () => {
	await ensureApiBaseUrl();
	const storedToken = await loadAuthToken();
	if (!storedToken) {
		setAuthToken(null);
		triggerUnauthorized();
		throw new Error("Invalid authentication token.");
	}
	setAuthToken(storedToken);
	return storedToken;
};

const encodeMachine = (machineName: string) => encodeURIComponent(machineName);

export async function listDockerImages(machineName: string): Promise<{ imgs: DockerImage[] }> {
	const token = await resolveToken();
	return apiFetch<{ imgs: DockerImage[] }>(`/docker/images/${encodeMachine(machineName)}`, {
		token,
	});
}

export async function pullDockerImage(machineName: string, payload: PullImageInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/images/download/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function removeDockerImage(machineName: string, payload: RemoveImageInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/images/remove/${encodeMachine(machineName)}`, {
		method: "DELETE",
		token,
		body: {
			image_id: payload.image_id,
			force: Boolean(payload.force),
			prune_child: Boolean(payload.prune_child),
		},
	});
}

export async function listDockerContainers(machineName: string): Promise<{ containers: DockerContainer[] }> {
	const token = await resolveToken();
	return apiFetch<{ containers: DockerContainer[] }>(`/docker/containers/${encodeMachine(machineName)}`, {
		token,
	});
}

export async function createDockerContainer(machineName: string, payload: CreateContainerInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/create/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function removeDockerContainer(
	machineName: string,
	payload: { container_id: string; force?: boolean }
): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/remove/${encodeMachine(machineName)}`, {
		method: "DELETE",
		token,
		body: {
			container_id: payload.container_id,
			force: Boolean(payload.force),
		},
	});
}

export async function stopDockerContainer(machineName: string, containerId: string): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/stop/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: { container_id: containerId },
	});
}

export async function startDockerContainer(machineName: string, containerId: string): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/start/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: { container_id: containerId },
	});
}

export async function restartDockerContainer(machineName: string, containerId: string): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/restart/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: { container_id: containerId },
	});
}

export async function pauseDockerContainer(machineName: string, containerId: string): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/pause/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: { container_id: containerId },
	});
}

export async function unpauseDockerContainer(machineName: string, containerId: string): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/unpause/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: { container_id: containerId },
	});
}

export async function killDockerContainer(
	machineName: string,
	containerId: string,
	signal?: string
): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/kill/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: { container_id: containerId, signal: signal ?? "SIGKILL" },
	});
}

export async function updateDockerContainer(machineName: string, payload: UpdateContainerInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/update/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function streamDockerContainerLogs(
	machineName: string,
	payload: { container_id: string; tail?: number; stream_id: string },
	options?: { signal?: AbortSignal }
): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/logs/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
		signal: options?.signal,
	});
}

export async function renameDockerContainer(machineName: string, payload: RenameContainerInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/containers/rename/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function listDockerVolumes(machineName: string): Promise<{ Volumes: DockerVolume[] }> {
	const token = await resolveToken();
	return apiFetch<{ Volumes: DockerVolume[] }>(`/docker/volumes/${encodeMachine(machineName)}`, {
		token,
	});
}

export async function createDockerVolume(machineName: string, payload: CreateVolumeInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/volumes/create/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function removeDockerVolume(machineName: string, payload: RemoveVolumeInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/volumes/remove/${encodeMachine(machineName)}`, {
		method: "DELETE",
		token,
		body: {
			VolumeId: payload.VolumeId,
			Force: Boolean(payload.Force),
		},
	});
}

export async function listDockerNetworks(machineName: string): Promise<{ Networks: DockerNetwork[] }> {
	const token = await resolveToken();
	return apiFetch<{ Networks: DockerNetwork[] }>(`/docker/networks/${encodeMachine(machineName)}`, {
		token,
	});
}

export async function createDockerNetwork(machineName: string, payload: CreateNetworkInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/networks/create/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function removeDockerNetwork(machineName: string, name: string): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/networks/remove/${encodeMachine(machineName)}`, {
		method: "DELETE",
		token,
		body: { Name: name },
	});
}

export async function listDockerGit(machineName: string): Promise<{ Elems: DockerGitEntry[] }> {
	const token = await resolveToken();
	return apiFetch<{ Elems: DockerGitEntry[] }>(`/docker/git/${encodeMachine(machineName)}`, {
		token,
	});
}

export async function cloneDockerGit(machineName: string, payload: CloneGitInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/git/clone/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function updateDockerGit(machineName: string, payload: UpdateGitInput): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/git/update/${encodeMachine(machineName)}`, {
		method: "POST",
		token,
		body: payload,
	});
}

export async function removeDockerGit(machineName: string, name: string): Promise<void> {
	const token = await resolveToken();
	await apiFetch<void>(`/docker/git/remove/${encodeMachine(machineName)}`, {
		method: "DELETE",
		token,
		body: { name },
	});
}
