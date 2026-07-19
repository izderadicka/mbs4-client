// TTS service backed by the standard browser Web Speech API
// (window.speechSynthesis). Unlike the other services it cannot return
// synthesized audio data - the browser plays speech itself - so it comes
// with its own SpeechPipeline implementation built around utterances
// instead of the WebAudio player, and its synthesize() is never called.

import type { PipelineEvent, SpeechPipeline } from "./pipeline";
import type { SentenceCursor, SentenceRef } from "./sentences";
import {
  matchesLanguage,
  TtsServiceError,
  type SynthesisResult,
  type TtsService,
  type Voice,
} from "./tts-service";

// some browsers populate getVoices() asynchronously; give voiceschanged
// this long before settling for whatever is there
const VOICES_LOAD_TIMEOUT_MS = 1500;
// utterances handed to speechSynthesis ahead of playback; keeps sentence
// transitions seamless while sentence segmentation stays lazy
const UTTERANCE_LOOKAHEAD = 2;

function synth(): SpeechSynthesis | null {
  return typeof globalThis.speechSynthesis === "undefined"
    ? null
    : globalThis.speechSynthesis;
}

function unsupportedError(): TtsServiceError {
  return new TtsServiceError(
    "Speech synthesis is not supported by this browser",
    { retryable: false },
  );
}

async function loadNativeVoices(): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  if (!s) throw unsupportedError();
  const voices = s.getVoices();
  if (voices.length > 0) return voices;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      s.removeEventListener("voiceschanged", finish);
      resolve(s.getVoices());
    };
    s.addEventListener("voiceschanged", finish);
    setTimeout(finish, VOICES_LOAD_TIMEOUT_MS);
  });
}

export class BrowserTtsService implements TtsService {
  readonly id = "browser";

  createPipeline(onEvent: (e: PipelineEvent) => void): SpeechPipeline {
    return new BrowserSpeechPipeline(onEvent);
  }

  async listVoices(language?: string): Promise<Voice[]> {
    const native = await loadNativeVoices();
    const voices: Voice[] = [];
    const seen = new Set<string>();
    for (const v of native) {
      if (language !== undefined && !matchesLanguage(v.lang, language)) continue;
      // voiceURI is the unique voice identifier; names may repeat
      if (seen.has(v.voiceURI)) continue;
      seen.add(v.voiceURI);
      voices.push({ id: v.voiceURI, name: v.name, lang: v.lang });
    }
    return voices;
  }

  async synthesize(): Promise<SynthesisResult> {
    throw new TtsServiceError(
      "Browser speech synthesis plays audio directly and cannot return data",
      { retryable: false },
    );
  }
}

export class BrowserSpeechPipeline implements SpeechPipeline {
  #onEvent: (e: PipelineEvent) => void;
  #rate = 1;
  // Voice.id of the selected voice (= voiceURI for this service)
  #voiceId: string | undefined;
  #nativeVoices: SpeechSynthesisVoice[] = [];
  #cursor: SentenceCursor | null = null;
  #currentSentence: SentenceRef | null = null;
  // bumped on every stop/flush; utterance callbacks and async completions
  // from older generations discard themselves
  #generation = 0;
  #active = false;
  #stalled = false;
  #endOfInput = false;
  #filling = false;
  // sentences handed to speechSynthesis and not yet finished (head is the
  // one speaking); holding the utterances also protects them from GC, which
  // would silently drop their events in Chrome
  #queue: { sentence: SentenceRef; utterance: SpeechSynthesisUtterance }[] = [];

  constructor(onEvent: (e: PipelineEvent) => void) {
    this.#onEvent = onEvent;
  }

  get currentSentence(): SentenceRef | null {
    return this.#currentSentence;
  }

  get active(): boolean {
    return this.#active;
  }

  // Begin speaking from the cursor's current sentence. Call from a user
  // gesture the first time (browsers gate speechSynthesis on activation).
  async start(cursor: SentenceCursor, voice?: string): Promise<void> {
    this.stop();
    const generation = this.#generation;
    if (!synth()) {
      this.#onEvent({ type: "error", error: unsupportedError() });
      return;
    }
    this.#active = true;
    this.#cursor = cursor;
    this.#voiceId = voice;
    this.#currentSentence = cursor.current;
    this.#stalled = true;
    this.#onEvent({ type: "buffering" });
    this.#nativeVoices = await loadNativeVoices().catch(() => []);
    if (generation !== this.#generation) return;
    this.#speak(cursor.current, generation);
    void this.#fill(generation);
  }

  async pause(): Promise<void> {
    synth()?.pause();
  }

  async resume(): Promise<void> {
    synth()?.resume();
  }

  // Flush everything: cancel queued utterances, forget the cursor.
  // currentSentence is kept so callers can restart from it.
  stop(): void {
    this.#generation++;
    this.#queue = [];
    this.#cursor = null;
    this.#endOfInput = false;
    this.#stalled = false;
    this.#active = false;
    synth()?.cancel();
  }

  setRate(rate: number): void {
    this.#rate = rate;
    if (!this.#active || this.#queue.length === 0) return;
    // an utterance's rate is fixed once queued - re-speak what is pending
    // at the new rate (the current sentence restarts)
    const pending = this.#queue.map((q) => q.sentence);
    const generation = ++this.#generation;
    this.#queue = [];
    synth()?.cancel();
    for (const sentence of pending) this.#speak(sentence, generation);
    void this.#fill(generation);
  }

  async destroy(): Promise<void> {
    this.stop();
  }

  #resolveVoice(): SpeechSynthesisVoice | null {
    if (!this.#voiceId) return null;
    return (
      this.#nativeVoices.find((v) => v.voiceURI === this.#voiceId) ?? null
    );
  }

  #speak(sentence: SentenceRef, generation: number): void {
    const utterance = new SpeechSynthesisUtterance(sentence.text);
    const voice = this.#resolveVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = this.#rate;
    utterance.onstart = () => {
      if (generation !== this.#generation) return;
      this.#currentSentence = sentence;
      this.#onEvent({ type: "sentence-started", sentence });
      if (this.#stalled) {
        this.#stalled = false;
        this.#onEvent({ type: "playing" });
      }
      void this.#fill(generation);
    };
    utterance.onend = () => {
      if (generation !== this.#generation) return;
      this.#queue = this.#queue.filter((q) => q.sentence !== sentence);
      this.#onEvent({ type: "sentence-ended", sentence });
      this.#maybeEnded();
      void this.#fill(generation);
    };
    utterance.onerror = (event) => {
      if (generation !== this.#generation) return;
      // cancel() reports queued utterances as interrupted/canceled
      if (event.error === "interrupted" || event.error === "canceled") return;
      this.#fail(
        new TtsServiceError(`Speech synthesis failed (${event.error})`, {
          retryable: false,
        }),
      );
    };
    this.#queue.push({ sentence, utterance });
    synth()?.speak(utterance);
  }

  // pull sentences from the cursor to keep the utterance queue topped up
  async #fill(generation: number): Promise<void> {
    if (this.#filling) return;
    this.#filling = true;
    try {
      while (
        generation === this.#generation &&
        !this.#endOfInput &&
        this.#cursor !== null &&
        this.#queue.length < UTTERANCE_LOOKAHEAD
      ) {
        const next = await this.#cursor.next();
        if (generation !== this.#generation) return;
        if (next === null) {
          this.#endOfInput = true;
          this.#maybeEnded();
          return;
        }
        this.#speak(next, generation);
      }
    } finally {
      this.#filling = false;
    }
  }

  #maybeEnded(): void {
    if (this.#active && this.#endOfInput && this.#queue.length === 0) {
      this.#active = false;
      this.#onEvent({ type: "ended" });
    }
  }

  // keep currentSentence so the user can retry from where it failed
  #fail(error: unknown): void {
    this.#generation++;
    this.#queue = [];
    this.#cursor = null;
    this.#endOfInput = false;
    this.#stalled = false;
    this.#active = false;
    synth()?.cancel();
    this.#onEvent({ type: "error", error });
  }
}
