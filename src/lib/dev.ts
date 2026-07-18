import { dev, browser } from "$app/environment";
import {
  PUBLIC_DEV_AUTOLOGIN,
  PUBLIC_TTS_PROVIDER,
  PUBLIC_TTS_URL,
} from "$env/static/public";

export const AUTOLOGIN = dev && PUBLIC_DEV_AUTOLOGIN && browser;
export const IS_DEV = dev;

// TTS service implementation: mock (local fake audio), rest (backend API) or
// edge (the stopgap Edge TTS proxy from the tts-cz-data repo); defaults to
// mock in dev so read-aloud is testable without a TTS backend
export const TTS_PROVIDER: "mock" | "rest" | "edge" =
  PUBLIC_TTS_PROVIDER === "rest" ||
  PUBLIC_TTS_PROVIDER === "mock" ||
  PUBLIC_TTS_PROVIDER === "edge"
    ? PUBLIC_TTS_PROVIDER
    : dev
      ? "mock"
      : "rest";

// base URL of a standalone TTS service (used by the edge provider)
export const TTS_URL = PUBLIC_TTS_URL;
