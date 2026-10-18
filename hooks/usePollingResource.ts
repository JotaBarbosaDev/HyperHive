import React from "react";

export function usePollingResource<T>(loader: (token: string, signal: AbortSignal) => Promise<T>, token: string | null, isChecking: boolean, intervalMs = 30000) {
  const [data, setData] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null);
  const refreshRef = React.useRef<(force?: boolean) => Promise<void>>(async () => {});

  React.useEffect(() => {
    setData(null); setUpdatedAt(null); setError(null); setIsLoading(Boolean(token)); setIsRefreshing(false);
    if (isChecking || !token) return;
    let active = true;
    let inFlight = false;
    let generation = 0;
    let controller: AbortController | null = null;
    const load = async (force = false) => {
      if (!active || (inFlight && !force)) return;
      if (force) controller?.abort();
      const current = ++generation;
      inFlight = true;
      setIsRefreshing(true);
      const request = new AbortController(); controller = request;
      const timeout = setTimeout(() => request.abort(), 20000);
      try {
        const result = await loader(token, request.signal);
        if (!active || current !== generation) return;
        setData(result); setUpdatedAt(new Date()); setError(null);
      } catch (err) {
        if (!active || current !== generation) return;
        setError(request.signal.aborted ? "The request timed out. Try refreshing again." : err instanceof Error ? err.message : "Unable to contact the API.");
      } finally {
        clearTimeout(timeout);
        if (active && current === generation) { inFlight = false; setIsLoading(false); setIsRefreshing(false); }
      }
    };
    refreshRef.current = load;
    void load();
    const interval = setInterval(() => { void load(); }, intervalMs);
    return () => { active = false; clearInterval(interval); controller?.abort(); refreshRef.current = async () => {}; };
  }, [token, isChecking, loader, intervalMs]);

  const refresh = React.useCallback((force = false) => refreshRef.current(force), []);
  return { data, setData, isLoading, isRefreshing, error, updatedAt, refresh };
}
