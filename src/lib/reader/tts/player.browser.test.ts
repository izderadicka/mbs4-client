// SpeechPlayer against a real AudioContext (chromium, headless, launched
// with --autoplay-policy=no-user-gesture-required).
import { describe, expect, it, vi } from "vitest";
import { encodeWavPcm16 } from "./mock-tts-service";
import { SpeechPlayer, type PlayerEvent } from "./player";
import type { SynthesisResult } from "./tts-service";

function tone(durationS: number): SynthesisResult {
  const sampleRate = 22050;
  const count = Math.round(sampleRate * durationS);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = 0.05 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }
  return { data: encodeWavPcm16(samples, sampleRate), mimeType: "audio/wav" };
}

function collector() {
  const events: PlayerEvent[] = [];
  return {
    events,
    onEvent: (e: PlayerEvent) => events.push(e),
    types: () => events.map((e) => e.type),
  };
}

describe("SpeechPlayer (browser)", () => {
  it("plays queued items in order, then drains", async () => {
    const c = collector();
    const player = new SpeechPlayer(c.onEvent);
    await player.enqueue(1, tone(0.15));
    await player.enqueue(2, tone(0.15));
    expect(player.queuedCount).toBe(2);
    expect(player.bufferedSeconds).toBeGreaterThan(0.25);
    await player.play();
    await vi.waitFor(
      () =>
        expect(c.types()).toEqual([
          "item-started",
          "item-ended",
          "item-started",
          "item-ended",
          "drained",
        ]),
      { timeout: 5000 },
    );
    const startedIds = c.events
      .filter((e) => e.type === "item-started")
      .map((e) => (e as { id: number }).id);
    expect(startedIds).toEqual([1, 2]);
    await player.destroy();
  });

  it("starts playback of items enqueued after play()", async () => {
    const c = collector();
    const player = new SpeechPlayer(c.onEvent);
    await player.play();
    await player.enqueue(7, tone(0.1));
    await vi.waitFor(() => expect(c.types()).toContain("item-ended"), {
      timeout: 5000,
    });
    await player.destroy();
  });

  it("pause freezes playback; play resumes it", async () => {
    const c = collector();
    const player = new SpeechPlayer(c.onEvent);
    await player.enqueue(1, tone(0.6));
    await player.play();
    await vi.waitFor(() => expect(c.types()).toContain("item-started"), {
      timeout: 5000,
    });
    await player.pause();
    await new Promise((r) => setTimeout(r, 900));
    // no progress while suspended
    expect(c.types()).not.toContain("item-ended");
    await player.play();
    await vi.waitFor(() => expect(c.types()).toContain("item-ended"), {
      timeout: 5000,
    });
    await player.destroy();
  });

  it("flush stops the current item and drops the queue silently", async () => {
    const c = collector();
    const player = new SpeechPlayer(c.onEvent);
    await player.enqueue(1, tone(0.6));
    await player.enqueue(2, tone(0.6));
    await player.play();
    await vi.waitFor(() => expect(c.types()).toContain("item-started"), {
      timeout: 5000,
    });
    player.flush();
    expect(player.queuedCount).toBe(0);
    const count = c.events.length;
    await new Promise((r) => setTimeout(r, 800));
    // no item-ended / drained events after flush
    expect(c.events.length).toBe(count);
    await player.destroy();
  });

  it("setRate speeds up playback of the current item", async () => {
    const c = collector();
    const player = new SpeechPlayer(c.onEvent);
    player.setRate(2);
    await player.enqueue(1, tone(0.8));
    const t0 = performance.now();
    await player.play();
    await vi.waitFor(() => expect(c.types()).toContain("item-ended"), {
      timeout: 5000,
    });
    const elapsed = performance.now() - t0;
    // 0.8s tone at 2x should finish in roughly 0.4s; allow generous slack
    expect(elapsed).toBeLessThan(700);
    await player.destroy();
  });

  it("reports decode failures as item-error", async () => {
    const c = collector();
    const player = new SpeechPlayer(c.onEvent);
    await player.enqueue(1, {
      data: new Uint8Array([1, 2, 3, 4]).buffer,
      mimeType: "audio/wav",
    });
    expect(c.types()).toEqual(["item-error"]);
    expect(player.queuedCount).toBe(0);
    await player.destroy();
  });
});
