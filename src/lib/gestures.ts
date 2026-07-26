// Touch gesture recognition helpers shared across components.
//
// LongPressRecognizer detects a touch held in place, e.g. to trigger an
// action on content where a plain tap already has a meaning. One instance
// owns the single pending press no matter how many targets it observes (a
// new touch cancels the previous pending press), so it can be attached to
// short-lived documents - like the reader's book iframes - without detach
// bookkeeping: listeners simply die with the document.
//
// HorizontalSwipeRecognizer detects a mostly horizontal drag, e.g. to pull an
// off-canvas panel in from the screen edge.

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
// how long after a fired press the native text selection keeps being cleared;
// Chrome finalizes its long-press word-selection shortly after the press, so a
// single clear is not enough
const SELECTION_SUPPRESS_MS = 300;

export class LongPressRecognizer<T = void> {
  #options: LongPressOptions<T>;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #x = 0;
  #y = 0;
  #startNode: Node | null = null;
  #suppressUntil = 0;
  // tears down the active selection-suppression window (removes the listener,
  // clears its timers, restores user-select); null when no window is active
  #endSelectionSuppression: (() => void) | null = null;

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
    // a long press also starts native text selection - drop it (and keep
    // dropping it briefly, since Chrome finalizes its word-selection after
    // this point)
    const node = this.#startNode;
    const doc = node instanceof Document ? node : (node?.ownerDocument ?? null);
    if (doc) this.#suppressSelection(doc);
    this.#options.onLongPress({ x: this.#x, y: this.#y }, context);
  }

  // Clear the native selection now and for a short window afterwards, and
  // block re-selection with user-select:none, then restore. Chrome re-selects
  // the word a moment after the press fires, so a single removeAllRanges() is
  // not enough. The caret APIs used by onLongPress ignore user-select, so the
  // tapped position still resolves.
  #suppressSelection(doc: Document): void {
    // supersede any window still running from an earlier press
    this.#endSelectionSuppression?.();
    const clear = () => doc.getSelection?.()?.removeAllRanges();
    const root = doc.documentElement as HTMLElement | null;
    const prevUserSelect = root?.style.userSelect ?? "";
    const prevWebkit =
      root?.style.getPropertyValue("-webkit-user-select") ?? "";
    if (root) {
      root.style.userSelect = "none";
      root.style.setProperty("-webkit-user-select", "none");
    }
    const onSelectionChange = () => clear();
    doc.addEventListener("selectionchange", onSelectionChange);
    clear();
    const settle = setTimeout(clear, 0);
    const end = () => {
      this.#endSelectionSuppression = null;
      clearTimeout(settle);
      clearTimeout(deadline);
      doc.removeEventListener("selectionchange", onSelectionChange);
      if (root) {
        if (prevUserSelect) root.style.userSelect = prevUserSelect;
        else root.style.removeProperty("user-select");
        if (prevWebkit) root.style.setProperty("-webkit-user-select", prevWebkit);
        else root.style.removeProperty("-webkit-user-select");
      }
      clear();
    };
    const deadline = setTimeout(end, SELECTION_SUPPRESS_MS);
    this.#endSelectionSuppression = end;
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

export interface SwipePoint {
  // viewport coordinates of the touch that started the gesture
  x: number;
  y: number;
}

export interface SwipeGesture {
  direction: "left" | "right";
  // where the gesture started, for consumers that care about the edge it came
  // from even though `claim` already vetted the starting point
  start: SwipePoint;
  // horizontal travel, always positive
  distancePx: number;
}

export interface HorizontalSwipeOptions {
  // gesture is recognized only while this returns true (checked when the touch
  // starts and again when it ends); otherwise touches are left alone entirely
  enabled?: () => boolean;

  // Called for every single-finger touch that starts while enabled: return
  // true for touches that could become a swipe the consumer wants (e.g. only
  // those starting near the screen edge). Unclaimed touches are ignored, so
  // the rest of the page - horizontally scrollable content included - keeps
  // behaving normally.
  claim: (start: SwipePoint) => boolean;

  // minimum horizontal travel of a recognized swipe
  thresholdPx?: number;
  // vertical drift may not exceed this fraction of the horizontal travel, so
  // a diagonal drag or a scroll that wanders sideways is not a swipe
  maxDriftRatio?: number;
  // a drag slower than this is a scroll or a text selection, not a swipe
  maxDurationMs?: number;

  onSwipe: (gesture: SwipeGesture) => void;
}

const DEFAULT_THRESHOLD_PX = 60;
const DEFAULT_MAX_DRIFT_RATIO = 0.7;
const DEFAULT_MAX_DURATION_MS = 1000;
// horizontal travel after which a claimed touch is treated as a drag and its
// default behavior is suppressed
const CLAIM_SLOP_PX = 10;

export class HorizontalSwipeRecognizer {
  #options: HorizontalSwipeOptions;
  #start: SwipePoint | null = null;
  #startedAt = 0;
  #last: SwipePoint = { x: 0, y: 0 };
  // set once a claimed touch turned out to be a horizontal drag; from then on
  // its default behavior stays suppressed for the rest of the sequence
  #dragging = false;
  // removes the touchmove listener of the claimed touch; null when none is
  // being tracked
  #detachMove: (() => void) | null = null;

  constructor(options: HorizontalSwipeOptions) {
    this.#options = options;
  }

  // Attach listeners to a target (typically `window`); returns a detach
  // function for consumer teardown.
  observe(target: EventTarget): () => void {
    const onStart = (e: Event) => this.#onTouchStart(e as TouchEvent, target);
    const onEnd = (e: Event) => this.#onTouchEnd(e as TouchEvent);
    const onCancel = () => this.cancel();
    target.addEventListener("touchstart", onStart, { passive: true });
    target.addEventListener("touchend", onEnd, { passive: true });
    target.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      target.removeEventListener("touchstart", onStart);
      target.removeEventListener("touchend", onEnd);
      target.removeEventListener("touchcancel", onCancel);
      this.cancel();
    };
  }

  // drop the touch being tracked, if any
  cancel(): void {
    this.#start = null;
    this.#dragging = false;
    this.#detachMove?.();
    this.#detachMove = null;
  }

  #enabled(): boolean {
    return this.#options.enabled?.() ?? true;
  }

  #onTouchStart(event: TouchEvent, target: EventTarget): void {
    this.cancel();
    if (!this.#enabled() || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const start = { x: touch.clientX, y: touch.clientY };
    if (!this.#options.claim(start)) return;
    this.#start = start;
    this.#last = { ...start };
    this.#startedAt = Date.now();
    // Follow this touch non-passively, so a drag that turns out horizontal can
    // preventDefault() and keep a competing scroll, text selection or native
    // drag out of the gesture. The listener lives only as long as the claimed
    // touch: a permanent blocking touchmove listener would take every scroll on
    // the page off the browser's fast path.
    const onMove = (e: Event) => this.#onTouchMove(e as TouchEvent);
    target.addEventListener("touchmove", onMove, { passive: false });
    this.#detachMove = () => target.removeEventListener("touchmove", onMove);
  }

  #onTouchMove(event: TouchEvent): void {
    const start = this.#start;
    if (!start) return;
    // a second finger means pinch/zoom, not a swipe
    if (event.touches.length !== 1) {
      this.cancel();
      return;
    }
    const touch = event.touches[0];
    this.#last = { x: touch.clientX, y: touch.clientY };
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (
      !this.#dragging &&
      Math.abs(dx) > CLAIM_SLOP_PX &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      this.#dragging = true;
    }
    if (this.#dragging && event.cancelable) event.preventDefault();
  }

  #onTouchEnd(event: TouchEvent): void {
    const start = this.#start;
    if (!start) return;
    this.cancel();
    // touchend carries the released touch in `changedTouches`; fall back to the
    // last moved position for synthesized events without it
    const touch = event.changedTouches?.[0];
    const end = touch ? { x: touch.clientX, y: touch.clientY } : this.#last;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const options = this.#options;
    if (
      Date.now() - this.#startedAt >
      (options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS)
    ) {
      return;
    }
    if (Math.abs(dx) < (options.thresholdPx ?? DEFAULT_THRESHOLD_PX)) return;
    const drift = options.maxDriftRatio ?? DEFAULT_MAX_DRIFT_RATIO;
    if (Math.abs(dy) > Math.abs(dx) * drift) return;
    if (!this.#enabled()) return;
    options.onSwipe({
      direction: dx > 0 ? "right" : "left",
      start,
      distancePx: Math.abs(dx),
    });
  }
}
