// Prepares the large runtime assets the browser-side Piper TTS provider needs
// but that are deliberately NOT committed to git (see .gitignore):
//
//   static/onnxruntime/ort-wasm-simd-threaded.{mjs,wasm}  - copied from the
//       installed onnxruntime-web package (the CPU/SIMD/threads WASM runtime).
//   static/piper/espeakng.worker.data                     - the ~24 MB espeak-ng
//       dictionary data package, downloaded from the piper-samples repo.
//
// The small espeak glue (espeakng.worker.js/.wasm) IS committed under
// static/piper/. Run this once after `pnpm install` (it is also wired into the
// `prepare` script). Safe to re-run; it skips assets that already exist.
//
// Both asset roots are served same-origin by the app / mbs4 server. The paths
// here must match PIPER_WASM_BASE / PIPER_ESPEAK_BASE in src/lib/config.ts.

import { createWriteStream } from "node:fs";
import { mkdir, copyFile, access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ortDist = join(root, "node_modules", "onnxruntime-web", "dist");
const ortOut = join(root, "static", "onnxruntime");
const piperOut = join(root, "static", "piper");

// The onnxruntime-web ESM bundle (loaded at runtime by piper-core) plus the CPU
// SIMD+threads WASM runtime it fetches from ort.env.wasm.wasmPaths. The .bundle.
// entry inlines the proxy/pthread workers, so only this pair is needed (no
// jsep/webgpu build).
const ORT_FILES = [
  "ort.bundle.min.mjs",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

// espeak-ng data package (preload file for the espeakng.worker Emscripten
// module). Lives at the repo root of the piper demo.
const ESPEAK_DATA_URL =
  "https://raw.githubusercontent.com/izderadicka/piper-samples/fix-demo/espeakng.worker.data";
const espeakData = join(piperOut, "espeakng.worker.data");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyOrtRuntime() {
  if (!(await exists(ortDist))) {
    console.warn(
      "[piper-assets] onnxruntime-web not installed; run `pnpm install` first. Skipping ORT copy.",
    );
    return;
  }
  await mkdir(ortOut, { recursive: true });
  for (const name of ORT_FILES) {
    const src = join(ortDist, name);
    if (!(await exists(src))) continue; // variant not shipped in this version
    await copyFile(src, join(ortOut, name));
    console.log(`[piper-assets] copied ${name}`);
  }
}

async function fetchEspeakData() {
  if (await exists(espeakData)) {
    const { size } = await stat(espeakData);
    if (size > 1_000_000) {
      console.log(
        "[piper-assets] espeakng.worker.data present; skipping download",
      );
      return;
    }
  }
  await mkdir(piperOut, { recursive: true });
  console.log(`[piper-assets] downloading espeakng.worker.data (~24 MB)...`);
  const res = await fetch(ESPEAK_DATA_URL);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download espeak data: ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(espeakData));
  console.log("[piper-assets] espeakng.worker.data ready");
}

await copyOrtRuntime();
await fetchEspeakData().catch((e) => {
  console.warn(`[piper-assets] ${e.message}`);
  console.warn(
    "[piper-assets] Piper voices will not work until espeakng.worker.data is available.",
  );
});
