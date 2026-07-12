import { dev, browser } from "$app/environment";
import { PUBLIC_DEV_AUTOLOGIN, PUBLIC_TTS_PROVIDER } from "$env/static/public";

export const AUTOLOGIN = dev && PUBLIC_DEV_AUTOLOGIN && browser;
export const IS_DEV = dev;

// TTS service implementation: mock (local fake audio) or rest (backend API);
// defaults to mock in dev so read-aloud is testable without a TTS backend
export const TTS_PROVIDER: "mock" | "rest" =
  PUBLIC_TTS_PROVIDER === "rest" || PUBLIC_TTS_PROVIDER === "mock"
    ? PUBLIC_TTS_PROVIDER
    : dev
      ? "mock"
      : "rest";
