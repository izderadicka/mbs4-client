// The sidebar edge swipe in a real browser: needs actual Touch events, the
// mobile media query and the sheet the sidebar opens on small screens.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import SidebarSwipeStub from "$lib/components/test-stubs/sidebar-swipe.stub.svelte";

const MOBILE_VIEWPORT = { width: 400, height: 800 };

function touchAt(x: number, y: number): Touch {
  return new Touch({
    identifier: 1,
    target: document.body,
    clientX: x,
    clientY: y,
  });
}

// a full touch sequence on the page, from `fromX` through the given x positions
function swipe(fromX: number, ...toX: number[]): void {
  const y = 400;
  document.body.dispatchEvent(
    new TouchEvent("touchstart", {
      bubbles: true,
      touches: [touchAt(fromX, y)],
    }),
  );
  for (const x of toX) {
    document.body.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [touchAt(x, y)],
      }),
    );
  }
  const lastX = toX.at(-1) ?? fromX;
  document.body.dispatchEvent(
    new TouchEvent("touchend", {
      bubbles: true,
      changedTouches: [touchAt(lastX, y)],
    }),
  );
}

function sheet(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-mobile="true"]');
}

describe("sidebar edge swipe (browser)", () => {
  beforeEach(async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height);
  });

  async function openBySwipe() {
    render(SidebarSwipeStub);
    expect(sheet()).toBeNull();
    swipe(5, 60, 150);
    await vi.waitFor(() => expect(sheet()).not.toBeNull());
  }

  it("opens the sidebar on a swipe in from the left border", async () => {
    await openBySwipe();
    expect(sheet()?.textContent).toContain("Main menu");
  });

  it("closes it again on a swipe back to the left", async () => {
    await openBySwipe();
    swipe(300, 240, 150);
    await vi.waitFor(() =>
      expect(sheet()?.dataset.state ?? "gone").not.toBe("open"),
    );
  });

  it("ignores a swipe that starts away from the border", async () => {
    render(SidebarSwipeStub);
    swipe(200, 260, 340);
    await new Promise((r) => setTimeout(r, 100));
    expect(sheet()).toBeNull();
  });

  it("ignores the gesture on a wide (non-mobile) viewport", async () => {
    await page.viewport(1200, 800);
    render(SidebarSwipeStub);
    swipe(5, 60, 150);
    await new Promise((r) => setTimeout(r, 100));
    expect(sheet()).toBeNull();
  });
});
