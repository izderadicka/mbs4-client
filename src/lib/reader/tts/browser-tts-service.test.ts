import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserSpeechPipeline, BrowserTtsService } from "./browser-tts-service";
import type { PipelineEvent } from "./pipeline";
import type { SentenceCursor, SentenceRef } from "./sentences";
import { TtsServiceError } from "./tts-service";

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
};

interface FakeVoice {
  name: string;
  voiceURI: string;
  lang: string;
}

// happy-dom has no Web Speech API - fake enough of it for the pipeline:
// utterances queue up in `queue`; tests fire their events explicitly
class FakeUtterance {
  text: string;
  voice: FakeVoice | null = null;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class FakeSynth {
  voices: FakeVoice[] = [];
  queue: FakeUtterance[] = [];
  cancelCalls = 0;
  pauseCalls = 0;
  resumeCalls = 0;
  #listeners = new Set<() => void>();

  getVoices() {
    return this.voices;
  }
  speak(u: FakeUtterance) {
    this.queue.push(u);
  }
  cancel() {
    this.cancelCalls++;
    this.queue = [];
  }
  pause() {
    this.pauseCalls++;
  }
  resume() {
    this.resumeCalls++;
  }
  addEventListener(_type: string, cb: () => void) {
    this.#listeners.add(cb);
  }
  removeEventListener(_type: string, cb: () => void) {
    this.#listeners.delete(cb);
  }
  fireVoicesChanged() {
    for (const cb of [...this.#listeners]) cb();
  }
  // test helpers driving playback
  startHead() {
    this.queue[0]?.onstart?.();
  }
  endHead() {
    const u = this.queue.shift();
    u?.onend?.();
  }
}

function makeSentences(texts: string[], lang?: string): SentenceRef[] {
  return texts.map((text, i) => ({
    text,
    cfi: `epubcfi(/6/2!/4/${(i + 1) * 2},/1:0,/1:5)`,
    sectionIndex: 0,
    lang,
  }));
}

class FakeCursor implements SentenceCursor {
  #i = 0;
  constructor(private arr: SentenceRef[]) {}
  get current() {
    return this.arr[this.#i];
  }
  async next() {
    if (this.#i + 1 < this.arr.length) return this.arr[++this.#i];
    return null;
  }
  async prev() {
    if (this.#i > 0) return this.arr[--this.#i];
    return null;
  }
}

let synth: FakeSynth;

beforeEach(() => {
  synth = new FakeSynth();
  synth.voices = [
    { name: "Czech A", voiceURI: "urn:voice:cs-a", lang: "cs-CZ" },
    { name: "English A", voiceURI: "urn:voice:en-a", lang: "en-US" },
    { name: "English B", voiceURI: "urn:voice:en-b", lang: "en-GB" },
  ];
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrowserTtsService.listVoices", () => {
  it("maps native voices (id = voiceURI) and filters by language", async () => {
    const svc = new BrowserTtsService();
    expect(await svc.listVoices()).toEqual([
      { id: "urn:voice:cs-a", name: "Czech A", lang: "cs-CZ" },
      { id: "urn:voice:en-a", name: "English A", lang: "en-US" },
      { id: "urn:voice:en-b", name: "English B", lang: "en-GB" },
    ]);
    expect((await svc.listVoices("en")).map((v) => v.name)).toEqual([
      "English A",
      "English B",
    ]);
    expect(await svc.listVoices("fr")).toEqual([]);
  });

  it("keeps same-named voices apart by id and drops duplicate voiceURIs", async () => {
    synth.voices = [
      { name: "Voice", voiceURI: "urn:1", lang: "en-US" },
      { name: "Voice", voiceURI: "urn:2", lang: "en-GB" },
      { name: "Voice", voiceURI: "urn:2", lang: "en-GB" },
    ];
    const voices = await new BrowserTtsService().listVoices();
    expect(voices).toEqual([
      { id: "urn:1", name: "Voice", lang: "en-US" },
      { id: "urn:2", name: "Voice", lang: "en-GB" },
    ]);
  });

  it("waits for voiceschanged when the list is initially empty", async () => {
    const loaded = synth.voices;
    synth.voices = [];
    const promise = new BrowserTtsService().listVoices();
    synth.voices = loaded;
    synth.fireVoicesChanged();
    expect((await promise).length).toBe(3);
  });

  it("ignores voiceschanged firings that still deliver an empty list", async () => {
    const loaded = synth.voices;
    synth.voices = [];
    const promise = new BrowserTtsService().listVoices();
    // Android: the engine announces itself before any voices are ready
    synth.fireVoicesChanged();
    await new Promise((r) => setTimeout(r, 0));
    synth.voices = loaded;
    synth.fireVoicesChanged();
    expect((await promise).length).toBe(3);
  });

  it("picks up voices by polling when voiceschanged never fires", async () => {
    vi.useFakeTimers();
    try {
      const loaded = synth.voices;
      synth.voices = [];
      const promise = new BrowserTtsService().listVoices();
      await vi.advanceTimersByTimeAsync(300);
      synth.voices = loaded;
      await vi.advanceTimersByTimeAsync(300);
      expect((await promise).length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("matches Android underscore locales when filtering", async () => {
    synth.voices = [
      { name: "Czech Android", voiceURI: "urn:and:cs", lang: "cs_CZ" },
      { name: "German Android", voiceURI: "urn:and:de", lang: "de_DE" },
    ];
    const voices = await new BrowserTtsService().listVoices("cs");
    expect(voices.map((v) => v.name)).toEqual(["Czech Android"]);
  });

  it("throws when speech synthesis is unavailable", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const err = await new BrowserTtsService().listVoices().catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
    expect(err.retryable).toBe(false);
  });
});

describe("BrowserTtsService.synthesize", () => {
  it("always rejects (browser plays speech itself)", async () => {
    const err = await new BrowserTtsService().synthesize().catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
  });
});

describe("BrowserSpeechPipeline", () => {
  function setup(texts: string[]) {
    const events: PipelineEvent[] = [];
    const pipeline = new BrowserSpeechPipeline((e) => events.push(e));
    const cursor = new FakeCursor(makeSentences(texts));
    return { events, pipeline, cursor };
  }
  const types = (events: PipelineEvent[]) => events.map((e) => e.type);

  it("speaks sentences in order with a bounded utterance lookahead", async () => {
    const { events, pipeline, cursor } = setup(["One.", "Two.", "Three.", "Four."]);
    await pipeline.start(cursor, "urn:voice:en-a");
    await flush();
    // first sentence plus one lookahead utterance are queued
    expect(synth.queue.map((u) => u.text)).toEqual(["One.", "Two."]);
    expect(synth.queue[0].voice?.voiceURI).toBe("urn:voice:en-a");
    expect(types(events)).toEqual(["buffering"]);

    synth.startHead();
    await flush();
    expect(types(events)).toEqual(["buffering", "sentence-started", "playing"]);
    expect(pipeline.currentSentence?.text).toBe("One.");

    synth.endHead();
    await flush();
    // lookahead topped back up
    expect(synth.queue.map((u) => u.text)).toEqual(["Two.", "Three."]);
    synth.startHead();
    await flush();
    expect(pipeline.currentSentence?.text).toBe("Two.");
    expect(cursor.current.text).toBe("Three.");
  });

  it("emits ended after the last sentence finishes", async () => {
    const { events, pipeline, cursor } = setup(["Only one."]);
    await pipeline.start(cursor);
    await flush();
    synth.startHead();
    synth.endHead();
    await flush();
    expect(types(events)).toEqual([
      "buffering",
      "sentence-started",
      "playing",
      "sentence-ended",
      "ended",
    ]);
    expect(pipeline.active).toBe(false);
  });

  it("resolves the voice by its id (voiceURI)", async () => {
    const { pipeline, cursor } = setup(["Hello."]);
    await pipeline.start(cursor, "urn:voice:en-b");
    await flush();
    expect(synth.queue[0].voice?.name).toBe("English B");
  });

  it("sets utterance.lang from the selected voice so Chrome uses it", async () => {
    const { pipeline, cursor } = setup(["Ahoj."]);
    await pipeline.start(cursor, "urn:voice:cs-a"); // lang cs-CZ
    await flush();
    expect(synth.queue[0].lang).toBe("cs-CZ");
  });

  it("normalizes an Android underscore voice locale for utterance.lang", async () => {
    synth.voices = [
      { name: "Czech Android", voiceURI: "urn:and:cs", lang: "cs_CZ" },
    ];
    const pipeline = new BrowserSpeechPipeline(() => {});
    const cursor = new FakeCursor(makeSentences(["Ahoj."]));
    await pipeline.start(cursor, "urn:and:cs");
    await flush();
    expect(synth.queue[0].lang).toBe("cs-CZ");
  });

  it("falls back to the sentence language when no voice is selected", async () => {
    const pipeline = new BrowserSpeechPipeline(() => {});
    const cursor = new FakeCursor(makeSentences(["Ahoj."], "cs"));
    await pipeline.start(cursor);
    await flush();
    expect(synth.queue[0].lang).toBe("cs");
  });

  it("prefers the voice language over the sentence language", async () => {
    const pipeline = new BrowserSpeechPipeline(() => {});
    // sentence claims Czech, but the user picked an English voice
    const cursor = new FakeCursor(makeSentences(["Hello."], "cs"));
    await pipeline.start(cursor, "urn:voice:en-a"); // lang en-US
    await flush();
    expect(synth.queue[0].lang).toBe("en-US");
  });

  it("falls back to the sentence language when the voice reports an empty lang", async () => {
    synth.voices = [{ name: "No-lang", voiceURI: "urn:nolang", lang: "" }];
    const pipeline = new BrowserSpeechPipeline(() => {});
    const cursor = new FakeCursor(makeSentences(["Ahoj."], "cs"));
    await pipeline.start(cursor, "urn:nolang");
    await flush();
    expect(synth.queue[0].lang).toBe("cs");
  });

  it("stop cancels utterances and keeps the current sentence", async () => {
    const { pipeline, cursor } = setup(["One.", "Two."]);
    await pipeline.start(cursor);
    await flush();
    synth.startHead();
    pipeline.stop();
    expect(synth.cancelCalls).toBeGreaterThan(0);
    expect(synth.queue).toEqual([]);
    expect(pipeline.active).toBe(false);
    expect(pipeline.currentSentence?.text).toBe("One.");
  });

  it("rate change re-speaks pending sentences at the new rate", async () => {
    const { pipeline, cursor } = setup(["One.", "Two.", "Three."]);
    await pipeline.start(cursor);
    await flush();
    synth.startHead();
    await flush();
    expect(synth.queue.map((u) => u.rate)).toEqual([1, 1]);
    pipeline.setRate(1.5);
    await flush();
    // current sentence restarts, still followed by the lookahead
    expect(synth.queue.map((u) => u.text)).toEqual(["One.", "Two."]);
    expect(synth.queue.map((u) => u.rate)).toEqual([1.5, 1.5]);
    expect(pipeline.active).toBe(true);
  });

  it("pause cancels speech and resume re-speaks from the current sentence", async () => {
    const { events, pipeline, cursor } = setup(["One.", "Two.", "Three."]);
    await pipeline.start(cursor);
    await flush();
    synth.startHead();
    await flush();
    const interrupted = synth.queue[0];

    await pipeline.pause();
    // speech is silenced via cancel(), not the unreliable pause()
    expect(synth.pauseCalls).toBe(0);
    expect(synth.cancelCalls).toBeGreaterThan(0);
    expect(synth.queue).toEqual([]);
    expect(pipeline.active).toBe(true);
    // stale events from the cancelled utterance are ignored
    const eventsBefore = types(events);
    interrupted.onstart?.();
    interrupted.onend?.();
    expect(types(events)).toEqual(eventsBefore);

    await pipeline.resume();
    await flush();
    // the interrupted sentence restarts, followed by its lookahead
    expect(synth.queue.map((u) => u.text)).toEqual(["One.", "Two."]);
    synth.startHead();
    expect(pipeline.currentSentence?.text).toBe("One.");
  });

  it("pause during buffering re-speaks the current sentence on resume", async () => {
    const { pipeline, cursor } = setup(["One.", "Two."]);
    // pause while start() is still awaiting the voice list - nothing has
    // been handed to the engine yet
    const started = pipeline.start(cursor);
    await pipeline.pause();
    await started;
    expect(synth.queue).toEqual([]);
    await pipeline.resume();
    await flush();
    expect(synth.queue.map((u) => u.text)[0]).toBe("One.");
  });

  it("rate changed while paused applies to the re-spoken utterances", async () => {
    const { pipeline, cursor } = setup(["One.", "Two."]);
    await pipeline.start(cursor);
    await flush();
    synth.startHead();
    await pipeline.pause();
    pipeline.setRate(1.75);
    await pipeline.resume();
    await flush();
    expect(synth.queue.length).toBeGreaterThan(0);
    expect(synth.queue.every((u) => u.rate === 1.75)).toBe(true);
  });

  it("stop while paused clears the pending resume", async () => {
    const { events, pipeline, cursor } = setup(["One.", "Two."]);
    await pipeline.start(cursor);
    await flush();
    synth.startHead();
    await pipeline.pause();
    pipeline.stop();
    const eventsBefore = types(events);
    await pipeline.resume();
    await flush();
    expect(synth.queue).toEqual([]);
    expect(types(events)).toEqual(eventsBefore);
    expect(pipeline.active).toBe(false);
  });

  it("maps utterance errors to a pipeline error and ignores interruptions", async () => {
    const { events, pipeline, cursor } = setup(["One.", "Two."]);
    await pipeline.start(cursor);
    await flush();
    synth.queue[0].onerror?.({ error: "interrupted" });
    expect(types(events)).toEqual(["buffering"]);
    synth.queue[0].onerror?.({ error: "synthesis-failed" });
    expect(types(events)).toEqual(["buffering", "error"]);
    const errorEvent = events.at(-1) as { type: "error"; error: unknown };
    expect(errorEvent.error).toBeInstanceOf(TtsServiceError);
    expect(pipeline.active).toBe(false);
    // failed pipeline keeps the sentence for retry-from-here
    expect(pipeline.currentSentence?.text).toBe("One.");
  });

  it("reports an error when speech synthesis is unavailable", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const { events, pipeline, cursor } = setup(["One."]);
    await pipeline.start(cursor);
    expect(types(events)).toEqual(["error"]);
    expect(pipeline.active).toBe(false);
  });

  it("stale utterance events after stop are ignored", async () => {
    const { events, pipeline, cursor } = setup(["One.", "Two."]);
    await pipeline.start(cursor);
    await flush();
    const utterance = synth.queue[0];
    pipeline.stop();
    utterance.onstart?.();
    utterance.onend?.();
    expect(types(events)).toEqual(["buffering"]);
  });
});
