import { Canvg } from 'canvg';
import { DOMParser } from '@xmldom/xmldom';

/** Rasterize trusted internal SVG without allowing external resources. */
export async function svgToPng(
  svg: string,
  displayWidth: number,
  displayHeight: number,
  background: string | null = '#ffffff',
): Promise<Uint8Array> {
  if (!Number.isFinite(displayWidth + displayHeight) || displayWidth <= 0 || displayHeight <= 0 || svg.length > 4 * 1024 * 1024)
    throw new Error('Invalid drawing dimensions');
  // Bound memory for unusually large drawings while preserving their aspect ratio.
  const scale = Math.min(3, 8192 / displayWidth, 8192 / displayHeight, Math.sqrt(16_000_000 / (displayWidth * displayHeight)));
  const width = Math.max(1, Math.ceil(displayWidth * scale)), height = Math.max(1, Math.ceil(displayHeight * scale));
  let context: Parameters<typeof Canvg.fromString>[0];
  let encode: () => Promise<Uint8Array>;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    context = ctx;
    encode = async () => new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  } else if (typeof globalThis === 'object' && 'document' in globalThis) {
    // Use a structural type so the same module also typechecks in Web Workers.
    const doc = (globalThis as unknown as { document: { createElement(name: string): {
      width: number; height: number; getContext(name: string): typeof context;
      toBlob(callback: (blob: Blob | null) => void, mime: string): void;
    } } }).document;
    const canvas = doc.createElement('canvas'); canvas.width = width; canvas.height = height;
    context = canvas.getContext('2d');
    encode = async () => {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG encoding failed')), 'image/png'));
      return new Uint8Array(await blob.arrayBuffer());
    };
  } else {
    // Runtime-only import: native Node binaries must never enter browser bundles.
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    context = canvas.getContext('2d') as unknown as typeof context;
    encode = async () => new Uint8Array(await canvas.encode('png'));
  }
  // Resize the root viewport; keep its viewBox unchanged. Canvg's scaleWidth
  // applies an additional transform and offsets nested groups with a viewBox.
  const sizedSvg = svg.replace(/^<svg\b[^>]*>/, tag => tag.replace(/\bwidth="[^"]*"/, `width="${width}"`).replace(/\bheight="[^"]*"/, `height="${height}"`))
    .replace(/stroke-width="([\d.]+)" vector-effect="non-scaling-stroke"/g, (_, value: string) => `stroke-width="${Number(value) * scale}" vector-effect="non-scaling-stroke"`);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  const renderer = Canvg.fromString(context, sizedSvg, {
    DOMParser: DOMParser as unknown as NonNullable<Parameters<typeof Canvg.fromString>[2]>['DOMParser'],
    ignoreAnimation: true, ignoreMouse: true, ignoreDimensions: true, ignoreClear: true,
    fetch: async () => { throw new Error('External drawing resources are disabled'); },
  });
  await renderer.render();
  return encode();
}

/** Grouped drawings use a white page background. */
export function drawingToPng(svg: string, displayWidth: number, displayHeight: number): Promise<Uint8Array> {
  return svgToPng(svg, displayWidth, displayHeight, '#ffffff');
}
