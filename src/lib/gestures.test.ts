import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LongPressRecognizer } from "./gestures";

// touch events fabricated for happy-dom, which has no Touch/TouchEvent
// constructors; the recognizer only reads touches[i].clientX/clientY
function touchEvent(type: string, touches: { x: number; y: number }[]): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "touches", {
    value: touches.map((t) => ({ clientX: t.x, clientY: t.y })),
  });
  return event;
}

describe("LongPressRecognizer", () => {
  beforeEach(() => {
    // also mocks Date.now, which the suppression window relies on
    vi.useFakeTimers();
  });
  afterEach(() => {
    // Let any open selection-suppression window run to completion so its
    // document-level selectionchange listener is removed and user-select is
    // restored; otherwise fake-timer teardown drops the pending restore and
    // leaks the listener onto the shared document across tests.
    vi.runAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("user-select");
    document.documentElement.style.removeProperty("-webkit-user-select");
  });

  // override document.getSelection (happy-dom's may be a no-op) with a spy;
  // returns a restore fn
  function stubSelection(): { removeAllRanges: ReturnType<typeof vi.fn> } {
    const removeAllRanges = vi.fn();
    (document as unknown as { getSelection: () => Selection }).getSelection =
      () => ({ removeAllRanges }) as unknown as Selection;
    return { removeAllRanges };
  }

  function setup(enabled: () => boolean = () => true) {
    const fired: { x: number; y: number; context: string }[] = [];
    const recognizer = new LongPressRecognizer<string>({
      enabled,
      onLongPress: (point, context) => fired.push({ ...point, context }),
    });
    const target = document.createElement("div");
    document.body.append(target);
    recognizer.observe(target, "first");
    return { recognizer, target, fired };
  }

  it("fires after the duration with the press coordinates and context", () => {
    const { target, fired } = setup();
    target.dispatchEvent(touchEvent("touchstart", [{ x: 5, y: 7 }]));
    vi.advanceTimersByTime(499);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([{ x: 5, y: 7, context: "first" }]);
  });

  it("tolerates small movement but cancels on a drag", () => {
    const { target, fired } = setup();
    target.dispatchEvent(touchEvent("touchstart", [{ x: 10, y: 10 }]));
    target.dispatchEvent(touchEvent("touchmove", [{ x: 13, y: 10 }]));
    vi.advanceTimersByTime(500);
    expect(fired.length).toBe(1);

    target.dispatchEvent(touchEvent("touchstart", [{ x: 10, y: 10 }]));
    target.dispatchEvent(touchEvent("touchmove", [{ x: 30, y: 10 }]));
    vi.advanceTimersByTime(500);
    expect(fired.length).toBe(1);
  });

  it("cancels on touchend and on a second finger", () => {
    const { target, fired } = setup();
    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    target.dispatchEvent(touchEvent("touchend", []));
    vi.advanceTimersByTime(500);
    expect(fired).toEqual([]);

    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    target.dispatchEvent(
      touchEvent("touchstart", [
        { x: 1, y: 1 },
        { x: 9, y: 9 },
      ]),
    );
    vi.advanceTimersByTime(500);
    expect(fired).toEqual([]);
  });

  it("a press on a second observed target cancels the pending one", () => {
    const { recognizer, target, fired } = setup();
    const other = document.createElement("div");
    document.body.append(other);
    recognizer.observe(other, "second");

    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    vi.advanceTimersByTime(300);
    other.dispatchEvent(touchEvent("touchstart", [{ x: 2, y: 2 }]));
    vi.advanceTimersByTime(500);
    expect(fired).toEqual([{ x: 2, y: 2, context: "second" }]);
  });

  it("does nothing while disabled", () => {
    const { target, fired } = setup(() => false);
    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    vi.advanceTimersByTime(500);
    expect(fired).toEqual([]);
    const menu = new Event("contextmenu", { cancelable: true });
    target.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
  });

  it("keeps clearing the selection during the window, then restores user-select", () => {
    const { removeAllRanges } = stubSelection();
    const { target } = setup();
    const root = document.documentElement;

    target.dispatchEvent(touchEvent("touchstart", [{ x: 5, y: 7 }]));
    vi.advanceTimersByTime(500); // fire
    expect(removeAllRanges).toHaveBeenCalled();
    expect(root.style.userSelect).toBe("none");

    // Chrome re-selects the word a moment later: selectionchange re-clears it
    removeAllRanges.mockClear();
    document.dispatchEvent(new Event("selectionchange"));
    expect(removeAllRanges).toHaveBeenCalled();

    // after the 300ms window: user-select restored, listener detached
    vi.advanceTimersByTime(300);
    expect(root.style.userSelect).toBe("");
    removeAllRanges.mockClear();
    document.dispatchEvent(new Event("selectionchange"));
    expect(removeAllRanges).not.toHaveBeenCalled();
  });

  it("does not clear the selection or set user-select while disabled", () => {
    const { removeAllRanges } = stubSelection();
    const { target } = setup(() => false);
    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    vi.advanceTimersByTime(500);
    expect(removeAllRanges).not.toHaveBeenCalled();
    expect(document.documentElement.style.userSelect).toBe("");
  });

  it("swallows the synthesized click after a handled press, but not later ones", () => {
    const { target, fired } = setup();
    const child = document.createElement("span");
    target.append(child);
    const consumerClicks: Event[] = [];
    target.addEventListener("click", (e) => consumerClicks.push(e));

    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    vi.advanceTimersByTime(500);
    expect(fired.length).toBe(1);

    const suppressed = new Event("click", { bubbles: true, cancelable: true });
    child.dispatchEvent(suppressed);
    expect(suppressed.defaultPrevented).toBe(true);
    expect(consumerClicks.length).toBe(0);

    vi.advanceTimersByTime(700);
    const passed = new Event("click", { bubbles: true, cancelable: true });
    child.dispatchEvent(passed);
    expect(passed.defaultPrevented).toBe(false);
    expect(consumerClicks.length).toBe(1);
  });

  it("suppresses the context menu of a pending or just-handled press only", () => {
    const { target } = setup();
    // plain right-click, no press in flight
    const plain = new Event("contextmenu", { cancelable: true });
    target.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);

    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    const pending = new Event("contextmenu", { cancelable: true });
    target.dispatchEvent(pending);
    expect(pending.defaultPrevented).toBe(true);

    vi.advanceTimersByTime(500);
    const justFired = new Event("contextmenu", { cancelable: true });
    target.dispatchEvent(justFired);
    expect(justFired.defaultPrevented).toBe(true);

    vi.advanceTimersByTime(700);
    const later = new Event("contextmenu", { cancelable: true });
    target.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it("cancel() drops a pending press", () => {
    const { recognizer, target, fired } = setup();
    target.dispatchEvent(touchEvent("touchstart", [{ x: 1, y: 1 }]));
    recognizer.cancel();
    vi.advanceTimersByTime(500);
    expect(fired).toEqual([]);
  });
});
