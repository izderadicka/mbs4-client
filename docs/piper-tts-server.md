# Piper TTS — server-side requirements

The mbs4 **client** now ships a browser-side Piper TTS provider
(`src/lib/reader/tts/piper/`). It synthesizes speech locally (ONNX + espeak-ng
WASM in a Web Worker); the mbs4 **server** only needs to (1) list and serve the
voice files and (2) send the response headers that let onnxruntime-web run
multithreaded. This document is the contract the client already codes against —
hand it to whoever implements the server side.

## 1. Voice storage & naming

Keep Piper voices in a configured directory, named with the standard rhasspy
scheme so "list voices for a language" is just "scan the matching `.onnx.json`":

```
{lang}_{REGION}-{name}-{quality}.onnx
{lang}_{REGION}-{name}-{quality}.onnx.json
# e.g. cs_CZ-jirka-medium.onnx(.json), en_US-lessac-high.onnx(.json)
```

The `.onnx.json` is Piper's standard config (it already contains
`audio.sample_rate`, `phoneme_type`, `phoneme_id_map`, `inference`,
`num_speakers`, `speaker_id_map`, `espeak.voice`). The client consumes it as-is.

## 2. Endpoints (extend the OpenAPI spec)

Base path used by the client: `PIPER_VOICES_PATH = "/tts/piper/voices"`
(`src/lib/config.ts`). All three are served by the mbs4 server on the same
origin as the app.

### `GET /tts/piper/voices?language={bcp47}`

Returns a JSON array of voice descriptors derived by scanning the `.onnx.json`
files. `language` is an optional BCP-47 primary-subtag filter (e.g. `cs` matches
`cs_CZ`; omitted = all voices).

```jsonc
[
  {
    "id": "cs_CZ-jirka-medium",   // required, unique; the Voice.id in the UI
    "name": "Jirka (medium)",      // display name (optional; defaults to id)
    "language": "cs",              // BCP-47 (optional but recommended for filtering)
    "model": "cs_CZ-jirka-medium", // file base name (optional; defaults to id)
    "speaker": 0,                  // speaker index for multi-speaker models (optional; default 0)
    "quality": "medium"            // optional; shown as the voice description
  }
]
```

Notes:
- The client re-filters by `language` defensively, but the server should filter
  so the list stays small.
- **Multi-speaker models:** expand each speaker into its own entry with a
  distinct `id` but the **same `model`** and a different `speaker` index (the
  client loads the model once and reuses it across its speakers). Derive names
  from the config's `speaker_id_map`.

### `GET /tts/piper/voices/{model}.onnx.json`

The Piper voice config file. `Content-Type: application/json`.

### `GET /tts/piper/voices/{model}.onnx`

The ONNX model bytes. `Content-Type: application/octet-stream`. Models are
10–60 MB, so: send `ETag`/`Cache-Control` (long-lived) and support HTTP range
requests. The client fetches both files with `credentials: "include"`, so if the
library is auth-protected they ride the session cookie (same origin).

## 3. Cross-origin isolation headers (the important part)

onnxruntime-web only runs **multi-threaded** WASM when the page is
*cross-origin isolated* (needs `SharedArrayBuffer`). Without it, synthesis still
works but single-threaded (slower). To enable it, the server must send, on the
**app HTML and every same-origin asset** (the SPA, the ORT/espeak WASM under
`/onnxruntime/` and `/piper/`, and the voice files):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp        # or: credentialless
Cross-Origin-Resource-Policy: same-origin          # on served assets
```

Serve `.wasm` as `Content-Type: application/wasm`. Verify in the browser console
that `crossOriginIsolated === true`. (Reference: the demo's `serve.py` in
izderadicka/piper-samples@fix-demo uses COOP `same-origin` + COEP
`credentialless`.)

Caveat: `require-corp` will block *cross-origin* subresources that don't send
CORP. Everything Piper needs is same-origin in production, so prefer
`require-corp`; switch to `credentialless` only if the app loads no-CORS
cross-origin assets that would otherwise break.

## 4. WASM runtime assets (already handled client-side)

The onnxruntime-web runtime and the espeak-ng phonemizer are served as static
app assets, not by a special endpoint — the SPA's static handler covers them, so
they automatically get the headers from §3:

- `/onnxruntime/ort.bundle.min.mjs`, `/onnxruntime/ort-wasm-simd-threaded.{mjs,wasm}`
- `/piper/espeakng.worker.{js,wasm,data}`

They are produced by `scripts/prepare-piper-assets.mjs` (run via the
`prebuild`/`predev` hooks). `espeakng.worker.js/.wasm` are committed;
`espeakng.worker.data` (~24 MB) and the ORT files are git-ignored and
regenerated. The server just needs to serve the app's static output as usual —
**no server work required for these** beyond the §3 headers.

## 5. Client integration summary (for reference)

- Provider id `piper`; selected on Settings → Read Aloud ("Piper (offline)").
- `listVoices(language)` → `GET /tts/piper/voices?language=`.
- On voice selection the client preloads `{model}.onnx(.json)` and warms the
  model; `synthesize()` returns WAV per sentence through the existing
  `TtsServicePipeline`.
- Length scale (speed) is derived client-side; the server returns raw files
  only.
