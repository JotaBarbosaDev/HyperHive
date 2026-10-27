import React from "react";
const { createPortal } = require("react-dom") as { createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal };

export function SupportSidePanel({ title, subtitle, children, onClose }: { title: string; subtitle: string; children: React.ReactNode; onClose: () => void }) {
  const [width, setWidth] = React.useState(window.innerWidth < 640 ? window.innerWidth : Math.min(800, Math.round(window.innerWidth * 0.6)));
  const close = React.useRef<HTMLButtonElement>(null);
  const drag = React.useRef<{ x: number; width: number } | null>(null);
  const titleId = React.useId();
  const clamp = (value: number) => Math.min(window.innerWidth, Math.max(Math.min(360, window.innerWidth), value));
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const resize = () => setWidth((value) => clamp(value));
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<aside aria-labelledby={titleId} data-testid="support-side-panel" className="bg-background-0 dark:bg-[#101B2B] text-typography-900 dark:text-[#E8EBF0] border-l border-outline-200 dark:border-[#26364A]" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width, maxWidth: "100vw", zIndex: 40, display: "flex", flexDirection: "column", boxShadow: "-12px 0 36px rgba(0,0,0,0.2)" }} onKeyDown={(event) => {
    if (event.key === "Escape" && !event.defaultPrevented) { event.stopPropagation(); onClose(); }
  }}>
    <div role="separator" aria-label="Resize side panel" aria-orientation="vertical" aria-valuemin={Math.min(360, window.innerWidth)} aria-valuemax={window.innerWidth} aria-valuenow={width} tabIndex={0} className="focus-visible:ring-2 focus-visible:ring-[#147D78] hover:bg-[#147D78]/30" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 8, cursor: "col-resize", touchAction: "none" }} onPointerDown={(event) => {
      if (event.button !== 0) return;
      drag.current = { x: event.clientX, width };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={(event) => { if (drag.current) setWidth(clamp(drag.current.width + drag.current.x - event.clientX)); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      setWidth(clamp(event.key === "Home" ? 360 : event.key === "End" ? window.innerWidth : width + (event.key === "ArrowLeft" ? 32 : -32)));
    }} />
    <header className="border-b border-outline-200 dark:border-[#26364A]" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}><h2 id={titleId} style={{ fontSize: 18, fontWeight: 600, margin: 0, overflowWrap: "anywhere" }}>{title}</h2><p className="text-typography-600 dark:text-[#8A94A8]" style={{ fontSize: 12, margin: "4px 0 0", overflowWrap: "anywhere" }}>{subtitle}</p></div>
      <button ref={close} aria-label="Close side panel" onClick={onClose} className="rounded-lg border border-outline-200 dark:border-[#26364A] focus-visible:ring-2 focus-visible:ring-[#147D78]" style={{ padding: "8px 12px", background: "transparent", color: "inherit", cursor: "pointer", flexShrink: 0 }}>Close</button>
    </header>
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: "16px 20px", gap: 12 }}>{children}</div>
  </aside>, document.body);
}
