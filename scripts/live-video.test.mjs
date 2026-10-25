import { test } from "node:test";
import assert from "node:assert/strict";
import { attachVideo } from "../src/live-video.mjs";

class FakeVideo extends EventTarget {
  played = false;
  cancelled = false;
  play() { this.played = true; return Promise.resolve(); }
  requestVideoFrameCallback(callback) { this.onFrame = callback; return 1; }
  cancelVideoFrameCallback() { this.cancelled = true; }
}

test("stream attachment explicitly starts playback and waits for a decoded frame", async () => {
  const video = new FakeVideo();
  const stream = {};
  let ready = false;
  const attached = attachVideo(video, stream).then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(video.srcObject, stream);
  assert.equal(video.played, true);
  assert.equal(video.muted, true);
  assert.equal(ready, false, "connection/stream assignment must not mark a black video live");
  video.onFrame();
  await attached;
  assert.equal(ready, true);
});

test("a stream without frames times out instead of staying falsely live", async () => {
  const video = new FakeVideo();
  await assert.rejects(attachVideo(video, {}, { timeoutMs: 10 }), /No video frames arrived/);
  assert.equal(video.cancelled, true);
});

test("closing while playback is pending cancels the frame wait", async () => {
  const video = new FakeVideo();
  const controller = new AbortController();
  const attached = attachVideo(video, {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(attached, { name: "AbortError" });
  assert.equal(video.cancelled, true);
});

test("autoplay denial is surfaced with a recovery action", async () => {
  const video = new FakeVideo();
  video.play = () => Promise.reject(new DOMException("Blocked", "NotAllowedError"));
  await assert.rejects(attachVideo(video, {}), /playback was blocked/);
});
