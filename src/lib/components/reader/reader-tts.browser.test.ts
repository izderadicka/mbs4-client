// End-to-end smoke test of read-aloud in the real reader: opens a small FB2
// book in <foliate-view> (chromium), enables TTS (mock service - the
// provider defaults to mock outside production), plays, and exercises the
// controls. Audio really plays (autoplay is enabled in the test launcher).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import Reader from "./reader.svelte";

const FB2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"
             xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info>
      <genre>prose</genre>
      <author><first-name>Test</first-name><last-name>Author</last-name></author>
      <book-title>TTS Smoke Test</book-title>
      <lang>en</lang>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Chapter One</p></title>
      <p>First sentence here. Second sentence follows it. A third one ends the page.</p>
    </section>
    <section>
      <title><p>Chapter Two</p></title>
      <p>Another chapter starts now. It has a couple of sentences too.</p>
    </section>
  </body>
</FictionBook>`;

function bookFile(): File {
  return new File([FB2], "tts-smoke-test.fb2", { type: "application/xml" });
}

function button(container: HTMLElement, title: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
  if (!el) throw new Error(`button "${title}" not found`);
  return el;
}


describe("reader read-aloud (browser)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens a book, plays speech with highlight, and responds to controls", async () => {
    const { container } = render(Reader, {
      file: bookFile(),
      storageKey: "mbs4.reading.test.1",
      showBars: true,
    });
    const root = container as HTMLElement;

    // book loaded: read-aloud toggle becomes enabled
    await vi.waitFor(
      () => expect(button(root, "Read aloud").disabled).toBe(false),
      { timeout: 20000 },
    );
    // wait for the first section to render fully (initial relocate persists
    // the reading position) before resizing the layout with the TTS bar
    await vi.waitFor(
      () => expect(localStorage.getItem("mbs4.reading.test.1")).toBeTruthy(),
      { timeout: 10000 },
    );

    // the highlight is drawn inside the paginator's closed shadow DOM, so
    // observe the draw-annotation event instead of the DOM
    const drawn: string[] = [];
    root
      .querySelector("foliate-view")!
      .addEventListener("draw-annotation", (e) => {
        drawn.push((e as CustomEvent<{ annotation: { value: string } }>).detail.annotation.value);
      });

    // enable TTS: control bar appears with an enabled Play button
    button(root, "Read aloud").click();
    await vi.waitFor(
      () => expect(button(root, "Play").disabled).toBe(false),
      { timeout: 10000 },
    );

    // play: mock synthesis buffers, playback starts (Play flips to Pause)
    button(root, "Play").click();
    await vi.waitFor(() => button(root, "Pause"), { timeout: 15000 });

    // the spoken sentence got highlighted (overlay drawn for its CFI)
    await vi.waitFor(() => expect(drawn.length).toBeGreaterThan(0), {
      timeout: 10000,
    });
    expect(drawn[0]).toMatch(/^epubcfi\(/);

    // pause returns the Play button and playback stays paused
    button(root, "Pause").click();
    await vi.waitFor(() => button(root, "Play"), { timeout: 5000 });

    // resume + jump to next sentence keeps playing
    button(root, "Play").click();
    await vi.waitFor(() => button(root, "Pause"), { timeout: 15000 });
    button(root, "Next sentence").click();
    await vi.waitFor(() => button(root, "Pause"), { timeout: 15000 });

    // stop disarms playback
    button(root, "Stop reading").click();
    await vi.waitFor(
      () => expect(button(root, "Play").disabled).toBe(false),
      { timeout: 5000 },
    );

    // disable TTS: the control bar goes away
    button(root, "Read aloud").click();
    await vi.waitFor(() =>
      expect(root.querySelector('button[title="Play"]')).toBeNull(),
    );
  }, 90000);
});
