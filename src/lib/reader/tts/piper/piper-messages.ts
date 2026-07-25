// Message protocol shared between PiperTtsService (main thread) and
// piper-worker.ts (Web Worker). Every request carries a monotonic `reqId`; the
// worker answers with a response bearing the same `reqId`.

import type { PiperVoiceConfig } from "./piper-core";

export interface PiperConfigureMsg {
  type: "configure";
  reqId: number;
  wasmBase: string;
  espeakBase: string;
  numThreads: number;
}

export interface PiperSetVoiceMsg {
  type: "setVoice";
  reqId: number;
  // The .onnx.json contents.
  config: PiperVoiceConfig;
  // The .onnx model bytes (transferred).
  modelBytes: ArrayBuffer;
}

export interface PiperSynthesizeMsg {
  type: "synthesize";
  reqId: number;
  text: string;
  speakerId?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseWScale?: number;
}

export type PiperRequest =
  | PiperConfigureMsg
  | PiperSetVoiceMsg
  | PiperSynthesizeMsg;

// Distributive Omit so each union member keeps its own fields (a plain
// Omit<PiperRequest, "reqId"> would collapse to just the shared `type`).
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

// A request without its reqId; the service fills reqId in before posting.
export type PiperRequestBody = DistributiveOmit<PiperRequest, "reqId">;

export interface PiperOkResponse {
  reqId: number;
  ok: true;
  // setVoice -> sample rate; synthesize -> sample rate; configure -> undefined
  sampleRate?: number;
  // synthesize -> Float32 PCM (transferred)
  pcm?: Float32Array;
}

export interface PiperErrResponse {
  reqId: number;
  ok: false;
  error: string;
}

export type PiperResponse = PiperOkResponse | PiperErrResponse;
