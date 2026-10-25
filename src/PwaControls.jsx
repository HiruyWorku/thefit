import { useEffect, useRef, useState } from 'react';
import { DownloadSimple, X } from '@phosphor-icons/react';
import { registerPwa, watchConnection } from './pwa-client.mjs';
import './pwa.css';

const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;

export function PwaControls() {
  const [prompt, setPrompt] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installed, setInstalled] = useState(isInstalled);
  const [help, setHelp] = useState(false);
  const [waiting, setWaiting] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [updating, setUpdating] = useState(false);
  const reload = useRef(false);
  const retryConnection = useRef(() => {});
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const onPrompt = (event) => { event.preventDefault(); setPrompt(event); };
    const onDisplay = () => setInstalled(isInstalled());
    const onInstalled = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    const onController = () => { if (reload.current) window.location.reload(); else setWaiting(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const connection = watchConnection({ onChange: setOffline });
    retryConnection.current = connection.check;
    display.addEventListener('change', onDisplay);
    navigator.serviceWorker?.addEventListener('controllerchange', onController);
    const unregister = import.meta.env.PROD && navigator.serviceWorker
      ? registerPwa({ onUpdate: setWaiting }) : () => {};
    return () => {
      unregister();
      connection.dispose();
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      display.removeEventListener('change', onDisplay);
      navigator.serviceWorker?.removeEventListener('controllerchange', onController);
    };
  }, []);

  async function install() {
    if (!prompt) { setHelp(value => !value); return; }
    setInstalling(true);
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setHelp(true); }
    finally { setPrompt(null); setInstalling(false); }
  }

  function update() {
    if (!waiting) return;
    if (waiting.state === 'redundant') { window.location.reload(); return; }
    reload.current = true;
    setUpdating(true);
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  if (!offline && !waiting && installed) return null;
  return <aside className="pwa-controls" aria-label="App installation and connection">
    {offline ? <div className="pwa-notice"><div role="status"><strong>You’re offline</strong><p>Connect to open your private wardrobe, save changes, check weather, or try on outfits.</p></div><div className="pwa-actions"><button type="button" onClick={() => retryConnection.current()}>Retry connection</button></div></div>
      : waiting ? <div className="pwa-notice"><p role="status">An update to thefit is ready. Finish any uploads or try-ons before updating.</p><div className="pwa-actions"><button type="button" disabled={updating} onClick={update}>{updating ? 'Updating…' : 'Update app'}</button><button type="button" disabled={updating} onClick={() => setWaiting(null)}>Later</button></div></div>
      : <>
        {help && <div className="pwa-notice" id="pwa-install-help"><button className="pwa-close" type="button" aria-label="Close installation instructions" onClick={() => setHelp(false)}><X size={18} aria-hidden="true" /></button><strong>Keep thefit on your home screen</strong><p>{ios ? 'In Safari, tap Share, choose Add to Home Screen, then tap Add.' : 'In Chrome or Edge, open the browser menu and choose Install thefit or Install page as app. In Safari on Mac, choose File → Add to Dock.'}</p></div>}
        <button className="pwa-install" type="button" disabled={installing} aria-expanded={help} aria-controls={help ? 'pwa-install-help' : undefined} onClick={install}><DownloadSimple size={18} aria-hidden="true" />{installing ? 'Opening installer…' : 'Install thefit'}</button>
      </>}
  </aside>;
}
