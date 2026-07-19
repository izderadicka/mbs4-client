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

const HIGHLIGHT_COLOR = "rgba(59, 130, 246, 0.4)";
const SELF_NAV_TIMEOUT_MS = 2000;

export class TtsController {
  status: TtsStatus = $state("off");
  currentSentence: SentenceRef | null = $state(null);
  voices: Voice[] = $state([]);
  // selected Voice.id
  voice: string | null = $state(null);
  rate: TtsRate = $state(1);
  errorMessage: string | null = $state(null);

  #getView: () => FoliateView | null;
  #service: TtsService | null = null;
  #source: SentenceSource | null = null;
  #pipeline: SpeechPipeline | null = null;
  #highlighted: string | null = null;
  #selfNav = 0;
  #disposed = false;
  // bumped whenever playback intent changes (stop, new play, navigation) so
  // still-awaiting async operations from an older intent abort instead of
  // restarting the pipeline after the user stopped it
  #op = 0;

  #onDrawAnnotation = (event: Event) => {
    const { draw } = (event as CustomEvent<DrawAnnotationDetail>).detail;
    draw(Overlayer.highlight, { color: HIGHLIGHT_COLOR });
  };

  #onCreateOverlay = (event: Event) => {
    // a section's overlay layer was (re)created (e.g. after a font-size
    // change) - re-add the highlight if it belongs to that section
    const { index } = (event as CustomEvent<CreateOverlayDetail>).detail;
    if (this.#highlighted && this.currentSentence?.sectionIndex === index) {
      void this.#view?.addAnnotation({ value: this.#highlighted });
    }
  };

  #onRendererRelocate = (event: Event) => {
    const detail = (event as CustomEvent<RendererRelocateDetail>).detail;
    if (this.status === "off") return;
    // layout re-anchoring (resize etc.) and our own scrollToAnchor calls
    // (select=true => reason "selection") are not user navigation
    if (detail.reason === "anchor" || detail.reason === "selection") return;
    // "navigation" is ambiguous: TOC/slider (user) or our own cross-section
    // goTo - the self-nav counter marks the latter
    if (detail.reason === "navigation" && this.#selfNav > 0) {
      this.#selfNav--;
      return;
    }
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

  #moveHighlight(sentence: SentenceRef): void {
    const view = this.#view;
    if (!view) return;
    this.#removeHighlight();
    this.#highlighted = sentence.cfi;
    void view.addAnnotation({ value: sentence.cfi }).catch((e) => {
      console.error("Failed to highlight sentence", e);
    });
  }

  #removeHighlight(): void {
    const view = this.#view;
    if (this.#highlighted && view) {
      const annotation: Annotation = { value: this.#highlighted };
      void view.deleteAnnotation(annotation).catch(() => {});
    }
    this.#highlighted = null;
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
        // relocates caused by this are reason "selection" - no counter needed
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
