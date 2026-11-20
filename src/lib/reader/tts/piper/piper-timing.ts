// Startup timing log for the Piper provider. Loading a voice takes long on
// phones, and only real-device numbers tell which step dominates - each step
// is logged to the console (visible with remote debugging), prefixed
// "[piper]". Downloads also report whether they came from the browser cache.

const PREFIX = "[piper]";

export function since(start: number): string {
  return `${((performance.now() - start) / 1000).toFixed(2)} s`;
}

export function logStep(message: string): void {
  console.info(`${PREFIX} ${message}`);
}

export function logDetail(message: string): void {
  console.debug(`${PREFIX} ${message}`);
}

function megabytes(bytes: number): string {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

// Describe how a fetched URL was delivered, from the Resource Timing entry of
// the current global (window or worker); empty when the browser recorded none.
export function describeDownload(url: string): string {
  if (typeof performance === "undefined" || !performance.getEntriesByName) {
    return "";
  }
  const absolute = new URL(url, self.location.href).href;
  const entry = performance
    .getEntriesByName(absolute, "resource")
    .at(-1) as PerformanceResourceTiming | undefined;
  if (!entry) return "";
  const size = megabytes(entry.decodedBodySize);
  // transferSize 0 = served from the HTTP cache without touching the network;
  // a few hundred bytes = revalidated (304), body taken from the cache
  const source =
    entry.transferSize === 0
      ? "from cache"
      : entry.transferSize < entry.decodedBodySize / 2
        ? "revalidated, body from cache"
        : `downloaded ${megabytes(entry.transferSize)}`;
  const duration = `${(entry.duration / 1000).toFixed(2)} s`;
  return `${size}, ${source}, ${duration}`;
}

// Downloads made by the WASM runtimes themselves (ORT, espeak) inside the
// worker, matched by file name.
export function logRuntimeDownloads(fileNames: string[]): void {
  if (typeof performance === "undefined" || !performance.getEntriesByType) {
    return;
  }
  const entries = performance.getEntriesByType(
    "resource",
  ) as PerformanceResourceTiming[];
  for (const name of fileNames) {
    const entry = entries.findLast((e) => e.name.split("?")[0].endsWith(name));
    if (entry) logStep(`download ${name}: ${describeDownload(entry.name)}`);
  }
}
