import { useEffect, useState } from "react";

export function PwaControls() {
  const [prompt, setPrompt] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installed, setInstalled] = useState(window.matchMedia("(display-mode: standalone)").matches || navigator.standalone);
  const [help, setHelp] = useState(false);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const onPrompt = (event) => { event.preventDefault(); setPrompt(event); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    const onConnection = () => setOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onConnection);
    window.addEventListener("offline", onConnection);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onConnection);
      window.removeEventListener("offline", onConnection);
    };
  }, []);

  async function install() {
    if (!prompt) { setHelp(!help); return; }
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { /* The browser may withdraw an install prompt before it is used. */ }
    finally { setPrompt(null); }
  }

  return (
    <div className="pwa-controls">
      {!installed && (prompt || ios) && (
        <button className="pwa-install" type="button" onClick={install}>Install The Fit</button>
      )}
      {help && <p role="status">In Safari, open Share, then choose Add to Home Screen.</p>}
      {offline && <p role="status">You’re offline. Previously loaded clothes are available. Connect to upload, save changes, get weather, or try on outfits.</p>}
    </div>
  );
}
