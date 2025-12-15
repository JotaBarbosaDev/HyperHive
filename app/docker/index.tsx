import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function DockerIndexScreen() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/docker/images" as any);
	}, [router]);

	return null;
}
