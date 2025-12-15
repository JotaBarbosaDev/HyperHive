import React from "react";

type SelectedMachineContextValue = {
	selectedMachine: string | null;
	setSelectedMachine: (machine: string | null) => void;
};

const SelectedMachineContext = React.createContext<SelectedMachineContextValue | undefined>(undefined);

const STORAGE_KEY = "hyperhive_selected_machine";

const loadFromStorage = () => {
	if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
		return null;
	}
	try {
		return window.localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
};

const saveToStorage = (value: string | null) => {
	if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
		return;
	}
	try {
		if (value == null) {
			window.localStorage.removeItem(STORAGE_KEY);
		} else {
			window.localStorage.setItem(STORAGE_KEY, value);
		}
	} catch {
		// ignore storage failures
	}
};

export const SelectedMachineProvider = ({ children }: { children: React.ReactNode }) => {
	const [selectedMachine, setSelectedMachineState] = React.useState<string | null>(null);

	React.useEffect(() => {
		const stored = loadFromStorage();
		if (stored) {
			setSelectedMachineState(stored);
		}
	}, []);

	const setSelectedMachine = React.useCallback((machine: string | null) => {
		setSelectedMachineState(machine);
		saveToStorage(machine);
	}, []);

	const value = React.useMemo(
		() => ({ selectedMachine, setSelectedMachine }),
		[selectedMachine, setSelectedMachine]
	);

	return <SelectedMachineContext.Provider value={value}>{children}</SelectedMachineContext.Provider>;
};

export const useSelectedMachine = () => {
	const ctx = React.useContext(SelectedMachineContext);
	if (!ctx) {
		throw new Error("useSelectedMachine must be used within SelectedMachineProvider");
	}
	return ctx;
};
