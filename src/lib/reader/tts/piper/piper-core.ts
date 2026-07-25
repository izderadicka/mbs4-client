// Synthesis core for the browser-side Piper TTS provider.
//
// This is a faithful port of the synthesis half of the piper-samples demo
// (izderadicka/piper-samples@fix-demo, resources/piper.js): espeak-ng
// phonemization -> phoneme ids -> ONNX (VITS) inference -> Float32 PCM. It is
// designed to run INSIDE a Web Worker (piper-worker.ts) so the heavy WASM work
// never touches the UI thread. It holds one voice at a time.
//
// Both WASM runtimes are loaded at runtime from self-hosted, same-origin static
// assets (see scripts/prepare-piper-assets.mjs): onnxruntime-web from
// {wasmBase}ort.bundle.min.mjs and espeak-ng from {espeakBase}espeakng.worker.js.
// Loading them via runtime import() (rather than a bundled import) keeps the
// large, WASM-heavy onnxruntime out of the app bundle and lets the mbs4 server
// serve the .wasm with the headers ORT's multithreading needs. Only the types
// are imported (erased at build time).

import type * as OrtTypes from "onnxruntime-web";

type OrtModule = typeof OrtTypes;

// --- espeak-ng constants (from espeak-ng's speak_lib.h) ------------------------
const AUDIO_OUTPUT_SYNCHRONOUS = 2;
const espeakCHARS_AUTO = 0;
const espeakPHONEMES_IPA = 0x02;

const CLAUSE_INTONATION_FULL_STOP = 0x00000000;
const CLAUSE_INTONATION_COMMA = 0x00001000;
const CLAUSE_INTONATION_QUESTION = 0x00002000;
const CLAUSE_INTONATION_EXCLAMATION = 0x00003000;

const CLAUSE_TYPE_CLAUSE = 0x00040000;
const CLAUSE_TYPE_SENTENCE = 0x00080000;

const CLAUSE_PERIOD = 40 | CLAUSE_INTONATION_FULL_STOP | CLAUSE_TYPE_SENTENCE;
const CLAUSE_COMMA = 20 | CLAUSE_INTONATION_COMMA | CLAUSE_TYPE_CLAUSE;
const CLAUSE_QUESTION = 40 | CLAUSE_INTONATION_QUESTION | CLAUSE_TYPE_SENTENCE;
const CLAUSE_EXCLAMATION =
  45 | CLAUSE_INTONATION_EXCLAMATION | CLAUSE_TYPE_SENTENCE;
const CLAUSE_COLON = 30 | CLAUSE_INTONATION_FULL_STOP | CLAUSE_TYPE_CLAUSE;
const CLAUSE_SEMICOLON = 30 | CLAUSE_INTONATION_COMMA | CLAUSE_TYPE_CLAUSE;

// Piper phoneme-id-map sentinels
const BOS = "^";
const EOS = "$";
const PAD = "_";

// --- types ---------------------------------------------------------------------

// The subset of the Piper voice config (.onnx.json) we rely on.
export interface PiperVoiceConfig {
  audio: { sample_rate: number };
  inference?: {
    length_scale?: number;
    noise_scale?: number;
    noise_w?: number;
  };
  phoneme_type?: "espeak" | "text";
  phoneme_id_map: Record<string, number | number[]>;
  num_speakers?: number;
  speaker_id_map?: Record<string, number>;
  espeak?: { voice: string };
}

export interface SynthesisScales {
  speakerId?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseWScale?: number;
}

export interface PiperConfigureOptions {
  // Directory (URL or origin-relative path) the onnxruntime-web assets are
  // served from, e.g. "/onnxruntime/": ort.bundle.min.mjs + the wasm runtime.
  wasmBase: string;
  // Directory the espeak-ng assets (espeakng.worker.js/.wasm/.data) are served
  // from, e.g. "/piper/".
  espeakBase: string;
  // WASM inference threads; only >1 when the page is cross-origin isolated.
  numThreads: number;
}

// The Emscripten espeak-ng module surface we call into.
interface EspeakInstance {
  _espeak_Initialize(
    output: number,
    bufLength: number,
    path: number,
    options: number,
  ): number;
  _espeak_SetVoiceByName(namePtr: number): number;
  _espeak_TextToPhonemesWithTerminator(
    textPtrPtr: number,
    textmode: number,
    phonememode: number,
    terminatorPtr: number,
  ): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  lengthBytesUTF8(str: string): number;
  stringToUTF8(str: string, ptr: number, maxBytes: number): void;
  UTF8ToString(ptr: number): string;
  setValue(ptr: number, value: number, type: string): void;
  getValue(ptr: number, type: string): number;
}

type EspeakModuleFactory = (opts: {
  locateFile: (path: string, scriptDirectory: string) => string;
}) => Promise<EspeakInstance>;

// --- module state (one voice at a time) ---------------------------------------

let ort: OrtModule | null = null;
let espeakBaseUrl = "/piper/";
let espeakInstance: EspeakInstance | null = null;
let voiceConfig: PiperVoiceConfig | null = null;
let voiceModel: OrtTypes.InferenceSession | null = null;

// --- public API ---------------------------------------------------------------

// Load and configure the onnxruntime-web runtime and record asset locations.
// Idempotent; the first call wins.
export async function configure(opts: PiperConfigureOptions): Promise<void> {
  if (ort) return;
  espeakBaseUrl = opts.espeakBase;

  const wasmBase = new URL(opts.wasmBase, self.location.href);
  const ortUrl = new URL("ort.bundle.min.mjs", wasmBase).href;
  // Runtime import of the self-hosted ORT ESM bundle (kept out of the app
  // bundle). @vite-ignore stops Vite from trying to resolve/bundle it.
  const loaded = (await import(/* @vite-ignore */ ortUrl)) as OrtModule;

  loaded.env.wasm.wasmPaths = wasmBase.href;
  loaded.env.wasm.numThreads = Math.max(1, opts.numThreads);
  // We already run inside a dedicated worker, so ORT must not spin up its own
  // proxy worker.
  loaded.env.wasm.proxy = false;
  ort = loaded;
}

// Load a voice: keep its config, lazily init espeak (for espeak-phoneme voices)
// and build the ONNX session from the model bytes. Replaces any previous voice.
// Returns the voice's audio sample rate.
export async function setVoice(
  config: PiperVoiceConfig,
  modelBytes: ArrayBuffer,
): Promise<number> {
  if (!ort) throw new Error("Piper runtime is not configured");
  voiceConfig = config;

  if ((config.phoneme_type ?? "espeak") === "espeak" && !espeakInstance) {
    espeakInstance = await loadEspeak();
    espeakInstance._espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, 0, 0);
  }

  voiceModel = await ort.InferenceSession.create(new Uint8Array(modelBytes));
  return config.audio.sample_rate;
}

export function getSampleRate(): number {
  if (!voiceConfig) throw new Error("Voice is not set");
  return voiceConfig.audio.sample_rate;
}

// Synthesize a single unit of text (mbs4 feeds one sentence per call) to
// Float32 PCM at getSampleRate(). espeak may still split it into clauses; we
// concatenate them into one inference so the caller gets one audio buffer.
export async function synthesizeSentence(
  text: string,
  scales: SynthesisScales,
): Promise<Float32Array> {
  if (!ort || !voiceConfig || !voiceModel) throw new Error("Voice is not set");

  const resolved = resolveScales(scales);
  const segments = textToPhonemes(text);
  const phonemeIds = phonemesToIds(
    voiceConfig.phoneme_id_map,
    segments.map((s) => s.phonemes),
  );
  return synthesizeIds(phonemeIds, resolved);
}

// --- internals -----------------------------------------------------------------

async function loadEspeak(): Promise<EspeakInstance> {
  const base = new URL(espeakBaseUrl, self.location.href);
  const moduleUrl = new URL("espeakng.worker.js", base).href;
  // The espeak glue is served as a same-origin static asset, not bundled by
  // Vite; import it at runtime and let locateFile resolve its .wasm/.data.
  const mod = (await import(/* @vite-ignore */ moduleUrl)) as {
    default: EspeakModuleFactory;
  };
  return mod.default({
    locateFile: (path: string) => new URL(path, base).href,
  });
}

function resolveScales(scales: SynthesisScales): {
  speakerId?: number;
  lengthScale: number;
  noiseScale: number;
  noiseWScale: number;
} {
  const inf = voiceConfig!.inference ?? {};
  return {
    speakerId: scales.speakerId,
    lengthScale: scales.lengthScale ?? inf.length_scale ?? 1.0,
    noiseScale: scales.noiseScale ?? inf.noise_scale ?? 0.667,
    noiseWScale: scales.noiseWScale ?? inf.noise_w ?? 0.8,
  };
}

async function synthesizeIds(
  phonemeIds: number[],
  scales: {
    speakerId?: number;
    lengthScale: number;
    noiseScale: number;
    noiseWScale: number;
  },
): Promise<Float32Array> {
  const runtime = ort!;
  const config = voiceConfig!;
  const model = voiceModel!;

  const phonemeIdsTensor = new runtime.Tensor(
    "int64",
    BigInt64Array.from(phonemeIds, (x) => BigInt(x)),
    [1, phonemeIds.length],
  );
  const phonemeLengthsTensor = new runtime.Tensor(
    "int64",
    BigInt64Array.from([BigInt(phonemeIds.length)]),
    [1],
  );
  const scalesTensor = new runtime.Tensor(
    "float32",
    Float32Array.from([
      scales.noiseScale,
      scales.lengthScale,
      scales.noiseWScale,
    ]),
    [3],
  );

  const feeds: Record<string, OrtTypes.Tensor> = {
    input: phonemeIdsTensor,
    input_lengths: phonemeLengthsTensor,
    scales: scalesTensor,
  };

  if ((config.num_speakers ?? 1) > 1) {
    feeds["sid"] = new runtime.Tensor(
      "int64",
      BigInt64Array.from([BigInt(scales.speakerId ?? 0)]),
    );
  }

  const results = await model.run(feeds);
  const output = results.output.data as Float32Array;
  // Copy out of the ORT-owned buffer so it can be transferred to the main thread.
  return Float32Array.from(output);
}

function normalizeIds(
  value: number | number[] | undefined,
): number[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function phonemesToIds(
  idMap: Record<string, number | number[]>,
  sentences: string[][],
): number[] {
  const out: number[] = [];
  const push = (ids: number[] | undefined) => {
    if (ids) for (const id of ids) out.push(id);
  };

  for (const phonemes of sentences) {
    push(normalizeIds(idMap[BOS]));
    push(normalizeIds(idMap[PAD]));
    for (const phoneme of phonemes) {
      const ids = normalizeIds(idMap[phoneme]);
      if (!ids) continue; // phoneme not in this voice's map
      push(ids);
      push(normalizeIds(idMap[PAD]));
    }
    push(normalizeIds(idMap[EOS]));
  }
  return out;
}

interface PhonemeSegment {
  phonemes: string[];
  start: number;
  end: number;
}

function utf8ByteLength(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

// espeak reports clause boundaries as UTF-8 byte offsets; the JS string is
// indexed in UTF-16 units. Offsets only move forward, so a single forward
// cursor translates them without a lookup table.
function makeByteToCharCursor(text: string): (targetByte: number) => number {
  let byte = 0;
  let char = 0;
  return (targetByte: number) => {
    while (byte < targetByte && char < text.length) {
      const codePoint = text.codePointAt(char)!;
      byte += utf8ByteLength(codePoint);
      char += codePoint > 0xffff ? 2 : 1;
    }
    return char;
  };
}

// Segment text into per-sentence phoneme units with char offsets into `text`.
// For text-phoneme voices the whole input is one unit; otherwise espeak-ng
// drives clause/sentence segmentation.
function textToPhonemes(text: string): PhonemeSegment[] {
  const config = voiceConfig!;

  if (config.phoneme_type === "text") {
    return [
      {
        phonemes: Array.from(text.normalize("NFD")),
        start: 0,
        end: text.length,
      },
    ];
  }

  if (!espeakInstance) throw new Error("espeak-ng is not initialized");
  const espeak = espeakInstance;
  const voice = config.espeak?.voice ?? "en";

  // Set voice
  const voiceBytes = espeak.lengthBytesUTF8(voice) + 1;
  const voicePtr = espeak._malloc(voiceBytes);
  espeak.stringToUTF8(voice, voicePtr, voiceBytes);
  espeak._espeak_SetVoiceByName(voicePtr);
  espeak._free(voicePtr);

  // Prepare text
  const textBytes = espeak.lengthBytesUTF8(text) + 1;
  const textPtr = espeak._malloc(textBytes);
  espeak.stringToUTF8(text, textPtr, textBytes);

  const textPtrPtr = espeak._malloc(4);
  espeak.setValue(textPtrPtr, textPtr, "*");

  const terminatorPtr = espeak._malloc(4);
  const toChar = makeByteToCharCursor(text);

  const segments: PhonemeSegment[] = [];
  let sentencePhonemes: string[] = [];
  let cursorChar = 0;
  let sentenceStartChar = 0;

  while (true) {
    if (sentencePhonemes.length === 0) {
      sentenceStartChar = cursorChar;
    }

    const phonemesPtr = espeak._espeak_TextToPhonemesWithTerminator(
      textPtrPtr,
      espeakCHARS_AUTO,
      espeakPHONEMES_IPA,
      terminatorPtr,
    );
    sentencePhonemes.push(espeak.UTF8ToString(phonemesPtr));

    const terminator = espeak.getValue(terminatorPtr, "i32");
    const punctuation = terminator & 0x000fffff;

    if (punctuation === CLAUSE_PERIOD) sentencePhonemes.push(".");
    else if (punctuation === CLAUSE_QUESTION) sentencePhonemes.push("?");
    else if (punctuation === CLAUSE_EXCLAMATION) sentencePhonemes.push("!");
    else if (punctuation === CLAUSE_COMMA) sentencePhonemes.push(", ");
    else if (punctuation === CLAUSE_COLON) sentencePhonemes.push(": ");
    else if (punctuation === CLAUSE_SEMICOLON) sentencePhonemes.push("; ");

    const nextTextPtr = espeak.getValue(textPtrPtr, "*");
    const endChar =
      nextTextPtr === 0
        ? text.length
        : Math.max(cursorChar, toChar(nextTextPtr - textPtr) - 1);
    cursorChar = endChar;

    if ((terminator & CLAUSE_TYPE_SENTENCE) === CLAUSE_TYPE_SENTENCE) {
      segments.push({
        phonemes: sentencePhonemes,
        start: sentenceStartChar,
        end: endChar,
      });
      sentencePhonemes = [];
    }

    if (nextTextPtr === 0) break;
    espeak.setValue(textPtrPtr, nextTextPtr, "*");
  }

  espeak._free(textPtr);
  espeak._free(textPtrPtr);
  espeak._free(terminatorPtr);

  if (sentencePhonemes.length > 0) {
    segments.push({
      phonemes: sentencePhonemes,
      start: sentenceStartChar,
      end: text.length,
    });
  }

  return segments.map((segment) => ({
    phonemes: Array.from(segment.phonemes.join("").normalize("NFD")),
    start: segment.start,
    end: segment.end,
  }));
}
