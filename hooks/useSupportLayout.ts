import React from "react";
import { ApiError } from "@/services/api-client";
import { saveSupportLayout } from "@/services/support-client";
import type { SupportLayout } from "@/types/support";

// One writer per dashboard: edits made during a request use its returned revision.
export function useSupportLayout(token: string | null, appId: string | null, remote?: SupportLayout) {
  const [saved, setSaved] = React.useState<SupportLayout | null>(null);
  const [draft, setDraft] = React.useState<SupportLayout | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const owner = React.useRef({ token, appId });
  const ownsState = owner.current.token === token && owner.current.appId === appId;
  const inFlight = React.useRef(false);
  const generation = React.useRef(0);
  React.useEffect(() => {
    owner.current = { token, appId };
    generation.current++; inFlight.current = false;
    setSaved(null); setDraft(null); setSaving(false); setError(null); setConflict(false);
  }, [token, appId]);
  const base = ownsState && saved && (!remote || saved.revision >= remote.revision) ? saved : remote;
  React.useEffect(() => {
    if (!ownsState || !token || !appId || !draft || inFlight.current || error) return;
    const current = generation.current;
    const submitted = draft;
    inFlight.current = true; setSaving(true);
    void saveSupportLayout(token, appId, submitted).then((result) => {
      if (current !== generation.current) return;
      setSaved(result);
      setDraft((latest) => latest === submitted ? null : latest ? { ...latest, revision: result.revision } : null);
    }).catch((failure) => {
      if (current !== generation.current) return;
      const collided = failure instanceof ApiError && failure.status === 409;
      setConflict(collided);
      setError(collided ? "Another operator changed this dashboard. Your draft is preserved. Reload the saved layout to resolve the conflict." : (failure instanceof Error ? failure.message : "Unable to save layout.") + " Your draft is preserved; retry before leaving.");
    }).finally(() => {
      if (current !== generation.current) return;
      inFlight.current = false; setSaving(false);
    });
  }, [token, appId, draft, error, saving, ownsState]);
  React.useEffect(() => () => { generation.current++; }, []);
  React.useEffect(() => {
    if (!draft || typeof window === "undefined") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);
  const change = React.useCallback((widgets: SupportLayout["widgets"]) => { if (base) setDraft((latest) => ({ revision: latest?.revision ?? base.revision, widgets })); }, [base]);
  return {
    layout: ownsState ? draft ?? base : remote, dirty: ownsState && !!draft, saving: ownsState && saving, error: ownsState ? error : null, conflict: ownsState && conflict,
    change,
    retry: () => { if (!conflict) setError(null); },
    discard: () => { if (!inFlight.current) { setDraft(null); setSaved(null); setError(null); setConflict(false); } },
  };
}
