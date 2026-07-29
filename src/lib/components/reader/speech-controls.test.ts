import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import SpeechControls from "./speech-controls.svelte";
import type {
  TtsController,
  TtsStatus,
} from "$lib/reader/tts/controller.svelte";

// The bar only reads reactive fields off the controller and calls its
// methods - a plain stub is enough to check the enabled/disabled matrix.
function stubController(status: TtsStatus) {
  return {
    status,
    currentSentence: null,
    voices: [{ id: "v1", name: "Voice One", lang: "cs" }],
    voice: "v1",
    rate: 1,
    errorMessage: null,
    scheme: "light",
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    nextSentence: vi.fn(),
    prevSentence: vi.fn(),
    setVoice: vi.fn(),
    setRate: vi.fn(),
  };
}

function renderBar(status: TtsStatus) {
  const controller = stubController(status);
  const onClose = vi.fn();
  render(SpeechControls, {
    controller: controller as unknown as TtsController,
    onClose,
  });
  const control = (title: string) =>
    screen.getByTitle(title) as HTMLButtonElement;
  return { controller, onClose, control };
}

describe("speech controls", () => {
  it("disables every control except stop while buffering", () => {
    const { control } = renderBar("buffering");
    expect(control("Previous sentence").disabled).toBe(true);
    expect(control("Pause").disabled).toBe(true);
    expect(control("Next sentence").disabled).toBe(true);
    expect(control("Voice").disabled).toBe(true);
    expect(control("Speech rate").disabled).toBe(true);
    // stop cancels the buffering, so it stays available - and so does the
    // close button, which leaves read-aloud mode altogether
    expect(control("Stop reading").disabled).toBe(false);
    expect(control("Close read aloud").disabled).toBe(false);
  });

  it("stop while buffering cancels it", async () => {
    const { controller, control } = renderBar("buffering");
    await fireEvent.click(control("Stop reading"));
    expect(controller.stop).toHaveBeenCalled();
  });

  it("keeps the controls usable while playing", () => {
    const { control } = renderBar("playing");
    expect(control("Previous sentence").disabled).toBe(false);
    expect(control("Pause").disabled).toBe(false);
    expect(control("Next sentence").disabled).toBe(false);
    expect(control("Stop reading").disabled).toBe(false);
    expect(control("Voice").disabled).toBe(false);
    expect(control("Speech rate").disabled).toBe(false);
  });

  it("only offers play and voice settings when idle", () => {
    const { control } = renderBar("idle");
    expect(control("Play").disabled).toBe(false);
    expect(control("Stop reading").disabled).toBe(true);
    expect(control("Voice").disabled).toBe(false);
    expect(control("Speech rate").disabled).toBe(false);
  });
});
