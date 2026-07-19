// Read-aloud in the real reader with the *browser* (Web Speech API) TTS
// service, driven against a scripted speech engine (headless chromium has
// no real TTS engine): verifies the utterance-based pipeline end to end in
// the app - playback, highlight lifecycle on pause and stop.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import type { FoliateView } from "foliate-js/view.js";
import { appSettings } from "$lib/settings.svelte";
import Reader from "./reader.svelte";

const FB2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"
             xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info>
      <genre>prose</genre>
      <author><first-name>Test</first-name><last-name>Author</last-name></author>
      <book-title>Browser TTS Smoke Test</book-title>
      <lang>en</lang>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Chapter One</p></title>
      <p>First sentence here. Second sentence follows it. A third one ends the page.</p>
    </section>
  </body>
</FictionBook>`;

class FakeUtterance {
  text: string;
  voice: unknown = null;
  rate = 1;
  lang = "";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

// minimal speechSynthesis look-alike: one voice, utterances "speak" for
// utteranceMs so tests can stop mid-sentence
class FakeSpeechEngine {
  utteranceMs: number;
  #queue: FakeUtterance[] = [];
  #current: FakeUtterance | null = null;
  #timers: ReturnType<typeof setTimeout>[] = [];

  constructor(utteranceMs: number) {
    this.utteranceMs = utteranceMs;
  }
  getVoices() {
    return [{ name: "Fake EN", voiceURI: "fake-en", lang: "en-US" }];
  }
  addEventListener() {}
  removeEventListener() {}
  pause() {}
  resume() {}
  speak(u: FakeUtterance) {
    this.#queue.push(u);
    this.#maybeStart();
  }
  #maybeStart() {
    if (this.#current || this.#queue.length === 0) return;
    const u = (this.#current = this.#queue.shift()!);
    this.#timers.push(setTimeout(() => u.onstart?.(), 20));
    this.#timers.push(
      setTimeout(() => {
        this.#current = null;
        u.onend?.();
        this.#maybeStart();
      }, this.utteranceMs),
    );
  }
  cancel() {
    for (const t of this.#timers) clearTimeout(t);
    this.#timers = [];
    const interrupted = this.#current
      ? [this.#current, ...this.#queue]
      : [...this.#queue];
    this.#current = null;
    this.#queue = [];
    // chromium reports cancelled utterances asynchronously
    for (const u of interrupted) {
      setTimeout(() => u.onerror?.({ error: "interrupted" }), 0);
    }
  }
}

function button(container: HTMLElement, title: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
  if (!el) throw new Error(`button "${title}" not found`);
  return el;
}

describe("reader read-aloud with the browser TTS pipeline", () => {
  let engine: FakeSpeechEngine;

  beforeEach(() => {
    localStorage.clear();
    appSettings.ttsProvider = "browser";
    engine = new FakeSpeechEngine(600);
    Object.defineProperty(globalThis, "speechSynthesis", {
      value: engine,
      configurable: true,
    });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      value: FakeUtterance,
      configurable: true,
    });
  });

  afterEach(() => {
    appSettings.ttsProvider = "mock";
  });

  it("plays, keeps the highlight on pause, clears it on mid-sentence stop", async () => {
    const { container } = render(Reader, {
      file: new File([FB2], "browser-tts-test.fb2", { type: "application/xml" }),
      storageKey: "mbs4.reading.browser-tts.1",
      showBars: true,
    });
    const root = container as HTMLElement;

    await vi.waitFor(
      () => expect(button(root, "Read aloud").disabled).toBe(false),
      { timeout: 20000 },
    );
    await vi.waitFor(
      () =>
        expect(localStorage.getItem("mbs4.reading.browser-tts.1")).toBeTruthy(),
      { timeout: 10000 },
    );

    const view = root.querySelector("foliate-view") as unknown as FoliateView;
    const highlightCount = () =>
      view.renderer
        .getContents()
        .reduce((n, c) => n + (c.overlayer?.element.childElementCount ?? 0), 0);

    button(root, "Read aloud").click();
    await vi.waitFor(() => expect(button(root, "Play").disabled).toBe(false), {
      timeout: 10000,
    });

    // play: the fake engine voice is used and the sentence gets highlighted
    button(root, "Play").click();
    await vi.waitFor(() => button(root, "Pause"), { timeout: 10000 });
    await vi.waitFor(() => expect(highlightCount()).toBeGreaterThan(0), {
      timeout: 5000,
    });

    // pause mid-sentence: speech stops but the highlight stays
    button(root, "Pause").click();
    await vi.waitFor(() => button(root, "Play"), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 100));
    expect(highlightCount()).toBeGreaterThan(0);

    // resume, then stop in the middle of a sentence: highlight is cleared
    button(root, "Play").click();
    await vi.waitFor(() => button(root, "Pause"), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 200)); // well inside the utterance
    button(root, "Stop reading").click();
    await vi.waitFor(() => expect(highlightCount()).toBe(0), { timeout: 5000 });
    expect(button(root, "Play").disabled).toBe(false);
  }, 90000);
});
