import { useCallback, useEffect, useRef, useState } from "react";
import { listMachines } from "@/services/hyperhive";
import { Machine } from "@/types/machine";

export function useMachines(token?: string | null) {
	const [machines, setMachines] = useState<Machine[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const isMountedRef = useRef(true);

	const fetchMachines = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
		if (!token) {
			setMachines([]);
			setIsLoading(false);
			setIsRefreshing(false);
			return;
		}
		if (mode === "initial") {
			setIsLoading(true);
		} else {
			setIsRefreshing(true);
		}
		try {
			const list = await listMachines();
			if (!isMountedRef.current) return;
			setMachines(Array.isArray(list) ? list : []);
			setError(null);
		} catch (err) {
			if (!isMountedRef.current) return;
			const message = err instanceof Error ? err.message : "Unable to load machines.";
			setError(message);
		} finally {
			if (!isMountedRef.current) return;
			if (mode === "initial") {
				setIsLoading(false);
			} else {
				setIsRefreshing(false);
			}
		}
	}, [token]);

	useEffect(() => {
		isMountedRef.current = true;
		fetchMachines("initial");
		return () => {
			isMountedRef.current = false;
		};
	}, [fetchMachines]);

	return {
		machines,
		isLoading,
		isRefreshing,
		error,
		refresh: fetchMachines,
	};
}
