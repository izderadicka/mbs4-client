import tailwindcss from "@tailwindcss/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig, type Plugin } from "vitest/config";

// foliate-js dynamically imports ./pdf.js, whose import.meta.url asset
// references break the Vite build and would pull in the whole vendored
// pdfjs. PDF is not offered in the online reader (browsers show PDFs
// natively), so replace the module with a stub.
function stubFoliatePdf(): Plugin {
  const stubId = "\0foliate-pdf-stub";
  return {
    name: "stub-foliate-pdf",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "./pdf.js" && importer?.includes("foliate-js")) {
        return stubId;
      }
    },
    load(id) {
      if (id === stubId) {
        return 'export const makePDF = () => { throw new Error("PDF is not supported in the online reader"); };';
      }
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    svelteTesting(),
    devtoolsJson(),
    stubFoliatePdf(),
  ],
  optimizeDeps: {
    exclude: ["foliate-js"],
  },
  test: {
    environment: "happy-dom",
    pool: "threads",
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["src/lib/server/**"],
    setupFiles: ["./vitest-setup.ts"],
  },
});
