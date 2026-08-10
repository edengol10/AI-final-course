import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
}

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, configurable: true });
