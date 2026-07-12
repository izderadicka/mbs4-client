import tailwindcss from "@tailwindcss/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  test: {
    browser: {
      enabled: true,
      // headless by default (CI, containers); override locally with
      // --browser.headless=false to watch the tests run
      headless: true,
      provider: playwright({
        launchOptions: {
          // override when the Playwright-managed download is unavailable
          // (e.g. sandboxed environments with a preinstalled browser)
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          // WebAudio tests must start playback without a user gesture
          args: ["--autoplay-policy=no-user-gesture-required"],
        },
      }),
      instances: [{ browser: "chromium" }],
    },
    include: ["src/**/*.browser.{test,spec}.{js,ts}"],
    exclude: ["src/lib/server/**"],
    setupFiles: ["./vitest-setup-browser.ts"],
  },
});
