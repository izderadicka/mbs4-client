import { describe, expect, it } from "vitest";
import { MockTtsService, encodeWavPcm16 } from "./mock-tts-service";
import { TtsServiceError } from "./tts-service";

function ascii(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

describe("encodeWavPcm16", () => {
  it("produces a valid RIFF/WAVE header and clamps samples", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 2, -2]);
    const buf = encodeWavPcm16(samples, 22050);
    const view = new DataView(buf);
    expect(buf.byteLength).toBe(44 + samples.length * 2);
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(50, true)).toBe(0x7fff); // clamped +2
    expect(view.getInt16(52, true)).toBe(-0x8000); // clamped -2
  });
});

describe("MockTtsService", () => {
  it("lists voices", async () => {
    const svc = new MockTtsService({ latencyMs: 0 });
    const voices = await svc.listVoices();
    expect(voices.length).toBeGreaterThan(1);
    expect(voices[0].name).toBeTruthy();
  });

  it("returns the same voices for any language, tagged with it", async () => {
    const svc = new MockTtsService({ latencyMs: 0 });
    const all = await svc.listVoices();
    const czech = await svc.listVoices("cs");
    expect(czech.map((v) => v.name)).toEqual(all.map((v) => v.name));
    expect(czech.every((v) => v.lang === "cs")).toBe(true);
    expect((await svc.listVoices("fr")).every((v) => v.lang === "fr")).toBe(true);
    // without a language the voices keep their own tags
    expect(new Set(all.map((v) => v.lang)).size).toBeGreaterThan(1);
  });

  it("synthesizes WAV with duration proportional to text length", async () => {
    const svc = new MockTtsService({ latencyMs: 0 });
    const short = await svc.synthesize({ text: "Hi there." });
    const long = await svc.synthesize({
      text: "This is a much longer sentence with many more words in it than the short one.",
    });
    expect(short.mimeType).toBe("audio/wav");
    expect(long.data.byteLength).toBeGreaterThan(short.data.byteLength);
    expect(ascii(new DataView(short.data), 0, 4)).toBe("RIFF");
  });

  it("is deterministic for the same voice and text", async () => {
    const svc = new MockTtsService({ latencyMs: 0 });
    const a = await svc.synthesize({ text: "Same text.", voice: "Mock Low" });
    const b = await svc.synthesize({ text: "Same text.", voice: "Mock Low" });
    expect(new Uint8Array(a.data)).toEqual(new Uint8Array(b.data));
  });

  it("fails every Nth call with a retryable TtsServiceError", async () => {
    const svc = new MockTtsService({ latencyMs: 0, failEveryNth: 2 });
    await svc.synthesize({ text: "one" });
    const err = await svc.synthesize({ text: "two" }).catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
    expect(err.retryable).toBe(true);
    await expect(svc.synthesize({ text: "three" })).resolves.toBeTruthy();
  });

  it("rejects with AbortError (not TtsServiceError) when aborted", async () => {
    const svc = new MockTtsService({ latencyMs: 1000 });
    const ac = new AbortController();
    const promise = svc.synthesize({ text: "never finishes" }, ac.signal);
    ac.abort();
    const err = await promise.catch((e) => e);
    expect(err).not.toBeInstanceOf(TtsServiceError);
    expect(err.name).toBe("AbortError");
  });
});
