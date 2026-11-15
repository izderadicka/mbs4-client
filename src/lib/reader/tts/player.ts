// WebAudio playback of a FIFO queue of synthesized audio snippets. Knows
// nothing about sentences, TTS services, or the reader - it decodes and
// plays opaque items in order and reports lifecycle events.
//
// Playback is scheduled on the audio clock: every decoded item gets its own
// AudioBufferSourceNode started at a fixed time after the previous one (plus
// a short gap). The audio thread then plays the whole queue by itself, so
// the timing between items does not depend on the page's main thread - which
// browsers throttle heavily while the page is hidden or the screen is
// locked. Lifecycle events are derived from the same clock; in a throttled
// page they may be reported late, but always in order.
//
// Pause suspends the whole AudioContext (sample-accurate freeze; the audio
// clock stops, so the schedule stays valid).

import {
  TTS_FADE_S,
  TTS_SENTENCE_GAP_S,
  TTS_START_LEAD_S,
} from "$lib/config";
import type { SynthesisResult } from "./tts-service";

export type PlayerEvent =
  | { type: "item-started"; id: number }
  | { type: "item-ended"; id: number }
  // playhead caught up with the queue (not emitted on explicit flush)
  | { type: "drained" }
  | { type: "item-error"; id: number; error: unknown };

interface Item {
  id: number;
  buffer: AudioBuffer;
  // null until scheduled
  source: AudioBufferSourceNode | null;
  // audio clock times (valid once scheduled)
  startTime: number;
  endTime: number;
  // item-started was emitted
  started: boolean;
}

// tolerance when comparing against the audio clock, which advances in
// render-buffer steps
const CLOCK_EPSILON_S = 0.005;
// lower bound for the event timer, so clock rounding cannot make it spin
const MIN_TIMER_MS = 10;

// linear fade-in/out at the edges of the buffer (in place)
function fadeEdges(buffer: AudioBuffer): void {
  const n = Math.min(
    Math.round(TTS_FADE_S * buffer.sampleRate),
    Math.floor(buffer.length / 2),
  );
  if (n <= 0) return;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      data[i] *= k;
      data[data.length - 1 - i] *= k;
    }
  }
}

export class SpeechPlayer {
  // set by the consumer (pipeline); may be replaced after construction
  onEvent: (e: PlayerEvent) => void;

  #ctx: AudioContext | null = null;
  #gain: GainNode | null = null;
  // reading order; head = playing (or next to play). Items stay unscheduled
  // until play() is first called
  #items: Item[] = [];
  #playing = false;
  #paused = false;
  #rate = 1;
  // audio clock time at which the next scheduled item may start
  #nextTime = 0;
  // wakes #advance at the next item boundary
  #timer: ReturnType<typeof setTimeout> | null = null;
  #destroyed = false;
  // bumped on flush so in-flight decodes cannot re-queue dropped audio
  #flushGeneration = 0;

  constructor(onEvent?: (e: PlayerEvent) => void) {
    this.onEvent = onEvent ?? (() => {});
  }

  #ensureContext(): AudioContext {
    if (!this.#ctx) {
      // "playback": larger render buffers, robust against glitches when the
      // CPU is busy (synthesis may be running flat out on the same device);
      // latency does not matter for read-aloud
      this.#ctx = new AudioContext({ latencyHint: "playback" });
      this.#gain = this.#ctx.createGain();
      this.#gain.connect(this.#ctx.destination);
    }
    return this.#ctx;
  }

  // decoded audio queued ahead of the playhead, in listened (rate-adjusted)
  // seconds; the currently playing item is not counted
  get bufferedSeconds(): number {
    let total = 0;
    for (const item of this.#items) {
      if (!item.started) total += item.buffer.duration;
    }
    return total / this.#rate;
  }

  get queuedCount(): number {
    let count = 0;
    for (const item of this.#items) {
      if (!item.started) count++;
    }
    return count;
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
    fadeEdges(buffer);
    this.#items.push({
      id,
      buffer,
      source: null,
      startTime: 0,
      endTime: 0,
      started: false,
    });
    this.#schedule();
    this.#advance();
  }

  // Create/resume the AudioContext - call from a user gesture the first time
  // (browser autoplay policy)
  async play(): Promise<void> {
    if (this.#destroyed) return;
    const ctx = this.#ensureContext();
    this.#paused = false;
    this.#playing = true;
    if (ctx.state === "suspended") await ctx.resume();
    if (this.#destroyed) return;
    if (this.#paused) {
      // paused again while the context was resuming
      if (ctx.state === "running") await ctx.suspend();
      return;
    }
    this.#schedule();
    this.#advance();
  }

  async pause(): Promise<void> {
    if (this.#destroyed || !this.#ctx) return;
    this.#paused = true;
    this.#clearTimer();
    if (this.#ctx.state === "running") await this.#ctx.suspend();
  }

  // stop current playback and drop everything queued
  flush(): void {
    this.#flushGeneration++;
    this.#clearTimer();
    for (const item of this.#items) this.#unschedule(item);
    this.#items = [];
    this.#nextTime = 0;
  }

  // Applies to items scheduled from now on; what is already scheduled keeps
  // its rate (and its place on the audio clock) - flush to change it at once.
  setRate(rate: number): void {
    this.#rate = rate;
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

  #clearTimer(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #unschedule(item: Item): void {
    const source = item.source;
    if (!source) return;
    item.source = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // not started yet - ignore
    }
    source.disconnect();
  }

  // give every not yet scheduled item its place on the audio clock
  #schedule(): void {
    const ctx = this.#ctx;
    if (this.#destroyed || !ctx || !this.#gain || !this.#playing) return;
    for (const item of this.#items) {
      if (item.source) continue;
      const source = ctx.createBufferSource();
      source.buffer = item.buffer;
      source.playbackRate.value = this.#rate;
      source.connect(this.#gain);
      item.startTime = Math.max(
        this.#nextTime,
        ctx.currentTime + TTS_START_LEAD_S,
      );
      item.endTime = item.startTime + item.buffer.duration / this.#rate;
      // brief pause between sentences
      this.#nextTime = item.endTime + TTS_SENTENCE_GAP_S / this.#rate;
      item.source = source;
      source.onended = () => this.#advance(item);
      source.start(item.startTime);
    }
  }

  // Report everything that has happened on the audio clock since the last
  // call, in order. `ended` is an item whose source just fired `ended` - it
  // (and all before it) is over whatever the clock arithmetic says.
  #advance(ended?: Item): void {
    const ctx = this.#ctx;
    if (this.#destroyed || !ctx) return;
    const generation = this.#flushGeneration;
    if (ended) {
      const index = this.#items.indexOf(ended);
      if (index < 0) return; // flushed
      for (let i = 0; i <= index; i++) {
        this.#items[i].endTime = Math.min(
          this.#items[i].endTime,
          ctx.currentTime,
        );
      }
    }
    let finished = false;
    while (this.#items.length > 0) {
      const head = this.#items[0];
      if (!head.source) break;
      const now = ctx.currentTime + CLOCK_EPSILON_S;
      if (!head.started) {
        if (now < head.startTime) break;
        head.started = true;
        this.onEvent({ type: "item-started", id: head.id });
        // the consumer may flush from within the event
        if (generation !== this.#flushGeneration || this.#destroyed) return;
      }
      if (now < head.endTime) break;
      this.#items.shift();
      head.source.onended = null;
      finished = true;
      this.onEvent({ type: "item-ended", id: head.id });
      if (generation !== this.#flushGeneration || this.#destroyed) return;
    }
    if (finished && this.#items.length === 0) {
      this.#nextTime = 0;
      this.onEvent({ type: "drained" });
      if (generation !== this.#flushGeneration || this.#destroyed) return;
    }
    this.#armTimer();
  }

  // wake up at the next boundary of the head item (the audio clock is frozen
  // while paused - play() re-arms)
  #armTimer(): void {
    this.#clearTimer();
    const ctx = this.#ctx;
    const head = this.#items[0];
    if (!ctx || this.#paused || !head?.source) return;
    const boundary = head.started ? head.endTime : head.startTime;
    this.#timer = setTimeout(
      () => {
        this.#timer = null;
        this.#advance();
      },
      Math.max(MIN_TIMER_MS, (boundary - ctx.currentTime) * 1000),
    );
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
