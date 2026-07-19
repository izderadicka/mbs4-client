// Buffer manager between the sentence cursor, the TTS service, and the
// audio player: prefetches sentences ahead of playback (so short service
// outages don't interrupt speech), keeps synthesis results in reading order,
// retries transient failures with backoff, and reports playback progress.

import {
  TTS_MAX_CONCURRENT_SYNTH,
  TTS_MAX_LOOKAHEAD_SENTENCES,
  TTS_MIN_LOOKAHEAD_SENTENCES,
  TTS_RETRY_INITIAL_MS,
  TTS_RETRY_MAX_MS,
  TTS_RETRY_WINDOW_MS,
  TTS_TARGET_BUFFER_S,
} from "$lib/config";
import { SpeechPlayer, type PlayerEvent, type SpeechPlayerLike } from "./player";
import type { SentenceCursor, SentenceRef } from "./sentences";
import { TtsServiceError, type SynthesisResult, type TtsService } from "./tts-service";

export type PipelineEvent =
  | { type: "sentence-started"; sentence: SentenceRef }
  | { type: "sentence-ended"; sentence: SentenceRef }
  // playback stalled waiting for synthesis
  | { type: "buffering" }
  // (re)started playing
  | { type: "playing" }
  // last sentence of the book finished playing
  | { type: "ended" }
  // terminal failure (non-retryable error or retry window exhausted)
  | { type: "error"; error: unknown };

// Playback pipeline contract used by the controller. Each TtsService creates
// the implementation appropriate for it (TtsService.createPipeline):
// TtsServicePipeline below for services returning audio data, or a
// service-specific one (browser speech synthesis plays audio itself and
// cannot feed the WebAudio player).
export interface SpeechPipeline {
  readonly currentSentence: SentenceRef | null;
  readonly active: boolean;
  start(cursor: SentenceCursor, voice?: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): void;
  setRate(rate: number): void;
  destroy(): Promise<void>;
}

export interface PipelineOptions {
  targetBufferSeconds?: number;
  minLookaheadSentences?: number;
  maxLookaheadSentences?: number;
  maxConcurrentSynth?: number;
  retryInitialMs?: number;
  retryMaxMs?: number;
  retryWindowMs?: number;
  // substitute for the WebAudio SpeechPlayer (tests)
  player?: SpeechPlayerLike;
}

interface LedgerEntry {
  seq: number;
  sentence: SentenceRef;
  audio: SynthesisResult | null;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class TtsServicePipeline implements SpeechPipeline {
  #service: TtsService;
  #player: SpeechPlayerLike;
  #onEvent: (e: PipelineEvent) => void;
  #opts: Required<Omit<PipelineOptions, "player">>;

  #cursor: SentenceCursor | null = null;
  #voice: string | undefined;
  // bumped on every stop/flush; async completions from older generations
  // discard themselves
  #generation = 0;
  #abort: AbortController | null = null;
  // synthesis results awaiting their turn (reading order; head = next to play)
  #ledger: LedgerEntry[] = [];
  #seq = 0;
  #inFlight = 0;
  #filling = false;
  #draining = false;
  #endOfInput = false;
  #active = false;
  #stalled = false;
  // seqs with a synthesis attempt currently in progress
  #synthesizing = new Set<number>();
  // id -> sentence for translating player events
  #bySeq = new Map<number, SentenceRef>();
  #currentSentence: SentenceRef | null = null;

  constructor(
    service: TtsService,
    onEvent: (e: PipelineEvent) => void,
    opts?: PipelineOptions,
  ) {
    this.#service = service;
    this.#player = opts?.player ?? new SpeechPlayer();
    this.#onEvent = onEvent;
    this.#opts = {
      targetBufferSeconds: opts?.targetBufferSeconds ?? TTS_TARGET_BUFFER_S,
      minLookaheadSentences:
        opts?.minLookaheadSentences ?? TTS_MIN_LOOKAHEAD_SENTENCES,
      maxLookaheadSentences:
        opts?.maxLookaheadSentences ?? TTS_MAX_LOOKAHEAD_SENTENCES,
      maxConcurrentSynth: opts?.maxConcurrentSynth ?? TTS_MAX_CONCURRENT_SYNTH,
      retryInitialMs: opts?.retryInitialMs ?? TTS_RETRY_INITIAL_MS,
      retryMaxMs: opts?.retryMaxMs ?? TTS_RETRY_MAX_MS,
      retryWindowMs: opts?.retryWindowMs ?? TTS_RETRY_WINDOW_MS,
    };
    this.#player.onEvent = (e) => this.#onPlayerEvent(e);
  }

  get currentSentence(): SentenceRef | null {
    return this.#currentSentence;
  }

  get active(): boolean {
    return this.#active;
  }

  // Begin speaking from the cursor's current sentence. Call from a user
  // gesture the first time (the player creates the AudioContext here).
  async start(cursor: SentenceCursor, voice?: string): Promise<void> {
    this.stop();
    this.#active = true;
    this.#cursor = cursor;
    this.#voice = voice;
    this.#abort = new AbortController();
    const generation = this.#generation;
    this.#currentSentence = cursor.current;
    // resume audio immediately within the triggering user gesture
    await this.#player.play();
    if (generation !== this.#generation) return;
    this.#stalled = true;
    this.#onEvent({ type: "buffering" });
    // the cursor's current sentence is the first item
    this.#push(cursor.current);
    void this.#fill(generation);
  }

  async pause(): Promise<void> {
    await this.#player.pause();
  }

  async resume(): Promise<void> {
    await this.#player.play();
  }

  // Flush everything: abort in-flight synthesis, drop buffered audio.
  // currentSentence is kept so callers can restart from it.
  stop(): void {
    this.#generation++;
    this.#abort?.abort();
    this.#abort = null;
    this.#ledger = [];
    this.#bySeq.clear();
    this.#inFlight = 0;
    this.#endOfInput = false;
    this.#stalled = false;
    this.#active = false;
    this.#cursor = null;
    this.#player.flush();
  }

  setRate(rate: number): void {
    this.#player.setRate(rate);
  }

  async destroy(): Promise<void> {
    this.stop();
    await this.#player.destroy();
  }

  #lookahead(): number {
    return this.#ledger.length + this.#player.queuedCount;
  }

  #needsMore(): boolean {
    if (this.#endOfInput) return false;
    const lookahead = this.#lookahead();
    if (lookahead >= this.#opts.maxLookaheadSentences) return false;
    return (
      this.#player.bufferedSeconds < this.#opts.targetBufferSeconds ||
      lookahead < this.#opts.minLookaheadSentences
    );
  }

  #push(sentence: SentenceRef): LedgerEntry {
    const entry: LedgerEntry = { seq: this.#seq++, sentence, audio: null };
    this.#ledger.push(entry);
    this.#bySeq.set(entry.seq, sentence);
    return entry;
  }

  // pull sentences from the cursor and dispatch synthesis, bounded by the
  // lookahead limits and the synthesis concurrency semaphore
  async #fill(generation: number): Promise<void> {
    if (this.#filling) return;
    this.#filling = true;
    try {
      while (
        generation === this.#generation &&
        this.#inFlight < this.#opts.maxConcurrentSynth
      ) {
        const pending = this.#ledger.find((e) => e.audio === null && !this.#isSynthesizing(e));
        // dispatch synthesis for entries already pulled
        if (pending) {
          void this.#synthesize(pending, generation);
          continue;
        }
        if (!this.#needsMore() || !this.#cursor) break;
        const next = await this.#cursor.next();
        if (generation !== this.#generation) return;
        if (next === null) {
          this.#endOfInput = true;
          this.#maybeEnded();
          break;
        }
        this.#push(next);
      }
    } finally {
      this.#filling = false;
    }
  }

  #isSynthesizing(entry: LedgerEntry): boolean {
    return this.#synthesizing.has(entry.seq);
  }

  async #synthesize(entry: LedgerEntry, generation: number): Promise<void> {
    if (!this.#abort) return;
    const signal = this.#abort.signal;
    this.#synthesizing.add(entry.seq);
    this.#inFlight++;
    const startedAt = Date.now();
    let backoff = this.#opts.retryInitialMs;
    try {
      for (;;) {
        try {
          const audio = await this.#service.synthesize(
            { text: entry.sentence.text, voice: this.#voice },
            signal,
          );
          if (generation !== this.#generation) return;
          entry.audio = audio;
          void this.#drain(generation);
          return;
        } catch (error) {
          if (generation !== this.#generation || signal.aborted) return;
          const retryable =
            error instanceof TtsServiceError && error.retryable;
          const withinWindow =
            Date.now() - startedAt < this.#opts.retryWindowMs;
          if (!retryable || !withinWindow) {
            this.#fail(error);
            return;
          }
          try {
            await delay(backoff, signal);
          } catch {
            return; // aborted while waiting
          }
          if (generation !== this.#generation) return;
          backoff = Math.min(backoff * 2, this.#opts.retryMaxMs);
        }
      }
    } finally {
      this.#synthesizing.delete(entry.seq);
      if (generation === this.#generation) {
        this.#inFlight--;
        void this.#fill(generation);
      }
    }
  }

  // hand the longest completed prefix of the ledger to the player, in order
  async #drain(generation: number): Promise<void> {
    if (this.#draining) return;
    this.#draining = true;
    try {
      while (
        generation === this.#generation &&
        this.#ledger.length > 0 &&
        this.#ledger[0].audio !== null
      ) {
        const entry = this.#ledger.shift()!;
        await this.#player.enqueue(entry.seq, entry.audio!);
      }
    } finally {
      this.#draining = false;
    }
  }

  #fail(error: unknown): void {
    // keep currentSentence so the user can retry from where it failed
    this.#generation++;
    this.#abort?.abort();
    this.#abort = null;
    this.#ledger = [];
    this.#inFlight = 0;
    this.#stalled = false;
    this.#active = false;
    this.#cursor = null;
    this.#player.flush();
    this.#onEvent({ type: "error", error });
  }

  #maybeEnded(): void {
    if (
      this.#active &&
      this.#endOfInput &&
      this.#ledger.length === 0 &&
      this.#inFlight === 0 &&
      this.#player.queuedCount === 0
    ) {
      this.#active = false;
      this.#onEvent({ type: "ended" });
    }
  }

  #onPlayerEvent(e: PlayerEvent): void {
    switch (e.type) {
      case "item-started": {
        const sentence = this.#bySeq.get(e.id);
        if (sentence) {
          this.#currentSentence = sentence;
          this.#onEvent({ type: "sentence-started", sentence });
        }
        if (this.#stalled) {
          this.#stalled = false;
          this.#onEvent({ type: "playing" });
        }
        break;
      }
      case "item-ended": {
        const sentence = this.#bySeq.get(e.id);
        this.#bySeq.delete(e.id);
        if (sentence) this.#onEvent({ type: "sentence-ended", sentence });
        void this.#fill(this.#generation);
        break;
      }
      case "drained": {
        if (!this.#active) break;
        if (
          this.#endOfInput &&
          this.#ledger.length === 0 &&
          this.#inFlight === 0
        ) {
          this.#maybeEnded();
        } else if (!this.#stalled) {
          this.#stalled = true;
          this.#onEvent({ type: "buffering" });
        }
        break;
      }
      case "item-error": {
        // decode failures are not transient - surface them
        this.#fail(e.error);
        break;
      }
    }
  }
}
