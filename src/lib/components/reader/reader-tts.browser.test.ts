// End-to-end smoke test of read-aloud in the real reader: opens a small FB2
// book in <foliate-view> (chromium), enables TTS (mock service - selected
// via settings; headless chromium has no speech synthesis voices), plays,
// and exercises the controls. Audio really plays (autoplay is enabled in
// the test launcher).
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    // appSettings was loaded before localStorage was cleared - set the
    // provider directly
    appSettings.ttsProvider = "mock";
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

    // highlights are elements in the section overlayer's SVG
    const view = root.querySelector("foliate-view") as unknown as FoliateView;
    const highlightCount = () =>
      view.renderer
        .getContents()
        .reduce((n, c) => n + (c.overlayer?.element.childElementCount ?? 0), 0);
    const hasSelection = () =>
      view.renderer
        .getContents()
        .some((c) => (c.doc?.getSelection()?.toString().length ?? 0) > 0);
    await vi.waitFor(() => expect(highlightCount()).toBeGreaterThan(0), {
      timeout: 5000,
    });
    // page-follow must not leave a native text selection behind
    expect(hasSelection()).toBe(false);

    // pause returns the Play button, playback stays paused and the spoken
    // sentence stays highlighted
    button(root, "Pause").click();
    await vi.waitFor(() => button(root, "Play"), { timeout: 5000 });
    expect(highlightCount()).toBeGreaterThan(0);

    // resume + jump to next sentence keeps playing
    button(root, "Play").click();
    await vi.waitFor(() => button(root, "Pause"), { timeout: 15000 });
    button(root, "Next sentence").click();
    await vi.waitFor(() => button(root, "Pause"), { timeout: 15000 });

    // stop disarms playback and clears the highlight and any selection
    button(root, "Stop reading").click();
    await vi.waitFor(
      () => expect(button(root, "Play").disabled).toBe(false),
      { timeout: 5000 },
    );
    await vi.waitFor(() => expect(highlightCount()).toBe(0), { timeout: 5000 });
    expect(hasSelection()).toBe(false);

    // disable TTS: the control bar goes away
    button(root, "Read aloud").click();
    await vi.waitFor(() =>
      expect(root.querySelector('button[title="Play"]')).toBeNull(),
    );
  }, 90000);

  // renders the book, enables TTS, and returns the pieces needed to
  // simulate jump gestures on the text "A third one" of the first section
  async function setupForJump(storageKey: string) {
    const { container } = render(Reader, {
      file: bookFile(),
      storageKey,
      showBars: true,
    });
    const root = container as HTMLElement;
    await vi.waitFor(
      () => expect(button(root, "Read aloud").disabled).toBe(false),
      { timeout: 20000 },
    );
    await vi.waitFor(
      () => expect(localStorage.getItem(storageKey)).toBeTruthy(),
      { timeout: 10000 },
    );

    const view = root.querySelector("foliate-view") as unknown as FoliateView;
    const drawn: string[] = [];
    (view as unknown as HTMLElement).addEventListener(
      "draw-annotation",
      (e) => {
        drawn.push(
          (e as CustomEvent<{ annotation: { value: string } }>).detail
            .annotation.value,
        );
      },
    );

    button(root, "Read aloud").click();
    await vi.waitFor(() => expect(button(root, "Play").disabled).toBe(false), {
      timeout: 10000,
    });

    const { doc, index } = view.renderer.getContents()[0];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.includes("A third one")) {
        textNode = node as Text;
        break;
      }
    }
    if (!textNode) throw new Error('text "A third one" not rendered');
    const probe = doc.createRange();
    const offset = textNode.data.indexOf("A third one") + 2;
    probe.setStart(textNode, offset);
    probe.setEnd(textNode, offset + 1);
    const rect = probe.getBoundingClientRect();
    return {
      root,
      view,
      doc,
      index,
      drawn,
      target: textNode.parentElement!,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  // the highlight overlay CFI resolved back to the text it covers
  function highlightedText(
    view: FoliateView,
    doc: Document,
    drawn: string[],
  ): string {
    const cfi = drawn.at(-1);
    if (!cfi) return "";
    return String(view.resolveCFI(cfi).anchor(doc));
  }

  it("ctrl+click in TTS mode starts speaking from the clicked sentence", async () => {
    const { root, view, doc, drawn, target, x, y } =
      await setupForJump("mbs4.reading.test.2");

    target.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        clientX: x,
        clientY: y,
      }),
    );

    // playback started from the clicked (third) sentence, skipping the
    // first two - its highlight is the first one drawn
    await vi.waitFor(() => button(root, "Pause"), { timeout: 15000 });
    await vi.waitFor(
      () =>
        expect(highlightedText(view, doc, drawn)).toContain(
          "A third one ends the page.",
        ),
      { timeout: 10000 },
    );
    // the gesture did not toggle the header away
    expect(root.querySelector('button[title="Read aloud"]')).not.toBeNull();
  }, 90000);

  it("long press in TTS mode starts speaking from the pressed sentence", async () => {
    const { root, view, doc, drawn, target, x, y } =
      await setupForJump("mbs4.reading.test.3");

    const touch = new Touch({
      identifier: 1,
      target,
      clientX: x,
      clientY: y,
    });
    target.dispatchEvent(
      new TouchEvent("touchstart", { bubbles: true, touches: [touch] }),
    );
    // hold still past the long-press threshold, then release
    await new Promise((r) => setTimeout(r, 700));
    target.dispatchEvent(new TouchEvent("touchend", { bubbles: true }));

    await vi.waitFor(() => button(root, "Pause"), { timeout: 15000 });
    await vi.waitFor(
      () =>
        expect(highlightedText(view, doc, drawn)).toContain(
          "A third one ends the page.",
        ),
      { timeout: 10000 },
    );
    // foliate's paginator also saw the synthetic touch - let its async snap
    // finish before the component is torn down
    await new Promise((r) => setTimeout(r, 500));
  }, 90000);

  it("a quick tap in TTS mode keeps its default action (toggles the bars)", async () => {
    const { root, target, x, y } = await setupForJump("mbs4.reading.test.4");

    const touch = new Touch({
      identifier: 1,
      target,
      clientX: x,
      clientY: y,
    });
    target.dispatchEvent(
      new TouchEvent("touchstart", { bubbles: true, touches: [touch] }),
    );
    target.dispatchEvent(new TouchEvent("touchend", { bubbles: true }));
    // the browser-synthesized click after a short tap
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
    );

    // header toggled away, no playback started
    await vi.waitFor(() =>
      expect(root.querySelector('button[title="Read aloud"]')).toBeNull(),
    );
    expect(root.querySelector('button[title="Pause"]')).toBeNull();
    // foliate's paginator also saw the synthetic touch - let its async snap
    // finish before the component is torn down
    await new Promise((r) => setTimeout(r, 500));
  }, 90000);
});
