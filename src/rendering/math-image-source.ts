import { mathjax } from '@mathjax/src/js/mathjax.js';
import { MathML } from '@mathjax/src/js/input/mathml.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import type { MathNode } from '../domain/document.js';
import type { RenderContext } from '../contracts/ports.js';
import { base64 } from '../modules/images/raster-codec.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const document = mathjax.document('', {
  InputJax: new MathML(),
  OutputJax: new SVG({ fontCache: 'none' }), // Every image embeds its own glyph paths.
});

function mathmlForSvg(mathml: string): string {
  // The paragraph already sizes the <img> through its inherited CSS. Passing that
  // same size into MathJax as <math style="font-size:..."> makes the glyphs larger
  // than MathJax's SVG viewBox and clips the right and bottom edges.
  return mathml.replace(/^<math([^>]*)>/, (_, attributes: string) => `<math${attributes.replace(/\sstyle="([^"]*)"/, (_style, css: string) => {
    const remaining = css.split(';').filter(rule => rule && !/^font-size\s*:/.test(rule)).join(';');
    return remaining ? ` style="${remaining}"` : '';
  })}>`);
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
    const right = w * 0.12, top = h * 0.02, bottom = h * 0.02;
    const padded = [values[0], values[1] - top, w + right, h + top + bottom].map(value => Number(value.toFixed(3))).join(' ');
    let result = opening.replace(box[0], `viewBox="${padded}"`)
      .replace(width[0], `width="${Number((widthEx * 1.12).toFixed(3))}ex"`)
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

