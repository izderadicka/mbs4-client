import { dev, browser } from "$app/environment";
import { PUBLIC_DEV_AUTOLOGIN, PUBLIC_TTS_URL } from "$env/static/public";

export const AUTOLOGIN = dev && PUBLIC_DEV_AUTOLOGIN && browser;
export const IS_DEV = dev;

// The TTS service implementation is selected on the settings page
// (appSettings.ttsProvider) - see $lib/settings.svelte.ts.

// base URL of a standalone TTS service (used by the edge provider);
// overridable per-service with the "baseUrl" settings parameter
export const TTS_URL = PUBLIC_TTS_URL;
