import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoliateView } from "foliate-js/view.js";
import type { PlayerEvent, SpeechPlayerLike } from "./player";
import { TtsServicePipeline, type PipelineEvent, type SpeechPipeline } from "./pipeline";
import type { SynthesisRequest, SynthesisResult, TtsService } from "./tts-service";

// The service's pipeline instantiates SpeechPlayer (WebAudio) and the
// controller calls createTtsService internally - substitute both with test
// fakes (the ./player mock makes TtsServicePipeline pick up FakePlayer).
const fakes = vi.hoisted(() => {
  class FakePlayer implements SpeechPlayerLike {
    static instances: FakePlayer[] = [];
    onEvent: (e: PlayerEvent) => void = () => {};
    queue: number[] = [];
    flushCalls = 0;
    rate = 1;
    destroyed = false;
    constructor() {
      FakePlayer.instances.push(this);
    }
    get bufferedSeconds() {
      return this.queue.length * 10;
    }
    get queuedCount() {
      return this.queue.length;
    }
    async enqueue(id: number) {
      this.queue.push(id);
    }
    async play() {}
    async pause() {}
    flush() {
      this.flushCalls++;
      this.queue = [];
    }
    setRate(v: number) {
      this.rate = v;
    }
    async destroy() {
      this.destroyed = true;
    }
    // test helper: pretend the head item started playing
    startNext(): number | null {
      const id = this.queue.shift();
      if (id === undefined) {
        this.onEvent({ type: "drained" });
        return null;
      }
      this.onEvent({ type: "item-started", id });
      return id;
    }
  }

  class FakeService implements TtsService {
    readonly id = "fake";
    requests: { text: string; voice?: string }[] = [];
    voicesRequestedFor: (string | undefined)[] = [];
    createPipeline(onEvent: (e: PipelineEvent) => void): SpeechPipeline {
      return new TtsServicePipeline(this, onEvent);
    }
    async listVoices(language?: string) {
      this.voicesRequestedFor.push(language);
      const voices = [
        { id: "Czech Voice", name: "Czech Voice", lang: "cs" },
        { id: "Other Czech Voice", name: "Other Czech Voice", lang: "cs" },
        { id: "English Voice", name: "English Voice", lang: "en" },
      ];
      return language === undefined
        ? voices
        : voices.filter((v) => v.lang === language.toLowerCase().split("-")[0]);
    }
    async synthesize(req: SynthesisRequest): Promise<SynthesisResult> {
      this.requests.push({ text: req.text, voice: req.voice });
      return { data: new ArrayBuffer(4), mimeType: "audio/wav" };
    }
  }
  return { FakePlayer, FakeService, service: new FakeService() };
});

vi.mock("./player", () => ({ SpeechPlayer: fakes.FakePlayer }));
vi.mock("./tts-service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createTtsService: async () => fakes.service,
}));
vi.mock("svelte-sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}));
const { HIGHLIGHT_FN } = vi.hoisted(() => ({ HIGHLIGHT_FN: () => null }));
vi.mock("foliate-js/overlayer.js", () => ({
  Overlayer: { highlight: HIGHLIGHT_FN },
}));

import { TtsController, highlightStyle } from "./controller.svelte";

function parseDoc(bodyHtml: string): Document {
  return new DOMParser().parseFromString(
    `<html><body>${bodyHtml}</body></html>`,
    "text/html",
  );
}

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
};

// stub view: EventTarget-capable elements + fake CFI scheme (see
// sentences.test.ts for the encoding)
function makeView(sectionHtml: string[]) {
  const counters = new Map<number, number>();
  // records highlight annotation operations; "added" marks the async add
  // completing (a few microtasks later, like foliate's CFI resolution)
  const annotationLog: string[] = [];
  const view = document.createElement("div") as unknown as FoliateView &
    Record<string, unknown>;
  const renderer = document.createElement("div") as unknown as {
    addEventListener: typeof HTMLElement.prototype.addEventListener;
    dispatchEvent: typeof HTMLElement.prototype.dispatchEvent;
  } & Record<string, unknown>;
  const docs = sectionHtml.map((h) => parseDoc(h));
  // stand-in for the section's overlay SVG (holds the highlight opacity var)
  const overlayEl = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  // spy on the native selection clearing (happy-dom has no real selection)
  const removeAllRanges = vi.fn();
  for (const d of docs) {
    (d as unknown as { getSelection: () => Selection }).getSelection = () =>
      ({ removeAllRanges }) as unknown as Selection;
  }
  Object.assign(renderer, {
    getContents: () => [
      { doc: docs[0], index: 0, overlayer: { element: overlayEl } },
    ],
    scrollToAnchor: vi.fn(),
  });
  Object.assign(view, {
    renderer,
    book: {
      metadata: { language: "cs" },
      sections: sectionHtml.map((_, i) => ({
        createDocument: async () => docs[i],
      })),
    },
    getCFI(index: number) {
      const n = counters.get(index) ?? 0;
      counters.set(index, n + 1);
      return `epubcfi(/6/${(index + 1) * 2}!/4,/${(n + 1) * 2}/1:0,/${(n + 1) * 2 + 1})`;
    },
    resolveCFI(cfi: string) {
      const m = cfi.match(/\/6\/(\d+)!/);
      if (!m) throw new Error("bad cfi");
      return { index: parseInt(m[1]) / 2 - 1, anchor: () => docs[0].body };
    },
    addAnnotation: vi.fn(async () => {
      annotationLog.push("add");
      await Promise.resolve();
      await Promise.resolve();
      annotationLog.push("added");
    }),
    deleteAnnotation: vi.fn(async () => {
      annotationLog.push("del");
    }),
    goTo: vi.fn(async () => undefined),
    lastLocation: { cfi: "epubcfi(/6/2!/4/2/1:0)" },
  });
  return {
    view: view as unknown as FoliateView,
    renderer,
    counters,
    annotationLog,
    removeAllRanges,
    overlayEl,
  };
}

function rendererRelocate(
  renderer: { dispatchEvent: (e: Event) => boolean },
  reason: string,
  index = 0,
  fraction = 0,
) {
  renderer.dispatchEvent(
    new CustomEvent("relocate", {
      detail: { reason, range: null, index, fraction, size: 100 },
    }),
  );
}

describe("TtsController", () => {
  beforeEach(() => {
    localStorage.clear();
    fakes.FakePlayer.instances.length = 0;
    fakes.service.requests.length = 0;
    fakes.service.voicesRequestedFor.length = 0;
  });

  async function setup() {
    const stub = makeView(["<p>First one. Second one. Third one.</p>"]);
    const controller = new TtsController(() => stub.view);
    await controller.enable();
    return { ...stub, controller, player: fakes.FakePlayer.instances.at(-1)! };
  }

  it("enable lists voices for the book language and picks the first", async () => {
    const { controller } = await setup();
    expect(controller.status).toBe("idle");
    expect(fakes.service.voicesRequestedFor).toEqual(["cs"]); // book lang
    expect(controller.voices.map((v) => v.name)).toEqual([
      "Czech Voice",
      "Other Czech Voice",
    ]);
    expect(controller.voice).toBe("Czech Voice");
  });

  it("enable respects the persisted voice preference", async () => {
    localStorage.setItem(
      "mbs4.tts",
      JSON.stringify({ voice: "Other Czech Voice", rate: 1.5 }),
    );
    vi.resetModules();
    const { TtsController: Ctl } = await import("./controller.svelte");
    const stub = makeView(["<p>Hello there.</p>"]);
    const controller = new Ctl(() => stub.view);
    await controller.enable();
    expect(controller.voice).toBe("Other Czech Voice");
    expect(controller.rate).toBe(1.5);
  });

  it("play starts from the current reader location and highlights the sentence", async () => {
    const { controller, view, player } = await setup();
    await controller.play();
    await flush();
    expect(controller.status).toBe("buffering");
    player.startNext();
    await flush();
    expect(controller.status).toBe("playing");
    expect(controller.currentSentence?.text).toBe("First one.");
    expect(
      (view.addAnnotation as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
    // page-follow scrolled to the sentence (self navigation)
    expect(
      (view.renderer.scrollToAnchor as ReturnType<typeof vi.fn>).mock.calls
        .length,
    ).toBeGreaterThan(0);
  });

  it("stop clears the highlight and returns to idle", async () => {
    const { controller, view, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    controller.stop();
    await flush();
    expect(controller.status).toBe("idle");
    expect(
      (view.deleteAnnotation as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("stop immediately after a sentence starts still clears the highlight", async () => {
    const { controller, player, annotationLog } = await setup();
    await controller.play();
    await flush();
    player.startNext(); // sentence-started: highlight add is in flight
    controller.stop(); // stop before the add resolved
    await flush();
    // the delete must run after the add completed, never before it
    expect(annotationLog).toContain("added");
    expect(annotationLog.at(-1)).toBe("del");
  });

  it("stop clears the native text selection", async () => {
    const { controller, player, removeAllRanges } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    removeAllRanges.mockClear();
    controller.stop();
    expect(removeAllRanges).toHaveBeenCalled();
  });

  it("drops the native selection foliate makes on a page-follow relocate", async () => {
    const { controller, renderer, player, removeAllRanges } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    const requestsBefore = fakes.service.requests.length;
    removeAllRanges.mockClear();
    rendererRelocate(renderer, "selection"); // our own scrollToAnchor(select)
    await flush();
    // selection cleared, speech not restarted
    expect(removeAllRanges).toHaveBeenCalled();
    expect(fakes.service.requests.length).toBe(requestsBefore);
    expect(controller.status).toBe("playing");
  });

  it("pause keeps the highlight; stop while paused clears it", async () => {
    const { controller, view, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    const deletes = () =>
      (view.deleteAnnotation as ReturnType<typeof vi.fn>).mock.calls.length;
    const deletesBefore = deletes();
    controller.pause();
    await flush();
    expect(controller.status).toBe("paused");
    expect(deletes()).toBe(deletesBefore);
    controller.stop();
    await flush();
    expect(deletes()).toBeGreaterThan(deletesBefore);
  });

  it("highlightStyle differs between light and dark", () => {
    const light = highlightStyle("light");
    const dark = highlightStyle("dark");
    expect(light.color).not.toBe(dark.color);
    expect(light.opacity).toBeNull();
    expect(dark.opacity).not.toBeNull();
  });

  it("draws the highlight with the current scheme's colour", async () => {
    const { controller, view } = await setup();
    controller.setScheme("dark");
    const draw = vi.fn();
    view.dispatchEvent(
      new CustomEvent("draw-annotation", { detail: { draw } }),
    );
    expect(draw).toHaveBeenCalledWith(HIGHLIGHT_FN, {
      color: highlightStyle("dark").color,
    });
  });

  it("setScheme sets the overlay opacity var for dark and clears it for light", async () => {
    const { controller, overlayEl } = await setup();
    controller.setScheme("dark");
    expect(
      overlayEl.style.getPropertyValue("--overlayer-highlight-opacity"),
    ).toBe(highlightStyle("dark").opacity);
    controller.setScheme("light");
    expect(
      overlayEl.style.getPropertyValue("--overlayer-highlight-opacity"),
    ).toBe("");
  });

  it("setScheme recolours a live highlight (re-adds the annotation)", async () => {
    const { controller, view, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    const addsBefore = (view.addAnnotation as ReturnType<typeof vi.fn>).mock
      .calls.length;
    controller.setScheme("dark");
    await flush();
    expect(
      (view.addAnnotation as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(addsBefore);
  });

  it("user navigation while playing restarts speech from the new location", async () => {
    const { controller, renderer, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    const requestsBefore = fakes.service.requests.length;
    rendererRelocate(renderer, "page");
    await flush();
    // pipeline restarted: synthesis requested again from the nav target
    expect(fakes.service.requests.length).toBeGreaterThan(requestsBefore);
    expect(["buffering", "playing"]).toContain(controller.status);
  });

  it("ignores a snap relocate at the unchanged position (stationary tap)", async () => {
    const { controller, renderer, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    // a real page turn establishes the current position (fraction 0.5)
    rendererRelocate(renderer, "page", 0, 0.5);
    await flush();
    player.startNext();
    await flush();
    expect(controller.status).toBe("playing");
    const requestsBefore = fakes.service.requests.length;
    // a tap on the same page snaps back to it - must not restart speech
    rendererRelocate(renderer, "snap", 0, 0.5);
    await flush();
    expect(fakes.service.requests.length).toBe(requestsBefore);
    expect(controller.status).toBe("playing");
  });

  it("a snap to a new position still restarts speech", async () => {
    const { controller, renderer, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    rendererRelocate(renderer, "page", 0, 0.5);
    await flush();
    player.startNext();
    await flush();
    const requestsBefore = fakes.service.requests.length;
    // a real swipe changes the page fraction - speech restarts there
    rendererRelocate(renderer, "snap", 0, 0.9);
    await flush();
    expect(fakes.service.requests.length).toBeGreaterThan(requestsBefore);
    expect(["buffering", "playing"]).toContain(controller.status);
  });

  it("resets the position guard when TTS is toggled off and on", async () => {
    const { controller, renderer, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    // establish a position at fraction 0.5 in this session
    rendererRelocate(renderer, "page", 0, 0.5);
    await flush();
    player.startNext();
    await flush();

    // turn TTS off and on again - a new session
    await controller.disable();
    await controller.enable();
    const player2 = fakes.FakePlayer.instances.at(-1)!;
    await controller.play();
    await flush();
    player2.startNext();
    await flush();
    expect(controller.status).toBe("playing");

    const requestsBefore = fakes.service.requests.length;
    // navigating to the same fraction as the previous session must still
    // restart (the guard must not carry over the old position)
    rendererRelocate(renderer, "navigation", 0, 0.5);
    await flush();
    expect(fakes.service.requests.length).toBeGreaterThan(requestsBefore);
  });

  it("ignores layout re-anchoring and self-navigation relocates", async () => {
    const { controller, renderer, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    const requestsBefore = fakes.service.requests.length;
    rendererRelocate(renderer, "anchor"); // resize / re-anchor
    rendererRelocate(renderer, "selection"); // our own scrollToAnchor
    await flush();
    expect(fakes.service.requests.length).toBe(requestsBefore);
    expect(controller.status).toBe("playing");
  });

  it("treats TOC/slider navigation (reason navigation) as user navigation", async () => {
    const { controller, renderer, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    const requestsBefore = fakes.service.requests.length;
    rendererRelocate(renderer, "navigation");
    await flush();
    expect(fakes.service.requests.length).toBeGreaterThan(requestsBefore);
  });

  it("user navigation while paused resets to idle without restarting", async () => {
    const { controller, renderer, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    controller.pause();
    expect(controller.status).toBe("paused");
    const requestsBefore = fakes.service.requests.length;
    rendererRelocate(renderer, "page");
    await flush();
    expect(controller.status).toBe("idle");
    expect(fakes.service.requests.length).toBe(requestsBefore);
  });

  it("jumpTo restarts speech from the sentence at the given position", async () => {
    const { controller, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    expect(controller.currentSentence?.text).toBe("First one.");
    // point inside the third sentence (fake CFI scheme: /6 for its start)
    await controller.jumpTo("epubcfi(/6/2!/4/6/1:0)");
    await flush();
    player.startNext();
    await flush();
    expect(controller.currentSentence?.text).toBe("Third one.");
    expect(controller.status).toBe("playing");
  });

  it("voice change mid-playback re-synthesizes from the current sentence", async () => {
    const { controller, player } = await setup();
    await controller.play();
    await flush();
    player.startNext();
    await flush();
    controller.setVoice("English Voice");
    await flush();
    const voices = fakes.service.requests.map((r) => r.voice);
    expect(voices).toContain("English Voice");
    expect(JSON.parse(localStorage.getItem("mbs4.tts")!).voice).toBe(
      "English Voice",
    );
  });

  it("rate change applies to the player and persists", async () => {
    const { controller, player } = await setup();
    controller.setRate(1.5);
    expect(player.rate).toBe(1.5);
    expect(JSON.parse(localStorage.getItem("mbs4.tts")!).rate).toBe(1.5);
  });

  it("disable tears everything down", async () => {
    const { controller, player } = await setup();
    await controller.play();
    await flush();
    await controller.disable();
    expect(controller.status).toBe("off");
    expect(player.destroyed).toBe(true);
  });
});
