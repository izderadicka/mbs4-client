// Touch gesture recognition helpers shared across components.
//
// LongPressRecognizer detects a touch held in place, e.g. to trigger an
// action on content where a plain tap already has a meaning. One instance
// owns the single pending press no matter how many targets it observes (a
// new touch cancels the previous pending press), so it can be attached to
// short-lived documents - like the reader's book iframes - without detach
// bookkeeping: listeners simply die with the document.

export interface LongPressPoint {
  // viewport coordinates within the observed target's document
  x: number;
  y: number;
}

export interface LongPressOptions<T> {
  // gesture is recognized only while this returns true (checked when the
  // touch starts and again when the press fires); otherwise all observed
  // events keep their default behavior
  enabled?: () => boolean;
  durationMs?: number;
  moveTolerancePx?: number;
  onLongPress: (point: LongPressPoint, context: T) => void;
}

const DEFAULT_DURATION_MS = 500;
const DEFAULT_MOVE_TOLERANCE_PX = 10;
// how long after a handled press the browser-synthesized click and context
// menu are still swallowed
const SUPPRESS_MS = 700;

export class LongPressRecognizer<T = void> {
  #options: LongPressOptions<T>;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #x = 0;
  #y = 0;
  #startNode: Node | null = null;
  #suppressUntil = 0;

  constructor(options: LongPressOptions<T>) {
    this.#options = options;
  }

  // attach listeners to a target (element or document); `context` is passed
  // back to onLongPress for presses that started on this target
  observe(target: EventTarget, context: T): void {
    target.addEventListener(
      "touchstart",
      (e) => this.#onTouchStart(e as TouchEvent, context),
      { passive: true },
    );
    target.addEventListener("touchmove", (e) => this.#onTouchMove(e as TouchEvent), {
      passive: true,
    });
    target.addEventListener("touchend", () => this.cancel());
    target.addEventListener("touchcancel", () => this.cancel());
    target.addEventListener("contextmenu", (e) => this.#onContextMenu(e));
    // capture phase, so a suppressed synthesized click never reaches the
    // consumer's own click handlers
    target.addEventListener("click", (e) => this.#onClick(e), true);
  }

  // drop a pending press (also for consumer teardown - observed targets
  // need no explicit detach, but a scheduled timer must not fire)
  cancel(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #enabled(): boolean {
    return this.#options.enabled?.() ?? true;
  }

  #onTouchStart(event: TouchEvent, context: T): void {
    this.cancel();
    if (!this.#enabled() || event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.#x = touch.clientX;
    this.#y = touch.clientY;
    this.#startNode = event.target instanceof Node ? event.target : null;
    this.#timer = setTimeout(
      () => this.#fire(context),
      this.#options.durationMs ?? DEFAULT_DURATION_MS,
    );
  }

  #onTouchMove(event: TouchEvent): void {
    if (this.#timer === null) return;
    const touch = event.touches[0];
    const tolerance = this.#options.moveTolerancePx ?? DEFAULT_MOVE_TOLERANCE_PX;
    if (
      !touch ||
      Math.hypot(touch.clientX - this.#x, touch.clientY - this.#y) > tolerance
    ) {
      this.cancel();
    }
  }

  #fire(context: T): void {
    this.#timer = null;
    if (!this.#enabled()) return;
    this.#suppressUntil = Date.now() + SUPPRESS_MS;
    // a long press also starts native text selection - drop it
    const node = this.#startNode;
    const doc = node instanceof Document ? node : (node?.ownerDocument ?? null);
    doc?.getSelection()?.removeAllRanges();
    this.#options.onLongPress({ x: this.#x, y: this.#y }, context);
  }

  // suppress the context menu of a pending or just-handled press; a plain
  // right-click (no press in flight) is unaffected
  #onContextMenu(event: Event): void {
    if (this.#timer !== null || Date.now() < this.#suppressUntil) {
      event.preventDefault();
    }
  }

  #onClick(event: Event): void {
    if (Date.now() < this.#suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
