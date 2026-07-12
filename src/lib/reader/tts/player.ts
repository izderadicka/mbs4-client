// WebAudio playback of a FIFO queue of synthesized audio snippets. Knows
// nothing about sentences, TTS services, or the reader - it decodes and
// plays opaque items in order and reports lifecycle events.
//
// Playback is chained: one AudioBufferSourceNode at a time; when it ends the
// next queued buffer starts after a short gap. Pause suspends the whole
// AudioContext (sample-accurate freeze; the chain stays intact because no
// `ended` events fire while suspended).

import { TTS_SENTENCE_GAP_S } from "$lib/config";
import type { SynthesisResult } from "./tts-service";

export type PlayerEvent =
  | { type: "item-started"; id: number }
  | { type: "item-ended"; id: number }
  // playhead caught up with the queue (not emitted on explicit flush)
  | { type: "drained" }
  | { type: "item-error"; id: number; error: unknown };

export class SpeechPlayer {
  // set by the consumer (pipeline); may be replaced after construction
  onEvent: (e: PlayerEvent) => void;

  #ctx: AudioContext | null = null;
  #gain: GainNode | null = null;
  #queue: { id: number; buffer: AudioBuffer }[] = [];
  #current: { id: number; source: AudioBufferSourceNode } | null = null;
  #playing = false;
  #paused = false;
  #rate = 1;
  #gapTimer: ReturnType<typeof setTimeout> | null = null;
  // next item is due (gap elapsed / enqueued) but playback is paused
  #startOnResume = false;
  #destroyed = false;
  // bumped on flush so in-flight decodes cannot re-queue dropped audio
  #flushGeneration = 0;

  constructor(onEvent?: (e: PlayerEvent) => void) {
    this.onEvent = onEvent ?? (() => {});
  }

  #ensureContext(): AudioContext {
    if (!this.#ctx) {
      this.#ctx = new AudioContext();
      this.#gain = this.#ctx.createGain();
      this.#gain.connect(this.#ctx.destination);
    }
    return this.#ctx;
  }

  // decoded audio queued ahead of the playhead, in listened (rate-adjusted)
  // seconds; the currently playing item is not counted
  get bufferedSeconds(): number {
    const total = this.#queue.reduce((sum, q) => sum + q.buffer.duration, 0);
    return total / this.#rate;
  }

  get queuedCount(): number {
    return this.#queue.length;
  }

  async enqueue(id: number, audio: SynthesisResult): Promise<void> {
    if (this.#destroyed) return;
    const generation = this.#flushGeneration;
    const ctx = this.#ensureContext();
    let buffer: AudioBuffer;
    try {
      // copy: decodeAudioData detaches the buffer, callers may retain theirs
      buffer = await ctx.decodeAudioData(audio.data.slice(0));
    } catch (error) {
      if (generation === this.#flushGeneration && !this.#destroyed) {
        this.onEvent({ type: "item-error", id, error });
      }
      return;
    }
    if (this.#destroyed || generation !== this.#flushGeneration) return;
    this.#queue.push({ id, buffer });
    if (this.#playing && !this.#current && !this.#gapTimer) {
      this.#startNext();
    }
  }

  // Create/resume the AudioContext - call from a user gesture the first time
  // (browser autoplay policy)
  async play(): Promise<void> {
    if (this.#destroyed) return;
    const ctx = this.#ensureContext();
    this.#paused = false;
    this.#playing = true;
    if (ctx.state === "suspended") await ctx.resume();
    if (this.#startOnResume || (!this.#current && !this.#gapTimer)) {
      this.#startOnResume = false;
      this.#startNext();
    }
  }

  async pause(): Promise<void> {
    if (this.#destroyed || !this.#ctx) return;
    this.#paused = true;
    if (this.#ctx.state === "running") await this.#ctx.suspend();
  }

  // stop current playback and drop everything queued
  flush(): void {
    this.#flushGeneration++;
    if (this.#gapTimer) {
      clearTimeout(this.#gapTimer);
      this.#gapTimer = null;
    }
    this.#startOnResume = false;
    if (this.#current) {
      const { source } = this.#current;
      source.onended = null;
      try {
        source.stop();
      } catch {
        // not started yet - ignore
      }
      this.#current = null;
    }
    this.#queue = [];
  }

  setRate(rate: number): void {
    this.#rate = rate;
    if (this.#current) this.#current.source.playbackRate.value = rate;
  }

  async destroy(): Promise<void> {
    this.flush();
    this.#destroyed = true;
    this.#playing = false;
    if (this.#ctx) {
      try {
        await this.#ctx.close();
      } catch {
        // already closed
      }
      this.#ctx = null;
      this.#gain = null;
    }
  }

  #startNext(): void {
    if (this.#destroyed || !this.#ctx || !this.#gain) return;
    if (this.#paused) {
      // resume will pick it up
      this.#startOnResume = true;
      return;
    }
    const item = this.#queue.shift();
    if (!item) {
      this.#current = null;
      this.onEvent({ type: "drained" });
      return;
    }
    const source = this.#ctx.createBufferSource();
    source.buffer = item.buffer;
    source.playbackRate.value = this.#rate;
    source.connect(this.#gain);
    this.#current = { id: item.id, source };
    source.onended = () => {
      if (this.#current?.source !== source) return;
      this.#current = null;
      this.onEvent({ type: "item-ended", id: item.id });
      if (this.#destroyed) return;
      // brief pause between sentences
      this.#gapTimer = setTimeout(
        () => {
          this.#gapTimer = null;
          this.#startNext();
        },
        (TTS_SENTENCE_GAP_S * 1000) / this.#rate,
      );
    };
    this.onEvent({ type: "item-started", id: item.id });
    source.start();
  }
}

// structural interface used by the pipeline, so tests can substitute a fake
// player without touching WebAudio
export type SpeechPlayerLike = Pick<
  SpeechPlayer,
  | "onEvent"
  | "enqueue"
  | "play"
  | "pause"
  | "flush"
  | "setRate"
  | "bufferedSeconds"
  | "queuedCount"
  | "destroy"
>;
