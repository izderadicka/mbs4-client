// Read-aloud orchestration for the reader: wires the sentence iterator, the
// TTS service, and the audio pipeline to the foliate view, and exposes
// reactive playback state for the UI.
//
// Highlighting uses foliate's CFI-valued annotations (SVG overlay drawn via
// the draw-annotation event); foliate does not persist annotations across
// section re-renders, so the current highlight is re-added on the
// create-overlay event. Controller-initiated navigation (page follow) is
// distinguished from user navigation with a self-nav counter plus the
// renderer-level relocate reason ("anchor" = layout re-anchoring,
// "selection" = our own scrollToAnchor).

import { Overlayer } from "foliate-js/overlayer.js";
import type {
  Annotation,
  CreateOverlayDetail,
  DrawAnnotationDetail,
  FoliateView,
  RendererRelocateDetail,
} from "foliate-js/view.js";
import { toast } from "svelte-sonner";
import type { PipelineEvent, SpeechPipeline } from "./pipeline";
import { SentenceSource, type SentenceRef } from "./sentences";
import { setTtsRate, setTtsVoice, ttsPrefs, type TtsRate } from "./tts-prefs.svelte";
import { createTtsService, type TtsService, type Voice } from "./tts-service";

export type TtsStatus =
  | "off"
  | "idle"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error";

export type ColorScheme = "light" | "dark";

// Highlight rects are drawn at a fixed group opacity (foliate's Overlayer:
// var(--overlayer-highlight-opacity, .3)), so on a dark page the light-theme
// colour ends up too faint. Dark uses a brighter blue and raises that opacity
// variable (colour alpha alone caps the effective value at ~0.3).
export function highlightStyle(scheme: ColorScheme): {
  color: string;
  opacity: string | null;
} {
  return scheme === "dark"
    ? { color: "rgb(96, 165, 250)", opacity: "0.55" }
    : { color: "rgba(59, 130, 246, 0.6)", opacity: null };
}

const HIGHLIGHT_OPACITY_VAR = "--overlayer-highlight-opacity";
const SELF_NAV_TIMEOUT_MS = 2000;

export class TtsController {
  status: TtsStatus = $state("off");
  currentSentence: SentenceRef | null = $state(null);
  voices: Voice[] = $state([]);
  // selected Voice.id
  voice: string | null = $state(null);
  rate: TtsRate = $state(1);
  errorMessage: string | null = $state(null);
  // current reader colour scheme; drives the highlight colour/opacity
  scheme: ColorScheme = $state("light");

  #getView: () => FoliateView | null;
  #service: TtsService | null = null;
  #source: SentenceSource | null = null;
  #pipeline: SpeechPipeline | null = null;
  #highlighted: string | null = null;
  // Annotation add/delete calls are async (foliate resolves the CFI first)
  // and must run strictly in order: a stop right after a sentence started
  // would otherwise delete the highlight before its add has drawn it,
  // leaving an orphaned highlight on the page.
  #highlightChain: Promise<void> = Promise.resolve();
  #selfNav = 0;
  // last renderer position seen, used to detect a relocate that did not
  // actually move the reading position (a stationary tap/long-press ends with
  // foliate's snap() re-emitting a relocate at the same page). The -1/NaN
  // sentinels never equal a real position, so the first relocate always counts
  // as a change.
  #lastIndex = -1;
  #lastFraction = Number.NaN;
  #disposed = false;
  // bumped whenever playback intent changes (stop, new play, navigation) so
  // still-awaiting async operations from an older intent abort instead of
  // restarting the pipeline after the user stopped it
  #op = 0;

  #onDrawAnnotation = (event: Event) => {
    const { draw } = (event as CustomEvent<DrawAnnotationDetail>).detail;
    draw(Overlayer.highlight, { color: highlightStyle(this.scheme).color });
  };

  #onCreateOverlay = (event: Event) => {
    // a section's overlay layer was (re)created (e.g. after a font-size
    // change) - re-add the highlight if it belongs to that section
    const { index } = (event as CustomEvent<CreateOverlayDetail>).detail;
    this.#applyOverlayVars();
    if (this.#highlighted && this.currentSentence?.sectionIndex === index) {
      this.#highlightChain = this.#highlightChain.then(async () => {
        if (!this.#highlighted) return; // removed meanwhile
        await this.#view
          ?.addAnnotation({ value: this.#highlighted })
          .catch(() => {});
      });
    }
  };

  // push the per-scheme highlight opacity onto each section's overlay SVG;
  // the highlight <g> reads it via var(--overlayer-highlight-opacity)
  #applyOverlayVars(): void {
    const { opacity } = highlightStyle(this.scheme);
    const contents = this.#view?.renderer.getContents() ?? [];
    for (const c of contents) {
      const el = c.overlayer?.element;
      if (!el) continue;
      if (opacity === null) el.style.removeProperty(HIGHLIGHT_OPACITY_VAR);
      else el.style.setProperty(HIGHLIGHT_OPACITY_VAR, opacity);
    }
  }

  #onRendererRelocate = (event: Event) => {
    const detail = (event as CustomEvent<RendererRelocateDetail>).detail;
    if (this.status === "off") return;
    // Did the reading position actually move? A tap or long-press ends with
    // foliate's snap(), which re-emits a relocate at the *same* page (reason
    // "snap"); that must not restart speech. Record the new position
    // unconditionally so follow-scrolls, cross-section goTo and re-anchors
    // keep the reference current for the next comparison.
    const unchanged =
      detail.index === this.#lastIndex &&
      Math.abs(detail.fraction - this.#lastFraction) < 1e-6;
    this.#lastIndex = detail.index;
    this.#lastFraction = detail.fraction;
    // our own page-follow scrollToAnchor(select=true) relocates with reason
    // "selection", which also makes foliate select the sentence text - drop
    // that native selection (we show our own overlay highlight instead)
    if (detail.reason === "selection") {
      this.#clearNativeSelection();
      return;
    }
    // layout re-anchoring (resize etc.) is not user navigation
    if (detail.reason === "anchor") return;
    // "navigation" is ambiguous: TOC/slider (user) or our own cross-section
    // goTo - the self-nav counter marks the latter
    if (detail.reason === "navigation" && this.#selfNav > 0) {
      this.#selfNav--;
      return;
    }
    // a tap/long-press that snapped back to the current page is not navigation
    if (unchanged) return;
    this.#onUserNavigation(detail);
  };

  constructor(getView: () => FoliateView | null) {
    this.#getView = getView;
  }

  get #view(): FoliateView | null {
    return this.#getView();
  }

  async enable(): Promise<void> {
    const view = this.#view;
    if (!view || this.status !== "off") return;
    this.errorMessage = null;
    // a fresh session must not compare against a position from a previous one
    this.#lastIndex = -1;
    this.#lastFraction = Number.NaN;
    this.#service = await createTtsService();
    this.#source = new SentenceSource(view);
    this.#pipeline = this.#service.createPipeline((e) =>
      this.#onPipelineEvent(e),
    );
    view.addEventListener("draw-annotation", this.#onDrawAnnotation);
    view.addEventListener("create-overlay", this.#onCreateOverlay);
    view.renderer.addEventListener("relocate", this.#onRendererRelocate);
    this.rate = ttsPrefs.rate;
    this.#pipeline.setRate(this.rate);
    this.status = "idle";
    try {
      this.voices = await this.#service.listVoices(this.#bookLanguage());
    } catch (e) {
      console.error("Failed to list TTS voices", e);
      this.voices = [];
      toast.error("Could not load voices from the speech service");
    }
    this.voice = this.#pickVoice();
  }

  async disable(): Promise<void> {
    if (this.status === "off") return;
    this.#pipeline?.stop();
    this.#removeHighlight();
    this.#clearNativeSelection();
    const view = this.#view;
    if (view) {
      view.removeEventListener("draw-annotation", this.#onDrawAnnotation);
      view.removeEventListener("create-overlay", this.#onCreateOverlay);
      view.renderer?.removeEventListener("relocate", this.#onRendererRelocate);
    }
    await this.#pipeline?.destroy();
    this.#source?.dispose();
    this.#service = null;
    this.#source = null;
    this.#pipeline = null;
    this.currentSentence = null;
    this.status = "off";
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await this.disable();
  }

  #bookLanguage(): string | undefined {
    const bookLang = this.#view?.book.metadata?.language;
    return Array.isArray(bookLang) ? bookLang[0] : bookLang;
  }

  // preferred voice (Voice.id): persisted pref if available in the
  // (language-filtered) list, else the first one
  #pickVoice(): string | null {
    if (this.voices.length === 0) return null;
    if (ttsPrefs.voice && this.voices.some((v) => v.id === ttsPrefs.voice)) {
      return ttsPrefs.voice;
    }
    return this.voices[0].id;
  }

  // start speaking at the given position (or resume when paused)
  async play(): Promise<void> {
    if (this.status === "off") return;
    if (this.status === "paused") {
      await this.#pipeline?.resume();
      this.status = this.#pipeline?.active ? "playing" : "idle";
      return;
    }
    // after an error, retry from the sentence that failed
    const from =
      this.status === "error" && this.currentSentence
        ? this.currentSentence.cfi
        : this.#currentLocation();
    await this.playFrom(from);
  }

  async playFrom(cfi: string | null): Promise<void> {
    if (!this.#pipeline || !this.#source) return;
    const op = ++this.#op;
    this.errorMessage = null;
    const cursor = await this.#source.sentenceAt(cfi ?? "");
    if (op !== this.#op) return; // superseded by stop/another play
    if (!cursor) {
      this.status = "idle";
      toast.info("No readable text at this location");
      return;
    }
    await this.#pipeline.start(cursor, this.voice ?? undefined);
  }

  pause(): void {
    if (this.status !== "playing" && this.status !== "buffering") return;
    void this.#pipeline?.pause();
    this.status = "paused";
  }

  stop(): void {
    if (this.status === "off") return;
    this.#op++;
    this.#pipeline?.stop();
    this.#removeHighlight();
    this.#clearNativeSelection();
    this.currentSentence = null;
    this.status = "idle";
  }

  // jump speech to an arbitrary position (sentence containing the CFI),
  // e.g. from a ctrl+click / long press on the book page
  async jumpTo(cfi: string): Promise<void> {
    if (this.status === "off") return;
    this.#pipeline?.stop();
    await this.playFrom(cfi);
  }

  async nextSentence(): Promise<void> {
    await this.#jump(1);
  }

  async prevSentence(): Promise<void> {
    await this.#jump(-1);
  }

  async #jump(dir: 1 | -1): Promise<void> {
    if (!this.#pipeline || !this.#source) return;
    const op = ++this.#op;
    const from = this.currentSentence?.cfi ?? this.#currentLocation();
    if (!from) return;
    const cursor = await this.#source.sentenceAt(from);
    if (!cursor) return;
    const target = dir === 1 ? await cursor.next() : await cursor.prev();
    if (!target || op !== this.#op) return;
    this.#pipeline.stop();
    await this.playFrom(target.cfi);
  }

  setVoice(id: string): void {
    this.voice = id;
    setTtsVoice(id);
    if (this.#pipeline?.active) {
      // re-synthesize from the current sentence with the new voice
      const current = this.#pipeline.currentSentence;
      this.#pipeline.stop();
      void this.playFrom(current?.cfi ?? this.#currentLocation());
    }
  }

  setRate(rate: TtsRate): void {
    this.rate = rate;
    setTtsRate(rate);
    this.#pipeline?.setRate(rate);
  }

  // follow the reader's light/dark theme; recolours a live highlight
  setScheme(scheme: ColorScheme): void {
    if (scheme === this.scheme) return;
    this.scheme = scheme;
    this.#applyOverlayVars();
    this.#refreshHighlight();
  }

  // redraw the current highlight so #onDrawAnnotation re-runs with the new
  // scheme's colour (delete + add through the ordered chain)
  #refreshHighlight(): void {
    const cfi = this.#highlighted;
    if (!cfi) return;
    this.#highlightChain = this.#highlightChain.then(async () => {
      const view = this.#view;
      if (!view || this.#highlighted !== cfi) return;
      await view.deleteAnnotation({ value: cfi }).catch(() => {});
      await view.addAnnotation({ value: cfi }).catch(() => {});
      this.#applyOverlayVars();
    });
  }

  #currentLocation(): string | null {
    const view = this.#view;
    if (!view) return null;
    const loc = (view as unknown as { lastLocation?: { cfi?: string } })
      .lastLocation;
    return loc?.cfi ?? null;
  }

  #onPipelineEvent(e: PipelineEvent): void {
    switch (e.type) {
      case "sentence-started":
        this.currentSentence = e.sentence;
        this.status = "playing";
        this.#moveHighlight(e.sentence);
        this.#followSentence(e.sentence);
        break;
      case "sentence-ended":
        break;
      case "buffering":
        if (this.status !== "paused") this.status = "buffering";
        break;
      case "playing":
        if (this.status !== "paused") this.status = "playing";
        break;
      case "ended":
        this.#removeHighlight();
        this.status = "ended";
        break;
      case "error":
        console.error("TTS pipeline error", e.error);
        this.errorMessage =
          e.error instanceof Error ? e.error.message : "Speech service failed";
        this.status = "error";
        toast.error(`Read aloud stopped: ${this.errorMessage}`);
        break;
    }
  }

  // drop any native text selection foliate created in the section documents
  // (page-follow selects the sentence - we show our overlay highlight instead)
  #clearNativeSelection(): void {
    const contents = this.#view?.renderer.getContents() ?? [];
    for (const c of contents) {
      c.doc?.getSelection()?.removeAllRanges();
    }
  }

  #moveHighlight(sentence: SentenceRef): void {
    this.#setHighlight(sentence.cfi);
  }

  #removeHighlight(): void {
    this.#setHighlight(null);
  }

  #setHighlight(cfi: string | null): void {
    const prev = this.#highlighted;
    if (prev === cfi) return;
    this.#highlighted = cfi;
    this.#highlightChain = this.#highlightChain.then(async () => {
      const view = this.#view;
      if (!view) return;
      if (prev) {
        const annotation: Annotation = { value: prev };
        await view.deleteAnnotation(annotation).catch(() => {});
      }
      if (cfi) {
        await view.addAnnotation({ value: cfi }).catch((e) => {
          console.error("Failed to highlight sentence", e);
        });
        this.#applyOverlayVars();
      }
    });
  }

  // keep the spoken sentence visible: scroll within the rendered section or
  // navigate to it when it is off-screen / in another section
  #followSentence(sentence: SentenceRef): void {
    const view = this.#view;
    if (!view) return;
    try {
      const contents = view.renderer.getContents();
      const rendered = contents.find((c) => c.index === sentence.sectionIndex);
      if (rendered) {
        // select=true tags the relocate reason "selection" so it is not
        // treated as user navigation (no self-nav counter needed); the
        // native selection foliate makes is dropped in #onRendererRelocate
        const resolved = view.resolveCFI(sentence.cfi);
        const anchor = resolved.anchor(rendered.doc);
        view.renderer.scrollToAnchor(anchor, true);
      } else {
        // cross-section: goTo relocates with the ambiguous reason
        // "navigation" - mark it as ours
        this.#beginSelfNav();
        void view.goTo(sentence.cfi).catch((e) => {
          console.error("TTS navigation failed", e);
        });
      }
    } catch (e) {
      console.error("Failed to follow spoken sentence", e);
    }
  }

  #beginSelfNav(): void {
    this.#selfNav++;
    // navigations that do not produce a relocate (target already in view)
    // must not leave the counter stuck
    setTimeout(() => {
      if (this.#selfNav > 0) this.#selfNav--;
    }, SELF_NAV_TIMEOUT_MS);
  }

  #onUserNavigation(detail: RendererRelocateDetail): void {
    const wasActive = this.status === "playing" || this.status === "buffering";
    if (
      this.status === "idle" ||
      this.status === "off" ||
      this.status === "ended"
    ) {
      return;
    }
    this.#pipeline?.stop();
    this.#removeHighlight();
    if (wasActive) {
      // restart speech from the new location
      const view = this.#view;
      let cfi: string | null = null;
      if (view && detail.range) {
        try {
          cfi = view.getCFI(detail.index, detail.range);
        } catch {
          cfi = null;
        }
      }
      void this.playFrom(cfi ?? this.#currentLocation());
    } else {
      // paused/error: forget the interrupted position, next play starts
      // from the new location
      this.#op++;
      this.currentSentence = null;
      this.status = "idle";
    }
  }
}
