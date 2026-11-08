import "@testing-library/svelte/vitest";
import { Storage } from "happy-dom";

// Newer Node versions ship an experimental Web Storage API whose
// localStorage/sessionStorage globals are undefined unless Node runs with
// --localstorage-file. They shadow happy-dom's implementations, so install
// in-memory storages when the globals are missing.
for (const name of ["localStorage", "sessionStorage"] as const) {
  if (!globalThis[name]) {
    Object.defineProperty(globalThis, name, {
      value: new Storage(),
      writable: true,
      configurable: true,
    });
  }
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: () => {},
  writable: true,
});
