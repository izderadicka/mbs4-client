import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerEvent, SpeechPlayerLike } from "./player";
import {
  TtsServicePipeline,
  type PipelineEvent,
  type SpeechPipeline,
} from "./pipeline";
import type { SentenceCursor, SentenceRef } from "./sentences";
import {
  TtsServiceError,
  type SynthesisRequest,
  type SynthesisResult,
  type TtsService,
} from "./tts-service";

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
};

function makeSentences(n: number): SentenceRef[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `Sentence ${i}.`,
    cfi: `epubcfi(/6/2!/4/${(i + 1) * 2},/1:0,/1:10)`,
    sectionIndex: 0,
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

interface PendingRequest {
  text: string;
  voice?: string;
  resolve: () => void;
  reject: (e: unknown) => void;
}

class FakeService implements TtsService {
  readonly id = "fake";
  requests: PendingRequest[] = [];
  createPipeline(onEvent: (e: PipelineEvent) => void): SpeechPipeline {
    return new TtsServicePipeline(this, onEvent);
  }
  async listVoices() {
    return [{ name: "V1" }];
  }
  synthesize(req: SynthesisRequest, signal?: AbortSignal): Promise<SynthesisResult> {
    return new Promise((resolve, reject) => {
      const audio: SynthesisResult = {
        data: new ArrayBuffer(4),
        mimeType: "audio/wav",
      };
      signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
      this.requests.push({
        text: req.text,
        voice: req.voice,
        resolve: () => resolve(audio),
        reject,
      });
    });
  }
  // resolve the pending request for the given sentence text
  complete(text: string) {
    const i = this.requests.findIndex((r) => r.text === text);
    if (i < 0) throw new Error(`no pending request for ${text}`);
    this.requests.splice(i, 1)[0].resolve();
  }
  failNext(error: unknown) {
    const r = this.requests.shift();
    if (!r) throw new Error("no pending request");
    r.reject(error);
  }
}

class FakePlayer implements SpeechPlayerLike {
  onEvent: (e: PlayerEvent) => void = () => {};
  queue: number[] = [];
  enqueuedOrder: number[] = [];
  playCalls = 0;
  pauseCalls = 0;
  flushCalls = 0;
  rate = 1;
  secondsPerItem = 10;

  get bufferedSeconds() {
    return (this.queue.length * this.secondsPerItem) / this.rate;
  }
  get queuedCount() {
    return this.queue.length;
  }
  async enqueue(id: number) {
    this.enqueuedOrder.push(id);
    this.queue.push(id);
  }
  async play() {
    this.playCalls++;
  }
  async pause() {
    this.pauseCalls++;
  }
  flush() {
    this.flushCalls++;
    this.queue = [];
  }
  setRate(v: number) {
    this.rate = v;
  }
  async destroy() {}
  // simulate playback progress
  startNext(): number | null {
    const id = this.queue.shift();
    if (id === undefined) {
      this.onEvent({ type: "drained" });
      return null;
    }
    this.onEvent({ type: "item-started", id });
    return id;
  }
  endItem(id: number) {
    this.onEvent({ type: "item-ended", id });
  }
}

function setup(sentenceCount: number, opts?: Record<string, number>) {
  const service = new FakeService();
  const player = new FakePlayer();
  const events: PipelineEvent[] = [];
  const pipeline = new TtsServicePipeline(
    service,
    (e) => events.push(e),
    {
      targetBufferSeconds: 30,
      minLookaheadSentences: 2,
      maxLookaheadSentences: 4,
      maxConcurrentSynth: 2,
      retryInitialMs: 100,
      retryMaxMs: 400,
      retryWindowMs: 1000,
      ...opts,
      player,
    },
  );
  const sentences = makeSentences(sentenceCount);
  const cursor = new FakeCursor(sentences);
  return { service, player, events, pipeline, sentences, cursor };
}

const types = (events: PipelineEvent[]) => events.map((e) => e.type);

describe("TtsServicePipeline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts buffering, respects the concurrency limit, and passes the voice", async () => {
    const { service, player, events, pipeline, cursor } = setup(10);
    await pipeline.start(cursor, "V1");
    await flush();
    expect(types(events)).toEqual(["buffering"]);
    expect(player.playCalls).toBe(1);
    expect(service.requests.length).toBe(2); // maxConcurrentSynth
    expect(service.requests[0].voice).toBe("V1");
    expect(pipeline.currentSentence?.text).toBe("Sentence 0.");
  });

  it("enqueues audio in reading order despite out-of-order completion", async () => {
    const { service, player, pipeline, cursor } = setup(10);
    await pipeline.start(cursor);
    await flush();
    // complete the second sentence before the first
    service.complete("Sentence 1.");
    await flush();
    expect(player.enqueuedOrder).toEqual([]); // head still pending
    service.complete("Sentence 0.");
    await flush();
    expect(player.enqueuedOrder).toEqual([0, 1]);
  });

  it("stops prefetching at the lookahead cap", async () => {
    const { service, player, pipeline, cursor } = setup(20);
    await pipeline.start(cursor);
    await flush();
    // complete everything that gets requested
    while (service.requests.length > 0) {
      service.requests.shift()!.resolve();
      await flush();
    }
    // ledger + player queue is capped at maxLookaheadSentences
    expect(player.queuedCount).toBeLessThanOrEqual(4);
    expect(player.enqueuedOrder.length).toBeLessThanOrEqual(4);
  });

  it("emits sentence-started/playing and refills as playback progresses", async () => {
    const { service, player, events, pipeline, cursor, sentences } = setup(10);
    await pipeline.start(cursor);
    await flush();
    service.complete("Sentence 0.");
    await flush();
    const id = player.startNext()!;
    await flush();
    expect(types(events)).toEqual(["buffering", "sentence-started", "playing"]);
    expect(
      (events[1] as { sentence: SentenceRef }).sentence.text,
    ).toBe(sentences[0].text);
    player.endItem(id);
    await flush();
    expect(types(events)).toContain("sentence-ended");
    // playback progress triggers further synthesis
    expect(service.requests.length).toBeGreaterThan(0);
  });

  it("reports buffering on stall and playing on recovery", async () => {
    const { service, player, events, pipeline, cursor } = setup(10);
    await pipeline.start(cursor);
    await flush();
    service.complete("Sentence 0.");
    await flush();
    player.startNext();
    await flush();
    // stall: nothing else decoded yet
    player.startNext();
    await flush();
    expect(types(events)).toEqual([
      "buffering",
      "sentence-started",
      "playing",
      "buffering",
    ]);
    service.complete("Sentence 1.");
    await flush();
    player.startNext();
    await flush();
    expect(types(events)).toEqual([
      "buffering",
      "sentence-started",
      "playing",
      "buffering",
      "sentence-started",
      "playing",
    ]);
  });

  it("retries transient failures with backoff and recovers", async () => {
    vi.useFakeTimers();
    const { service, player, pipeline, cursor } = setup(10);
    await pipeline.start(cursor);
    await vi.advanceTimersByTimeAsync(0);
    const before = service.requests.length;
    service.failNext(new TtsServiceError("outage", { retryable: true }));
    await vi.advanceTimersByTimeAsync(0);
    // not yet retried (backoff pending)
    expect(service.requests.length).toBe(before - 1);
    await vi.advanceTimersByTimeAsync(100);
    expect(service.requests.length).toBe(before);
    service.complete("Sentence 0.");
    await vi.advanceTimersByTimeAsync(0);
    expect(player.enqueuedOrder).toEqual([0]);
  });

  it("fails terminally when the retry window is exhausted", async () => {
    vi.useFakeTimers();
    const { service, player, events, pipeline, cursor } = setup(10, {
      retryWindowMs: 250,
      retryInitialMs: 100,
    });
    await pipeline.start(cursor, undefined);
    await vi.advanceTimersByTimeAsync(0);
    // keep failing the head sentence past the window
    for (let i = 0; i < 5 && !types(events).includes("error"); i++) {
      const req = service.requests.find((r) => r.text === "Sentence 0.");
      if (req) {
        service.requests.splice(service.requests.indexOf(req), 1);
        req.reject(new TtsServiceError("outage", { retryable: true }));
      }
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(types(events)).toContain("error");
    expect(player.flushCalls).toBeGreaterThan(0);
    expect(pipeline.active).toBe(false);
    // current sentence kept for manual retry
    expect(pipeline.currentSentence?.text).toBe("Sentence 0.");
  });

  it("fails terminally on non-retryable errors without retrying", async () => {
    const { service, events, pipeline, cursor } = setup(10);
    await pipeline.start(cursor);
    await flush();
    service.failNext(new TtsServiceError("bad request", { retryable: false }));
    await flush();
    expect(types(events)).toContain("error");
  });

  it("discards stale completions after stop", async () => {
    const { service, player, pipeline, cursor } = setup(10);
    await pipeline.start(cursor);
    await flush();
    pipeline.stop();
    // resolving after stop must not reach the player
    for (const r of [...service.requests]) r.resolve();
    await flush();
    expect(player.enqueuedOrder).toEqual([]);
    // one flush from start() (defensive stop) + one from the explicit stop()
    expect(player.flushCalls).toBe(2);
  });

  it("can restart with a new cursor after stop", async () => {
    const { service, player, pipeline, cursor } = setup(4);
    await pipeline.start(cursor);
    await flush();
    pipeline.stop();
    const fresh = new FakeCursor(makeSentences(4));
    await pipeline.start(fresh, "V2");
    await flush();
    const req = service.requests.find((r) => r.voice === "V2");
    expect(req).toBeTruthy();
    req!.resolve();
    await flush();
    expect(player.enqueuedOrder.length).toBe(1);
  });

  it("emits ended exactly once when the book finishes", async () => {
    const { service, player, events, pipeline, cursor } = setup(2);
    await pipeline.start(cursor);
    await flush();
    service.complete("Sentence 0.");
    service.complete("Sentence 1.");
    await flush();
    let id = player.startNext();
    while (id !== null) {
      await flush();
      player.endItem(id);
      await flush();
      id = player.startNext();
    }
    await flush();
    expect(types(events).filter((t) => t === "ended")).toEqual(["ended"]);
    expect(pipeline.active).toBe(false);
  });

  it("treats decode failures as terminal errors", async () => {
    const { service, player, events, pipeline, cursor } = setup(4);
    await pipeline.start(cursor);
    await flush();
    service.complete("Sentence 0.");
    await flush();
    player.onEvent({ type: "item-error", id: 0, error: new Error("decode") });
    await flush();
    expect(types(events)).toContain("error");
  });

  it("delegates rate changes to the player", () => {
    const { player, pipeline } = setup(2);
    pipeline.setRate(1.5);
    expect(player.rate).toBe(1.5);
  });
});
