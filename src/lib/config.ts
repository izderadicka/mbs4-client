export const DEV_API_URL = "http://localhost:3000";
export const TOKEN_VALIDITY_MINUTES_MINIMUM = 5;
export const MAX_SEARCH_RESULTS = 50;
export const LOGIN_MESSAGE =
  'Welcome to <span class="font-bold">MBS4</span>, if you have an account, please log in. If you do not have an account, contact admin.';
export const WAIT_LONG_FOR_META_TIMEOUT = 10000;
// based on tailwind breakpoints - should not be changed unless you know what you're doing
export const SCREEN_WIDTH_SM = 576;
export const SCREEN_WIDTH_MD = 768;
export const SCREEN_WIDTH_LG = 976;
export const SCREEN_WIDTH_XL = 1140;
export const SCREEN_WIDTH_2XL = 1320;

// potentionally configurable in app
export const DEFAULT_PAGE_SIZE = 10;

// target formats offered for ebook conversion (individual and batch)
export const CONVERTIBLE_FORMATS = ["epub", "mobi", "txt", "pdf"];

// formats readable online with the embedded foliate-js reader
export const READER_FORMATS = ["epub", "mobi", "azw", "azw3", "fb2", "cbz"];

// default base URL of the stopgap Edge TTS proxy (tts-cz-data repo);
// override with PUBLIC_TTS_URL or the "baseUrl" TTS settings parameter
export const EDGE_TTS_DEFAULT_URL = "http://127.0.0.1:8899";
// keep at least this much synthesized audio queued ahead of playback so
// short TTS service outages don't interrupt speech
export const TTS_TARGET_BUFFER_S = 30;
// ... but always at least this many sentences (short sentences => short audio)
export const TTS_MIN_LOOKAHEAD_SENTENCES = 5;
// hard cap on sentences buffered ahead (bounds memory for decoded audio)
export const TTS_MAX_LOOKAHEAD_SENTENCES = 20;
// concurrent synthesis requests to the TTS service
export const TTS_MAX_CONCURRENT_SYNTH = 2;
// silence inserted between sentences during playback
export const TTS_SENTENCE_GAP_S = 0.3;
// retry backoff for transient TTS service failures
export const TTS_RETRY_INITIAL_MS = 1000;
export const TTS_RETRY_MAX_MS = 15000;
// give up (terminal error) when a sentence cannot be synthesized this long
export const TTS_RETRY_WINDOW_MS = 90000;

// --- Piper (browser-side neural TTS) -----------------------------------------
// Same-origin dirs the app/mbs4 server serves the WASM runtime assets from.
// Must match scripts/prepare-piper-assets.mjs. onnxruntime-web wasm/mjs:
export const PIPER_WASM_BASE = "/onnxruntime/";
// espeak-ng phonemizer assets (espeakng.worker.js/.wasm/.data):
export const PIPER_ESPEAK_BASE = "/piper/";
// Piper VITS scales; length scale is inverse of speed (voice config may override).
export const PIPER_DEFAULT_LENGTH_SCALE = 1.0;
export const PIPER_DEFAULT_NOISE_SCALE = 0.667;
export const PIPER_DEFAULT_NOISE_W_SCALE = 0.8;
