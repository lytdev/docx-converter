import { mathjax } from '@mathjax/src/js/mathjax.js';
import { MathML } from '@mathjax/src/js/input/mathml.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { Font as StixTwoFont } from '@mathjax/mathjax-stix2-font/js/svg/default.js';
// MathJax v4 keeps extended glyphs (∬, ℏ, ℕ, …, superscripts, stretchy bars)
// in lazily loaded "dynamic" font files. Conversions here are synchronous and
// the browser bundle has no MathJax loader, so ship the data with the bundle
// and install it on the font instance below instead of loading it on demand.
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/accents.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/accents-other.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/arrows.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/double-struck.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/greek.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/math.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/shapes.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/stretchy.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/symbols.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/symbols-other.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/upright.js';
import '@mathjax/mathjax-stix2-font/js/svg/dynamic/variants.js';
import type { MathNode } from '../domain/document.js';
import type { RenderContext } from '../contracts/ports.js';
import { base64 } from '../modules/images/raster-codec.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
// Word typesets OMML with Cambria Math, which MathJax cannot bundle. STIX Two
// Math is the closest bundled serif math face, so Word formulas keep their
// Times-like letterforms instead of the default Computer Modern look.
const outputJax = new SVG({ fontCache: 'none', fontData: StixTwoFont.DefaultFont }); // Every image embeds its own glyph paths.
const document = mathjax.document('', { InputJax: new MathML(), OutputJax: outputJax });

interface DynamicFontFile { file: string; setup(font: unknown): void }
interface FontDataLike {
  variant: Record<string, { chars: Record<string, unknown> } | undefined>;
  delimiters: Record<string, unknown>;
}
// Keep in sync with the static imports above.
const BUNDLED_DYNAMIC_FONTS = new Set(['accents', 'accents-other', 'arrows', 'double-struck', 'greek', 'math', 'shapes', 'stretchy', 'symbols', 'symbols-other', 'upright', 'variants']);
// The dynamic modules above replace each file's setup callback with one that
// defines its glyphs; running it now keeps the font fully synchronous.
const dynamicFiles = (outputJax.font.constructor as unknown as { dynamicFiles: Record<string, DynamicFontFile> }).dynamicFiles;
const fontData = outputJax.font as unknown as FontDataLike;
const isDynamicMarker = (value: unknown, file: string): boolean =>
  typeof value === 'object' && value !== null && (value as { file?: unknown }).file === file;
for (const dynamic of Object.values(dynamicFiles)) {
  if (BUNDLED_DYNAMIC_FONTS.has(dynamic.file)) {
    dynamic.setup(outputJax.font);
    continue;
  }
  // Variants that are not bundled (accented Latin, Cyrillic, fraktur, ...) should
  // fall back to a <text> glyph instead of triggering a failed async font load.
  for (const variant of Object.values(fontData.variant)) {
    if (!variant) continue;
    for (const [code, value] of Object.entries(variant.chars)) {
      if (isDynamicMarker(value, dynamic.file)) delete variant.chars[code];
    }
  }
  for (const [code, value] of Object.entries(fontData.delimiters)) {
    if (isDynamicMarker(value, dynamic.file)) delete fontData.delimiters[code];
  }
}

function withoutFontSize(attributes: string): string {
  return attributes.replace(/\sstyle="([^"]*)"/, (_style, css: string) => {
    const remaining = css.split(';').filter(rule => rule && !/^font-size\s*:/.test(rule)).join(';');
    return remaining ? ` style="${remaining}"` : '';
  });
}

function mathmlForSvg(mathml: string): string {
  // The SVG's ex-based width/height already carries the rendered size into the
  // <img>. Keep every glyph on the same em instead: MathJax cancels a font-size
  // inherited from <math> or <mstyle> for ordinary tokens, but not for fence
  // characters, so a lone ")" next to a fraction would render 1.4x too large.
  return mathml
    .replace(/^<math([^>]*)>/, (_, attributes: string) => `<math${withoutFontSize(attributes)}>`)
    .replace(/<mstyle\b([^>]*)>/g, (_, attributes: string) => `<mstyle${withoutFontSize(attributes)}>`);
}

function padSvgViewport(svg: string): string {
  // MathJax's page stylesheet normally gives inline SVGs overflow: visible.
  // A standalone SVG used as an <img> has a clipped viewport, and italic
  // corrections / some text glyphs can extend slightly beyond its viewBox.
  return svg.replace(/^<svg\b[^>]*>/, opening => {
    const box = opening.match(/\bviewBox="([^"]+)"/);
    const width = opening.match(/\bwidth="([\d.]+)ex"/);
    const height = opening.match(/\bheight="([\d.]+)ex"/);
    if (!box || !width || !height) return opening;
    const values = box[1].trim().split(/\s+/).map(Number);
    const w = values[2], h = values[3], widthEx = Number(width[1]), heightEx = Number(height[1]);
    if (values.length !== 4 || values.some(value => !Number.isFinite(value)) || w <= 0 || h <= 0 || widthEx <= 0 || heightEx <= 0) return opening;
    // MathJax uses 1000 SVG units per em. Protect italic glyphs at both ends
    // with a small fixed allowance instead of adding 12% of the whole formula.
    // Left side bearings are not part of the reported width, so a first italic
    // glyph (STIX Two) can paint slightly outside the viewport.
    const left = 100, right = 150, top = h * 0.02, bottom = h * 0.02;
    const padded = [values[0] - left, values[1] - top, w + left + right, h + top + bottom].map(value => Number(value.toFixed(3))).join(' ');
    let result = opening.replace(box[0], `viewBox="${padded}"`)
      .replace(width[0], `width="${Number((widthEx * (w + left + right) / w).toFixed(3))}ex"`)
      .replace(height[0], `height="${Number((heightEx * 1.04).toFixed(3))}ex"`);
    result = result.replace(/vertical-align:\s*(-?[\d.]+)ex/, (_match, alignment: string) =>
      `vertical-align: ${Number((Number(alignment) - heightEx * 0.02).toFixed(3))}ex`);
    return result;
  });
}

/** Turn internally generated MathML into a standalone vector image, without page scripts or network fonts. */
export function resolveMathImageSource(node: MathNode, context: RenderContext): string | undefined {
  try {
    if (node.mathml.length > 100_000) throw new Error('Formula too large');
    const result = document.convert(mathmlForSvg(node.mathml), { display: node.display, em: 16, ex: 8, containerWidth: 1280 });
    const svgNode = adaptor.tags(result, 'svg')[0];
    if (!svgNode) throw new Error('SVG output missing');
    const svg = padSvgViewport(adaptor.serializeXML(svgNode));
    if (!svg.startsWith('<svg ') || svg.length > 4 * 1024 * 1024) throw new Error('Invalid SVG output');
    return `data:image/svg+xml;base64,${base64(new TextEncoder().encode(svg))}`;
  } catch {
    context.warn('MATH_IMAGE_FAILED', 'OMML 公式未能生成图片，已保留占位');
    return undefined;
  }
}

