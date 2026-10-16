"use client";
import { useEffect, useRef, useState } from "react";
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function PwaControls() {
  const [offline, setOffline] = useState(false), [install, setInstall] = useState<InstallEvent | null>(null), [update, setUpdate] = useState<ServiceWorker | null>(null), [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const online = () => setOffline(!navigator.onLine);
    const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const installed = () => setInstall(null);
    online(); window.addEventListener("online", online); window.addEventListener("offline", online); window.addEventListener("beforeinstallprompt", offer); window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(registration => {
      if (!mounted.current) return;
      if (registration.waiting) setUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (mounted.current && worker.state === "installed" && navigator.serviceWorker.controller) setUpdate(registration.waiting); });
      });
    }).catch(() => { /* Installation failure must not block wallet use. */ });
    return () => { mounted.current = false; window.removeEventListener("online", online); window.removeEventListener("offline", online); window.removeEventListener("beforeinstallprompt", offer); window.removeEventListener("appinstalled", installed); };
  }, []);
  async function installApp() { if (!install) return; setBusy(true); try { await install.prompt(); await install.userChoice; } finally { setInstall(null); setBusy(false); } }
  function applyUpdate() { if (!update || !window.confirm("Save your work and check any submitted purchase in History first. Reload Hotdata now?")) return; navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true }); update.postMessage({ type: "ACTIVATE_UPDATE" }); }
  if (!offline && !install && !update) return null;
  return <aside aria-label="App status" className="border-b border-line bg-brand-tint px-5 py-3 text-sm"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">{offline && <p role="status">You’re offline. Reconnect to buy data. Check History before retrying a submitted purchase.</p>}{!offline && install && <button type="button" disabled={busy} onClick={installApp} className="min-h-11 rounded-button bg-brand-dark px-4 font-semibold text-white">Install Hotdata</button>}{!offline && update && <><p>An app update is ready.</p><button type="button" onClick={applyUpdate} className="min-h-11 rounded-button border border-brand-dark px-4 font-semibold text-brand-dark">Reload safely</button></>}</div></aside>;
}
