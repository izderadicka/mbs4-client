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

// Some browsers populate getVoices() asynchronously; wait up to this long
// for a non-empty list. Android binds its TTS engine slowly and may fire
// voiceschanged several times (first with an empty list) or, in some
// WebViews, not at all - hence the deadline and the poll below.
const VOICES_LOAD_TIMEOUT_MS = 4000;
const VOICES_POLL_INTERVAL_MS = 250;
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

// Chrome frequently ignores utterance.voice unless utterance.lang matches it,
// falling back to a default (English) voice; setting lang fixes that. Normalize
// Android's Java-locale form ("cs_CZ") to BCP-47 ("cs-CZ") so the tag is valid.
function normalizeLang(tag: string | undefined): string | undefined {
  return tag ? tag.replace(/_/g, "-") : undefined;
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
      s.removeEventListener("voiceschanged", check);
      clearInterval(poll);
      clearTimeout(deadline);
      resolve(s.getVoices());
    };
    // settle only on a non-empty list (or the deadline)
    const check = () => {
      if (s.getVoices().length > 0) finish();
    };
    s.addEventListener("voiceschanged", check);
    const poll = setInterval(check, VOICES_POLL_INTERVAL_MS);
    const deadline = setTimeout(finish, VOICES_LOAD_TIMEOUT_MS);
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
  #paused = false;
  // sentences to re-speak on resume (pause is emulated with cancel():
  // speechSynthesis.pause() is a no-op on Android and unreliable elsewhere)
  #pending: SentenceRef[] = [];
  // whether #currentSentence already finished playing (pause during a
  // between-utterances gap must not replay it on resume)
  #currentEnded = false;

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

  // Emulated pause: cancel the queued utterances and remember the not-yet-
  // finished sentences; resume re-speaks them (the current sentence restarts
  // from its beginning). speechSynthesis.pause() cannot be used - it does
  // nothing on Android, and speech paused for long is dropped by desktop
  // Chrome and never resumes.
  async pause(): Promise<void> {
    if (!this.#active || this.#paused) return;
    this.#paused = true;
    this.#generation++;
    this.#pending = this.#queue.map((q) => q.sentence);
    if (
      this.#pending.length === 0 &&
      this.#currentSentence !== null &&
      !this.#currentEnded
    ) {
      // paused while buffering: the current sentence was not spoken yet
      this.#pending = [this.#currentSentence];
    }
    this.#queue = [];
    synth()?.cancel();
  }

  async resume(): Promise<void> {
    if (!this.#paused) return;
    this.#paused = false;
    const generation = ++this.#generation;
    const pending = this.#pending;
    this.#pending = [];
    for (const sentence of pending) this.#speak(sentence, generation);
    // continues from the cursor even when nothing was pending
    void this.#fill(generation);
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
    this.#paused = false;
    this.#pending = [];
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
    // set lang from the chosen voice (authoritative) or the sentence's section
    // language, so Chrome actually uses the selected voice's language. Use ||
    // so a voice reporting an empty lang ("") still falls back to the sentence.
    const lang = normalizeLang(voice?.lang || sentence.lang);
    if (lang) utterance.lang = lang;
    utterance.rate = this.#rate;
    utterance.onstart = () => {
      if (generation !== this.#generation) return;
      this.#currentSentence = sentence;
      this.#currentEnded = false;
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
      if (this.#currentSentence === sentence) this.#currentEnded = true;
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
    this.#paused = false;
    this.#pending = [];
    synth()?.cancel();
    this.#onEvent({ type: "error", error });
  }
}
