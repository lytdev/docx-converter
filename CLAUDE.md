# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single npm package `@agilehub/docx-converter`: a TypeScript + Vite DOCX → HTML / JSON converter. No Mammoth, Java, Word, server, or online formula service is used at runtime. `apps/playground` is the demo application in the same package, not a second package.

Three public entry points, each with a narrow responsibility:

- `src/index.ts` — universal API: `convertToHtml`, `convertToJson`, public types.
- `src/node.ts` — Node-only file-path API: `convertToHtmlFile`, `convertToJsonFile`, ImageMagick preview adapter.
- `src/browser-metafile.ts` — browser WMF/EMF image adapter.

Documentation is Chinese and authoritative: `README.md` (basic usage and parameters), `docs/` (output formats, advanced capabilities, compatibility, architecture, JSON integrations), and `CONTRIBUTING.md` (where changes belong, checks, delivery rules).

## Commands

```sh
npm ci
npm run dev              # playground, http://127.0.0.1:5173
npm run check            # architecture + 4 TypeScript configs + Vitest
npm run build            # ESM/CJS/UMD, declarations, demo build
npm run test:e2e         # Playwright against built demo, port 4173
npm run verify           # check + build + e2e; the CI entry point
npm pack                 # builds and produces an installable tarball
```

Single test:

```sh
npx vitest run tests/integration/formula-corpus.test.ts
npx vitest run tests/integration/converter.test.ts -t "preserves explicit math font"
npx playwright test tests/e2e/browser.spec.ts -g "formula corpus"
```

There is no ESLint/Prettier step; `npm run check` is the lint gate (`scripts/check-architecture.ts`, typecheck, Vitest).

E2E prerequisites: run `npx playwright install chromium`, or set `DOCX_TEST_BROWSER` to an absolute Chrome/Edge executable (e.g. `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`). Playwright starts `vite preview` on 4173.

On Windows, if the sandbox restricts the temp directory, point `TEMP`/`TMP` at a project-local `.tmp` before running Vitest.

## Architecture

### Conversion pipeline

```text
input (Blob / ArrayBuffer / Uint8Array / HTTP(S) URL / Node path)
  → application/convert-docx.ts      sole composition root, converts input, creates ConversionSession
  → infrastructure/archive + opc     ZIP limits, OPC relationships, XML cache
  → modules/document                 DocumentParser: paragraphs, inline, drawings, tables
  → domain/document                  shared DocumentModel (blocks / inlines / MathNode ...)
  → rendering/html | rendering/json  consume the same model with a ResourceReader/RenderContext
  → image policy + resource collection
  → ConversionResult / JsonConversionResult
```

- Every call owns its package cache, `ParsedDocument`, `ConversionSession`, and renderer. There is no global mutable conversion state; lists counters live in the current renderer.
- Parsers match by namespace URI + localName, never by XML prefix. Parts are located through OPC relationships; document-supplied external relations are never fetched automatically.
- `DocumentParser` connects table-in-table and textbox parsing through callbacks, so child parsers do not reference the parent parser.
- Renderers must not read XML or hold a parser; new renderer data belongs in the model or a minimal port.
- `ConversionSession` owns cancellation, progress stages (`reading`, `extracting`, `parsing`, `rendering`, `complete`), and diagnostics. Warnings are returned, not thrown.

### Dependency boundaries

`scripts/check-architecture.ts` parses every `src/**/*.ts` and `apps/**/*.ts` import (runtime, type-only, re-export, literal dynamic import, worker URL) and rejects violations and cycles:

- `contracts`, `domain`, `shared` are foundations with no cross-layer dependencies.
- `infrastructure` may only depend on itself and foundations; `modules` feature folders may not reference each other except `modules/document` → styles/numbering/math; `rendering` may depend on `modules/images`; `adapters` may call `application`.
- `node:*` and Node built-ins are allowed only under `src/adapters/node`.
- `apps/playground` may import only `src/index.ts` and `src/browser-metafile.ts`.
- Do not loosen these rules just to silence the checker; update the architecture and its documentation deliberately.

### Public API and options

`src/contracts/conversion.ts` defines the public options/results (`output`, `formulaOutput`, `drawingOutput`, `imageHandler`, `onProgress`, `signal`, `limits`). Defaults and basic usage are documented in `README.md`; detailed behavior is documented under `docs/`. Public compatibility is promised only through the three entry files; internal paths are not public exports.

### Images

- Raster images are identified by bytes and embedded as base64 by default. `imageHandler` controls conversion, large-image upload, and custom URL resolution; only explicit handlers may perform network side effects.
- EMF uses the built-in `emf-converter`; WMF/TIFF/SVG can be handled by `imageHandler.convert` or the browser metafile adapter. Original resources always remain in `resources`.

### Playground

`apps/playground/worker` runs the shared converter off the main thread; `controller.ts` handles request races and cancellation, `ui/view.ts` owns the sandboxed preview iframe, and `downloads.ts` exports HTML/JSON/ZIP. A stale request must never overwrite a newer one.

## Math / OMML specifics

- `src/modules/math/omml-converter.ts` recursively converts OMML into internal MathML and reconstructs LaTeX. Unsupported tags report `UNSUPPORTED_MATH` and omit unreliable LaTeX. Literal operators from `m:r` runs are emitted as `<mo stretchy="false">`; only `m:d` delimiters stay stretchy (this keeps literal parentheses at Word's normal size).
- N-ary limits follow Word, not `m:limLoc` alone: inline `m:oMath` equations always place limits to the right (`msubsup`/`msub`/`msup`) even when `m:limLoc` is `undOvr`; only display equations (`m:oMathPara`) honor `m:limLoc` and stack them (`munderover`/...). `convertMath` uses its `display` flag to decide.
- `src/rendering/math-image-source.ts` is the default image path: MathJax 4 source API + STIX Two Math font data, serialized to a self-contained data-URI SVG.
- MathJax v4 keeps extended glyphs (∬, ℕ, superscripts, stretchy bars) in lazily loaded dynamic font files. Conversion is synchronous and the browser bundle has no MathJax loader, so 12 math-relevant dynamic files are statically imported and their `setup(font)` is invoked once on the font instance. Unbundled dynamic ranges (accented Latin, Cyrillic, fraktur, ...) have their markers removed so they fall back to `<text>` instead of failing.
- `mathmlForSvg` strips `font-size` from `<math>` and every `<mstyle>`: MathJax cancels an inherited run size for ordinary tokens but not for fence characters, which would render a lone `)` 1.4× too large. Do not reintroduce font-size without rechecking that behavior.
- `padSvgViewport` adds left/right padding and 2% top/bottom; left padding is required for italic side bearings. The image's `width`/`height` are ex-based and fixed by the SVG, not inherited from the surrounding CSS.
- Vite aliases map MathJax's private `#default-font` specifier to STIX Two in `vite.config.ts`, `vite.lib.config.ts`, and `vite.browser.config.ts`. This prevents bundling the unused NewCM font (~1 MB). Keep the aliases in sync.
- `{ formulaOutput: 'mathml' }` bypasses SVG generation entirely and keeps semantic MathML.

## Tests

- `tests/fixtures/docx.ts` builds minimal in-memory DOCX packages; other fixtures cover EMF, WMF, OLE/MTEF, and formulas. Use these instead of real customer documents. `public/sample.docx` is the distributable sample; `demo.docx` at the root is a working manual-check document.
- `tests/unit` — ports, module boundaries, Worker lifecycle; `tests/integration` — public conversion behavior and failure boundaries; `tests/e2e` — browser preview, downloads, URL input, and the formula corpus against the built demo.
- `tests/fixtures/university-formulas.ts` holds 367 OMML formulas across algebra, inequalities, limits, integrals, ODEs, probability/statistics, linear algebra, series, line/multiple integrals, trigonometry, and physics. `formula-corpus.test.ts` validates every formula as both an inline (`m:oMath`) and a display (`m:oMathPara`) equation (no diagnostics, LaTeX reconstructed, valid SVG, correct n-ary limit placement). The e2e corpus test renders both layouts and checks all images load and nothing is painted outside the viewBox. Extend this corpus when fixing formula rendering.
- E2E runs against the built demo (`dist-demo`), so rebuild after source changes before `npm run test:e2e`. Vitest imports `src` directly.

## Delivery

Before committing, run `npm run verify`. Keep README parameters, `docs/errors-and-compatibility.md` support statements, and `docs/architecture.md` current when capabilities or module boundaries change. Do not commit documents from the Java reference project; public samples must be generated or independently constructed.
