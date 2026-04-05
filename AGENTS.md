# Repository Guidelines

## Project Structure & Module Organization
`src/routes` contains SvelteKit route modules, including authenticated pages under `src/routes/(protected)`. Shared code lives in `src/lib`: reusable UI components in `src/lib/components`, API helpers in `src/lib/api`, app config and globals in `src/lib/config.ts` and `src/lib/globals.svelte.ts`, and shared types/schemas in `src/lib/types` and `src/lib/schemas.ts`. Static assets live in `static/`. OpenAPI input is stored in `openapi/openapi.json`; generated client types are written to `src/lib/api/types.ts`.

## Svelte guidelines
This is Svelte 5 project Use runes ($state, $derived, $effect, $props), snippets instead of slots,no export let, 
and native DOM event attributes (onclick, oninput…) no  on: attributes for events. 
Assume shadcn-svelte + Tailwind environment.


## Build, Test, and Development Commands
Use `npm install` once to set up dependencies.

- `npm run dev` starts the Vite dev server.
- `npm run build` creates the production build.
- `npm run preview` serves the built app locally.
- `npm run check` runs `svelte-kit sync` and `svelte-check`.
- `npm test` runs the Vitest suite once.
- `npm run test:unit` starts Vitest in watch mode.
- `npm run fmt` formats files under `src/` with Prettier.
- `npm run openapi` refreshes `openapi/openapi.json` from the backend and regenerates `src/lib/api/types.ts`.

## Coding Style & Naming Conventions
Follow the existing TypeScript and Svelte style: 2-space indentation, double quotes, and Prettier formatting from `.prettierrc`. Name Svelte components in lowercase kebab-case such as `ebook-form.svelte`; keep route files on SvelteKit defaults like `+page.svelte` and `+page.ts`. Export shared helpers from `src/lib` when reused across routes. Do not hand-edit generated API types in `src/lib/api/types.ts`.

## Testing Guidelines
Tests use Vitest with browser-oriented Svelte helpers. Keep tests next to the code they cover when practical, using `*.test.ts` or `*.spec.ts`; examples already exist in `src/routes/page.svelte.test.ts` and `src/demo.spec.ts`. Run `npm test` before opening a PR, and run `npm run check` for type and Svelte diagnostics.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Fix bookshelf delete` and `Add logos to login`. Keep commits focused and descriptive, ideally one behavior change per commit. PRs should include a brief summary, note any affected routes or API changes, link related issues, and attach screenshots for visible UI updates.

## Configuration Notes
Local API integration depends on the backend OpenAPI endpoint used by `npm run openapi`. Review `src/lib/config.ts` and `src/lib/dev.ts` before changing environment-specific behavior.
