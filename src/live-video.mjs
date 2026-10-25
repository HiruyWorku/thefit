// Resolve only after the browser has decoded a frame, not on connection success.
export function attachVideo(video, stream, { signal, timeoutMs = 12000, timeoutMessage = "No video frames arrived. The session was stopped to save credits." } = {}) {
  return new Promise((resolve, reject) => {
    let callbackId;
    let interval;
    let timeout;
    let finished = false;
    const finish = error => {
      if (finished) return;
      finished = true;
      clearInterval(interval);
      clearTimeout(timeout);
      if (callbackId !== undefined) video.cancelVideoFrameCallback?.(callbackId);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(new DOMException("Preview stopped", "AbortError"));
    const onError = () => finish(new Error("The browser could not play this video stream."));
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener("abort", onAbort, { once: true });
    video.addEventListener("error", onError, { once: true });
    timeout = setTimeout(() => finish(new Error(timeoutMessage)), timeoutMs);
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    if (video.requestVideoFrameCallback) {
      callbackId = video.requestVideoFrameCallback(() => finish());
    } else {
      interval = setInterval(() => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime > 0) finish();
      }, 100);
    }
    Promise.resolve(video.play()).catch(error => finish(new Error(error.name === "NotAllowedError"
      ? "Video playback was blocked by the browser. Close the mirror and try again."
      : "The camera video could not start. Close other camera apps and try again.")));
  });
}
