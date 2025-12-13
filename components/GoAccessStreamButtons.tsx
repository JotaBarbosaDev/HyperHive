"use client";
import React, { useEffect, useState } from "react";
import { Platform, Alert } from "react-native";
import * as Linking from "expo-linking";
import { usePathname } from "expo-router";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { ExternalLink } from "lucide-react-native";
import { loadApiBaseUrl, API_BASE_URL_STORAGE_KEY } from "@/services/auth-storage";
import { getApiBaseUrl } from "@/config/apiConfig";

const GoAccessStreamButtons: React.FC = () => {
	const [baseUrl, setBaseUrl] = useState<string | null>(getApiBaseUrl() ?? null);
	const pathname = usePathname();

	const ALLOWED_PATHS = [
		"/404",
		"/certificates",
		"/redirection",
		"/streams",
		"/proxy",
	];

	useEffect(() => {
		let isMounted = true;
		const init = async () => {
			const stored = await loadApiBaseUrl();
			if (!isMounted) return;
			setBaseUrl(stored ?? getApiBaseUrl() ?? null);
		};
		init();

		if (Platform.OS === "web") {
			const handler = async (event: StorageEvent) => {
				if (!event.key || event.key === API_BASE_URL_STORAGE_KEY) {
					const stored = await loadApiBaseUrl();
					setBaseUrl(stored ?? getApiBaseUrl() ?? null);
				}
			};
			window.addEventListener("storage", handler);
			return () => window.removeEventListener("storage", handler);
		}

		return () => {
			isMounted = false;
		};
	}, []);

	const openPath = async (pathSuffix: string) => {
		const base = baseUrl ?? getApiBaseUrl();
		if (!base) {
			Alert.alert("API base URL não definida");
			return;
		}
		const url = `${base}${pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`}`;
		try {
			if (Platform.OS === "web") {
				window.open(url, "_blank", "noopener,noreferrer");
			} else {
				await Linking.openURL(url);
			}
		} catch (err) {
			console.warn("Failed to open URL", err);
			Alert.alert("Falha ao abrir o link", String(err));
		}
	};

	if (!baseUrl && !getApiBaseUrl()) return null;

	if (!pathname || !ALLOWED_PATHS.includes(pathname)) {
		return null;
	}

	return (
		<Box className="absolute top-3 right-3 web:top-5 web:right-5 z-20 flex-row gap-2" pointerEvents="box-none">
			<Button size="sm" variant="outline" action="secondary" onPress={() => openPath("/goaccess")}>
				<ButtonIcon as={ExternalLink} />
				<ButtonText>Open GoAccess</ButtonText>
			</Button>
			<Button size="sm" variant="outline" action="secondary" onPress={() => openPath("/streamInfo")}>
				<ButtonIcon as={ExternalLink} />
				<ButtonText>Open StreamInfo</ButtonText>
			</Button>
		</Box>
	);
};

export default GoAccessStreamButtons;
