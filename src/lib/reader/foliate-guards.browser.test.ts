// The paginator race guarded in foliate-guards.ts, against real foliate-js:
// renders requested while a section is still loading (as the paginator's
// ResizeObserver does on any resize) must not throw.
import { afterEach, describe, expect, it } from "vitest";
import type { FoliateView } from "foliate-js/view.js";
import {
  installPaginatorGuards,
  sectionDocumentReady,
  type ContentsSource,
} from "./foliate-guards";

const FB2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info><book-title>Guard Test</book-title><lang>en</lang></title-info>
  </description>
  <body>
    <section><p>First sentence. Second sentence.</p></section>
  </body>
</FictionBook>`;

let views: HTMLElement[] = [];

afterEach(() => {
  for (const v of views) {
    (v as unknown as FoliateView).close();
    v.remove();
  }
  views = [];
});

// Opens a book and keeps asking the paginator to render while the first
// section loads; returns the errors those renders threw and how many renders
// hit the race window (section document without a body).
async function renderWhileLoading(): Promise<{
  errors: unknown[];
  inWindow: number;
}> {
  await import("foliate-js/view.js");
  const view = document.createElement("foliate-view") as unknown as FoliateView;
  const el = view as unknown as HTMLElement;
  el.style.cssText = "display:block;width:400px;height:300px";
  document.body.append(el);
  views.push(el);
  await view.open(new File([FB2], "guard.fb2", { type: "application/xml" }));
  installPaginatorGuards(customElements.get("foliate-paginator"));

  const renderer = view.renderer as unknown as ContentsSource & {
    render(): void;
  };
  const errors: unknown[] = [];
  let inWindow = 0;
  let loaded = false;
  el.addEventListener("load", () => (loaded = true));
  const init = view.init({});
  // hammer render() on every task until the section has loaded
  while (!loaded) {
    if (!sectionDocumentReady(renderer)) inWindow++;
    try {
      renderer.render();
    } catch (e) {
      errors.push(e);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  await init;
  return { errors, inWindow };
}

// Without the guard, foliate-js throws "Cannot destructure property 'style'
// of 'el' as it is null" for every render in the race window - including
// those from the paginator's own ResizeObserver, which then surface as
// unhandled errors, so the unguarded case is not run here.
describe("paginator render guard (browser)", () => {
  it("skips renders of a loading section", async () => {
    const { errors, inWindow } = await renderWhileLoading();
    // the race window was hit...
    expect(inWindow).toBeGreaterThan(0);
    // ...without throwing
    expect(errors).toEqual([]);
    // and the loaded section still lays out normally
    const doc = view().renderer.getContents()[0]?.doc;
    expect(doc?.body?.textContent).toContain("First sentence.");
  });
});

function view(): FoliateView {
  return views[views.length - 1] as unknown as FoliateView;
}
