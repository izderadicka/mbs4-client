import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HorizontalSwipeRecognizer, LongPressRecognizer } from "./gestures";

// touch events fabricated for happy-dom, which has no Touch/TouchEvent
// constructors; the recognizers only read clientX/clientY of the touch lists
function touchEvent(
  type: string,
  touches: { x: number; y: number }[],
  changedTouches: { x: number; y: number }[] = [],
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = (points: { x: number; y: number }[]) =>
    points.map((t) => ({ clientX: t.x, clientY: t.y }));
  Object.defineProperty(event, "touches", { value: list(touches) });
  Object.defineProperty(event, "changedTouches", {
    value: list(changedTouches),
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

describe("HorizontalSwipeRecognizer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function setup(
    options: {
      enabled?: () => boolean;
      claim?: (start: { x: number; y: number }) => boolean;
    } = {},
  ) {
    const swiped: { direction: string; startX: number; distancePx: number }[] =
      [];
    const recognizer = new HorizontalSwipeRecognizer({
      claim: () => true,
      onSwipe: ({ direction, start, distancePx }) =>
        swiped.push({ direction, startX: start.x, distancePx }),
      ...options,
    });
    const target = document.createElement("div");
    document.body.append(target);
    const detach = recognizer.observe(target);
    return { recognizer, target, swiped, detach };
  }

  // dispatch a whole touch sequence: down at `from`, a move to each waypoint,
  // then up at the last one; returns the dispatched move events
  function drag(
    target: EventTarget,
    from: { x: number; y: number },
    ...waypoints: { x: number; y: number }[]
  ): Event[] {
    target.dispatchEvent(touchEvent("touchstart", [from]));
    const moves = waypoints.map((point) => {
      const event = touchEvent("touchmove", [point]);
      target.dispatchEvent(event);
      return event;
    });
    const last = waypoints.at(-1) ?? from;
    target.dispatchEvent(touchEvent("touchend", [], [last]));
    return moves;
  }

  it("recognizes a swipe to the right with its start and distance", () => {
    const { target, swiped } = setup();
    drag(target, { x: 5, y: 100 }, { x: 40, y: 104 }, { x: 90, y: 110 });
    expect(swiped).toEqual([{ direction: "right", startX: 5, distancePx: 85 }]);
  });

  it("recognizes a swipe to the left", () => {
    const { target, swiped } = setup();
    drag(target, { x: 200, y: 100 }, { x: 120, y: 100 });
    expect(swiped).toEqual([
      { direction: "left", startX: 200, distancePx: 80 },
    ]);
  });

  it("ignores a drag shorter than the threshold", () => {
    const { target, swiped } = setup();
    drag(target, { x: 5, y: 100 }, { x: 50, y: 100 });
    expect(swiped).toEqual([]);
  });

  it("ignores a mostly vertical drag", () => {
    const { target, swiped } = setup();
    drag(target, { x: 5, y: 100 }, { x: 70, y: 220 });
    expect(swiped).toEqual([]);
  });

  it("ignores a drag that took too long", () => {
    vi.useFakeTimers();
    try {
      const { target, swiped } = setup();
      target.dispatchEvent(touchEvent("touchstart", [{ x: 5, y: 100 }]));
      vi.advanceTimersByTime(1001);
      target.dispatchEvent(touchEvent("touchend", [], [{ x: 100, y: 100 }]));
      expect(swiped).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores touches that are not claimed", () => {
    const { target, swiped } = setup({ claim: (start) => start.x <= 32 });
    // starts outside the claimed zone: not recognized and not interfered with
    const moves = drag(target, { x: 200, y: 100 }, { x: 300, y: 100 });
    expect(swiped).toEqual([]);
    expect(moves.some((e) => e.defaultPrevented)).toBe(false);

    drag(target, { x: 10, y: 100 }, { x: 110, y: 100 });
    expect(swiped.length).toBe(1);
  });

  it("does nothing while disabled", () => {
    const { target, swiped } = setup({ enabled: () => false });
    const moves = drag(target, { x: 5, y: 100 }, { x: 100, y: 100 });
    expect(swiped).toEqual([]);
    expect(moves[0].defaultPrevented).toBe(false);
  });

  it("drops the gesture when a second finger joins", () => {
    const { target, swiped } = setup();
    target.dispatchEvent(touchEvent("touchstart", [{ x: 5, y: 100 }]));
    target.dispatchEvent(
      touchEvent("touchmove", [
        { x: 40, y: 100 },
        { x: 200, y: 300 },
      ]),
    );
    target.dispatchEvent(touchEvent("touchend", [], [{ x: 100, y: 100 }]));
    expect(swiped).toEqual([]);
  });

  it("drops the gesture on touchcancel", () => {
    const { target, swiped } = setup();
    target.dispatchEvent(touchEvent("touchstart", [{ x: 5, y: 100 }]));
    target.dispatchEvent(touchEvent("touchcancel", []));
    target.dispatchEvent(touchEvent("touchend", [], [{ x: 100, y: 100 }]));
    expect(swiped).toEqual([]);
  });

  it("suppresses the default of a horizontal drag, but keeps scrolling free", () => {
    const { target } = setup();

    // vertical movement stays untouched, so the page keeps scrolling
    const vertical = drag(target, { x: 5, y: 100 }, { x: 8, y: 200 });
    expect(vertical.map((e) => e.defaultPrevented)).toEqual([false]);

    // horizontal movement beyond the slop is ours: the browser's own edge
    // gesture must not run alongside it
    const horizontal = drag(
      target,
      { x: 5, y: 100 },
      { x: 10, y: 100 },
      { x: 40, y: 100 },
      { x: 90, y: 140 },
    );
    expect(horizontal.map((e) => e.defaultPrevented)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("stops recognizing once detached", () => {
    const { target, swiped, detach } = setup();
    detach();
    drag(target, { x: 5, y: 100 }, { x: 100, y: 100 });
    expect(swiped).toEqual([]);
  });
});
