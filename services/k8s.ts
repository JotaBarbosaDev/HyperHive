import { getApiBaseUrl, setApiBaseUrl } from "@/config/apiConfig";
import { apiFetch, setAuthToken, triggerUnauthorized } from "./api-client";
import { loadApiBaseUrl, loadAuthToken } from "./auth-storage";
import { K8sClusterStatusResponse, K8sTlsSansResponse } from "@/types/k8s";

const ensureApiBaseUrl = async () => {
	let baseUrl = getApiBaseUrl();
	if (baseUrl) {
		return baseUrl;
	}
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

export async function fetchK8sTlsSans(): Promise<string[]> {
	const authToken = await resolveToken();
	const response = await apiFetch<K8sTlsSansResponse>("/k8s/tls-sans", {
		token: authToken,
	});
	return Array.isArray(response?.ips) ? response.ips : [];
}

export async function fetchK8sClusterStatus(): Promise<K8sClusterStatusResponse> {
	const authToken = await resolveToken();
	const response = await apiFetch<K8sClusterStatusResponse>("/k8s/cluster/status", {
		token: authToken,
	});
	return {
		connected: Array.isArray(response?.connected) ? response.connected : [],
		disconnected: Array.isArray(response?.disconnected) ? response.disconnected : [],
	};
}

export async function downloadK8sConnectionFile(ip: string): Promise<string> {
	if (!ip) {
		throw new Error("IP address is required.");
	}
	const authToken = await resolveToken();
	return apiFetch<string>("/k8s/connection-file", {
		method: "POST",
		token: authToken,
		body: { ip },
		headers: { Accept: "*/*" },
	});
}
