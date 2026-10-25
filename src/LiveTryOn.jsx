import { useCallback, useEffect, useRef, useState } from "react";
import { createDecartClient, models } from "@decartai/sdk";
import { Camera, Check, SpinnerGap, X } from "@phosphor-icons/react";
import { attachVideo } from "./live-video.mjs";

const MODEL = models.realtime("lucy-vton-3.6");
const MAX_SESSION_SECONDS = 90;

function buildPrompt(chosen) {
  const pieces = chosen.map(({ slot, item }) => slot + ": " + item.name + (item.tags?.length ? " (" + item.tags.join(", ") + ")" : ""));
  return "Substitute the person's clothing with the garments in the reference image: " + pieces.join("; ") + ". Match their colors, patterns and materials. Preserve the person's identity, body shape, pose and background.";
}

async function composeOutfit(chosen) {
  const photos = await Promise.all(chosen.map(async ({ item }) => {
    const response = await fetch(item.image, { cache: "force-cache" });
    if (!response.ok) throw new Error("Could not load an outfit photo. Close the mirror and refresh your wardrobe.");
    return response.blob();
  }));
  if (photos.length === 1) return photos[0];
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const columns = Math.ceil(Math.sqrt(photos.length));
  const rows = Math.ceil(photos.length / columns);
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / rows;
  for (const [index, blob] of photos.entries()) {
    const image = await createImageBitmap(blob);
    try {
      const scale = Math.min((cellWidth - 32) / image.width, (cellHeight - 32) / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (index % columns) * cellWidth + (cellWidth - width) / 2,
        Math.floor(index / columns) * cellHeight + (cellHeight - height) / 2, width, height);
    } finally { image.close(); }
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not prepare the outfit image.")), "image/png"));
}

export function LiveTryOn({ outfit, onClose }) {
  const [chosen] = useState(() => outfit?.chosen || []);
  const [status, setStatus] = useState("camera");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(MAX_SESSION_SECONDS);
  const [dragging, setDragging] = useState(false);
  const [selection, setSelection] = useState("outfit");
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const cameraRef = useRef(null);
  const publishedCameraRef = useRef(null);
  const sessionRef = useRef(null);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const frameRef = useRef(null);
  const updateLock = useRef(false);

  const stopSession = useCallback(() => {
    pendingRef.current?.abort();
    pendingRef.current = null;
    clearInterval(timerRef.current);
    timerRef.current = null;
    frameRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.disconnect();
    publishedCameraRef.current?.getTracks().forEach(track => track.stop());
    publishedCameraRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const stopAll = useCallback(() => {
    stopSession();
    cameraRef.current?.getTracks().forEach(track => track.stop());
    cameraRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, [stopSession]);

  const close = useCallback(() => { stopAll(); onClose(); }, [onClose, stopAll]);

  useEffect(() => {
    const controller = new AbortController();
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = event => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current?.click(); }
      if (event.key === "Tab") {
        const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled)")];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const onPageHide = () => stopAll();
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pagehide", onPageHide);
    async function startCamera() {
      let camera;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost.");
        camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: "user", width: { ideal: MODEL.width }, height: { ideal: MODEL.height }, frameRate: { ideal: 25 },
        } });
        if (controller.signal.aborted) { camera.getTracks().forEach(track => track.stop()); return; }
        cameraRef.current = camera;
        await attachVideo(localVideoRef.current, camera, {
          signal: controller.signal,
          timeoutMessage: "The camera opened but sent no frames. Close other camera apps, then reopen the mirror.",
        });
        if (!controller.signal.aborted) setStatus("preview");
      } catch (err) {
        if (controller.signal.aborted) return;
        camera?.getTracks().forEach(track => track.stop());
        cameraRef.current = null;
        setError(err.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access for this site, then reopen the mirror."
          : err.name === "NotReadableError" ? "The camera is busy. Close other apps using it, then reopen the mirror."
          : err.message || "Could not open the camera.");
        setStatus("camera-error");
      }
    }
    startCamera();
    return () => {
      controller.abort();
      stopAll();
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pagehide", onPageHide);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [stopAll]);

  const startLive = async () => {
    if (pendingRef.current || !cameraRef.current || !chosen.length) return;
    const controller = new AbortController();
    pendingRef.current = controller;
    setError("");
    setStatus("connecting");
    setSelection("outfit");
    const fail = message => {
      if (controller.signal.aborted) return;
      stopSession();
      setError(message);
      setStatus("preview");
    };
    try {
      // Prepare the image before opening a metered connection.
      const image = await composeOutfit(chosen);
      if (controller.signal.aborted) return;
      const response = await fetch("/api/decart/token", { method: "POST", signal: controller.signal });
      const token = await response.json().catch(() => ({}));
      if (!response.ok || !token.apiKey) throw new Error(token.error || "Could not authorize the Decart session.");
      if (controller.signal.aborted) return;
      const deadline = Date.now() + MAX_SESSION_SECONDS * 1000;
      const started = Date.now();
      setSecondsLeft(MAX_SESSION_SECONDS);
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setSecondsLeft(remaining);
        if (!remaining) { fail("Your 90-second session ended. You can start another when ready."); return; }
        const video = remoteVideoRef.current;
        let progress = frameRef.current;
        if (progress && video?.currentTime !== progress.time) {
          progress = { time: video.currentTime, updated: Date.now() };
          frameRef.current = progress;
        }
        if (!progress && Date.now() - started > 15000) fail("Decart connected but no video arrived. The session was stopped to save credits. Your local camera is shown below.");
        else if (progress && Date.now() - progress.updated > 10000) fail("The try-on video stopped updating. The session was stopped to save credits.");
      }, 1000);
      const client = createDecartClient({ apiKey: token.apiKey });
      // LiveKit owns and stops published tracks on disconnect. Preserve the preview.
      const publishedCamera = cameraRef.current.clone();
      publishedCameraRef.current = publishedCamera;
      const realtime = await client.realtime.connect(publishedCamera, {
        model: MODEL, resolution: "720p", mirror: false, retries: 0,
        initialState: { image, prompt: { text: buildPrompt(chosen), enhance: false } },
        onRemoteStream: stream => {
          if (controller.signal.aborted) return;
          attachVideo(remoteVideoRef.current, stream, { signal: controller.signal }).then(() => {
            if (controller.signal.aborted) return;
            frameRef.current = { time: remoteVideoRef.current.currentTime, updated: Date.now() };
            setStatus("live");
          }).catch(err => { if (err.name !== "AbortError") fail(err.message); });
        },
        onConnectionChange: state => {
          if ((state === "disconnected" || state === "reconnecting") && sessionRef.current) fail("The Decart connection ended. Your local camera is still available; start another try-on when ready.");
        },
      });
      if (controller.signal.aborted) { realtime.disconnect(); return; }
      sessionRef.current = realtime;
      realtime.on("error", () => fail("Decart reported a stream error. The session was stopped to save credits. Check your connection and account balance."));
      realtime.on("sessionEnded", event => fail(event.reason === "insufficient_credits" ? "Decart credits ran out. Check your account balance."
        : "Decart ended the session. You can start another try-on when ready."));
    } catch (err) {
      if (!controller.signal.aborted) fail(err.message || "Could not connect to Decart. Your local camera is still available.");
    }
  };

  const applySelection = async id => {
    if (!sessionRef.current || status !== "live" || updateLock.current) return;
    const items = id === "outfit" ? chosen : chosen.filter(entry => entry.item.id === id);
    if (!items.length || id === selection) return;
    const session = sessionRef.current;
    updateLock.current = true;
    setStatus("updating");
    setError("");
    try {
      const image = await composeOutfit(items);
      if (sessionRef.current !== session) return;
      await session.set({ image, prompt: buildPrompt(items), enhance: false });
      if (sessionRef.current === session) { setSelection(id); setStatus("live"); }
    } catch {
      if (sessionRef.current === session) {
        stopSession(); setStatus("preview"); setError("Could not apply the garment. The session was stopped to save credits.");
      }
    } finally { updateLock.current = false; }
  };

  const connected = status === "live" || status === "updating";
  const waiting = status === "connecting";
  const canStart = status === "preview";

  return <div className="live-try-on-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section className="live-try-on" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="live-try-on-title">
      <header className="live-try-on__header"><h2 id="live-try-on-title">See this look on you</h2><button ref={closeRef} type="button" className="live-try-on__close" onClick={close} aria-label="Close live try-on"><X size={21} /></button></header>
      {error && <p className="live-try-on__error" role="alert">{error}</p>}
      <div className={`live-try-on__stage${dragging ? " is-dragging" : ""}`} onDragOver={event => { if (connected) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); applySelection(event.dataTransfer.getData("text/plain")); }}>
        <video ref={localVideoRef} className={`live-try-on__local${connected ? " is-thumbnail" : ""}`} autoPlay playsInline muted aria-label="Your local camera preview" />
        <video ref={remoteVideoRef} className={`live-try-on__remote${connected ? " is-visible" : ""}`} autoPlay playsInline muted aria-label="Decart live outfit preview" />
        {(status === "camera" || status === "camera-error") && <div className="live-try-on__stage-message">{status === "camera-error" ? <><Camera size={28} /><strong>Camera unavailable</strong></> : <><SpinnerGap className="live-spinner" size={28} /><strong>Opening your camera…</strong></>}</div>}
        <span className="live-try-on__video-label">{connected ? "Decart live try-on" : "Your camera · local preview"}</span>
        {(waiting || status === "updating") && <span className="live-try-on__connecting" role="status"><SpinnerGap className="live-spinner" size={18} />{waiting ? "Waiting for Decart video…" : "Applying your selection…"}</span>}
        {dragging && <div className="live-try-on__drop-message"><Check size={22} /> Drop to try it on</div>}
      </div>
      <div className="live-try-on__footer"><div aria-live="polite"><strong>{connected ? "Live try-on" : waiting ? "Connecting to Decart" : canStart ? "Camera ready" : "Camera setup"}</strong><span>{connected || waiting ? `${secondsLeft}s remaining · standard 720p` : "Local preview is free. Decart uses credits only after you start."}</span></div><div className="live-try-on__actions">{canStart && <button type="button" className="daily-live-try-on" onClick={startLive} disabled={!chosen.length}>Start live try-on · 90s max</button>}{(connected || waiting) && <button className="live-try-on__stop" type="button" onClick={() => { stopSession(); setStatus("preview"); }}>Stop try-on</button>}<button type="button" className="live-try-on__stop" onClick={close}>Close camera</button></div></div>
      <div className="live-try-on__pieces"><p>{connected ? "Drag the full look or one piece onto the mirror, or click to apply." : "Your suggested look. Start live try-on to apply it."}</p><button type="button" disabled={!connected || status === "updating"} draggable={connected} onDragStart={event => event.dataTransfer.setData("text/plain", "outfit")} aria-pressed={selection === "outfit"} onClick={() => applySelection("outfit")}>Full outfit</button>{chosen.map(({ item }) => <button key={item.id} type="button" disabled={!connected || status === "updating"} draggable={connected} onDragStart={event => event.dataTransfer.setData("text/plain", item.id)} aria-pressed={selection === item.id} onClick={() => applySelection(item.id)}><img src={item.thumbnail || item.image} alt="" /><span>{item.name}</span></button>)}</div>
    </section>
  </div>;
}
