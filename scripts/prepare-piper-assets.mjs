// Copies the onnxruntime-web WASM runtime the browser-side Piper TTS provider
// needs but that is not committed to git (see .gitignore):
//
//   static/onnxruntime/ort-wasm-simd-threaded.{mjs,wasm}  - copied from the
//       installed onnxruntime-web package (the CPU/SIMD/threads WASM runtime).
//
// The espeak assets (espeakng.worker.js/.wasm and the ~24 MB
// espeakng.worker.data dictionary) ARE committed under static/piper/. Run this
// once after `pnpm install` (it is also wired into the `prepare` script). Safe
// to re-run; it skips assets that already exist.
//
// The asset root is served same-origin by the app / mbs4 server. The paths here
// must match PIPER_WASM_BASE / PIPER_ESPEAK_BASE in src/lib/config.ts.

import { mkdir, copyFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ortDist = join(root, "node_modules", "onnxruntime-web", "dist");
const ortOut = join(root, "static", "onnxruntime");

// The onnxruntime-web ESM bundle (loaded at runtime by piper-core) plus the
// SIMD+threads WASM runtime it fetches from ort.env.wasm.wasmPaths. In
// onnxruntime-web >=1.27 `ort.bundle.min.mjs` is the jsep (SIMD+threads,
// WebGPU-capable) build, so it requests the `.jsep.*` runtime pair. The bundle
// inlines the pthread worker; with env.wasm.proxy=false no proxy worker is
// fetched, so only this trio is needed.
const ORT_FILES = [
  "ort.bundle.min.mjs",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

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

await copyOrtRuntime();
