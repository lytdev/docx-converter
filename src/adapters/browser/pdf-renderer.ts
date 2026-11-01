import type { PdfConversionOptions } from '../../contracts/conversion.js';
import { DocxError } from '../../contracts/errors.js';

/**
 * Browser canvases silently render blank above a size limit (Chrome: 65535 px
 * per side; iOS Safari: ~16.7M px area). html2pdf.js draws the whole document
 * into one canvas, so long documents produced all-white PDFs. We keep html2pdf
 * for cloning + page-break layout, but rasterize page-aligned chunks that stay
 * below every browser's limit. Each chunk re-clones the page, so chunks are
 * kept as large as safely possible.
 */
const MAX_CANVAS_SIDE = 32767; // Firefox / Safari per-side limit
function maxCanvasArea(): number {
  const nav = (globalThis as { navigator?: { userAgent?: string; maxTouchPoints?: number } }).navigator;
  const ua = nav?.userAgent ?? '';
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
  return iOS ? 16_000_000 : 120_000_000; // iOS WebKit: 16.7M px; Firefox: ~124M px
}

interface Element2D { getBoundingClientRect(): { width: number; height: number }; scrollHeight: number }
interface PageSize { inner: { width: number; height: number; ratio: number } }
interface JsPdf { addPage(): void }

/** Browser PDF pages contain rasterized HTML; no document scripts are executed. */
export async function renderPdf(html: string, options: PdfConversionOptions): Promise<Uint8Array> {
  const [{ default: html2pdf }, { default: html2canvas }] = await Promise.all([import('html2pdf.js'), import('html2canvas')]);
  const worker = html2pdf();
  type Source = Parameters<typeof worker.from>[0];
  interface Frame {
    setAttribute(name: string, value: string): void;
    style: { cssText: string }; onload: (() => void) | null; srcdoc: string; remove(): void;
    contentDocument: { fonts: { ready: Promise<unknown> }; images: { decode(): Promise<void> }[]; querySelector(selector: string): Source };
  }
  const host = (globalThis as unknown as { document: { createElement(name: string): Frame; body: { append(frame: Frame): void } } }).document;
  const frame = host.createElement('iframe');
  // html2pdf clones the srcdoc into a temporary frame and injects its renderer.
  // The sandbox must allow that library script; the document CSP still blocks
  // scripts embedded in the generated DOCX HTML itself.
  frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
  frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:900px;height:1000px;border:0';
  const check = () => { if (options.signal?.aborted) throw new DocxError('ABORTED', '转换已取消'); };
  let overlay: { remove(): void } | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new DocxError('PDF_TIMEOUT', 'PDF 预览加载超时')), 30000);
      frame.onload = () => { clearTimeout(timer); resolve(); };
      frame.srcdoc = html; host.body.append(frame);
    });
    check();
    const doc = frame.contentDocument!;
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(image => image.decode()));
    check();
    const pdf = options.pdf ?? {};
    const scale = pdf.scale ?? 2;
    const canvasOptions = { scale, useCORS: true, backgroundColor: '#ffffff', logging: false };
    const job = worker.set({
      margin: pdf.margin ?? 15,
      html2canvas: canvasOptions,
      jsPDF: { unit: 'mm', format: pdf.format ?? 'a4', orientation: pdf.landscape ? 'landscape' : 'portrait' },
      ...{ pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'img'] } },
    }).from(doc.querySelector('.docx-document')!);
    // Clone into html2pdf's container (applies page-break spacers and records links).
    await job.toContainer();
    const get = <T>(key: string) => job.get(key) as unknown as Promise<T>;
    const container = await get<Parameters<typeof html2canvas>[0] & Element2D>('container');
    overlay = await get<{ remove(): void }>('overlay');
    const pageSize = await get<PageSize>('pageSize');
    check();

    const width = Math.ceil(container.getBoundingClientRect().width);
    const totalHeight = Math.max(1, Math.ceil(Math.max(container.scrollHeight, container.getBoundingClientRect().height)));
    const canvasWidth = Math.floor(width * scale);
    // Same page height (in canvas px) that html2pdf's toPdf() slices by.
    const pagePx = Math.floor(canvasWidth * pageSize.inner.ratio);
    const pageCss = pagePx / scale;
    const totalPages = Math.max(1, Math.ceil(totalHeight / pageCss - 1e-6));
    const perChunk = Math.max(1, Math.min(Math.floor(MAX_CANVAS_SIDE / pagePx), Math.floor(maxCanvasArea() / (canvasWidth * pagePx))));

    for (let first = 0; first < totalPages; first += perChunk) {
      check();
      const last = first + perChunk >= totalPages;
      const y = first * pageCss;
      const height = last ? totalHeight - y : perChunk * pageCss;
      const canvas = await html2canvas(container, { ...canvasOptions, x: 0, y, width, height });
      check();
      if (first > 0) await job.get('pdf', (doc: JsPdf) => doc.addPage());
      // Links are recorded for the whole document; attach them once, after the last chunk.
      await job.set({ canvas, enableLinks: last } as unknown as Parameters<typeof job.set>[0]).toPdf();
      canvas.width = canvas.height = 0; // release the chunk's backing store early
    }
    check();
    const bytes = await job.outputPdf('arraybuffer');
    check();
    return new Uint8Array(bytes);
  } finally { overlay?.remove(); frame.remove(); }
}
