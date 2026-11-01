/** HTTP(S) URL, browser File/Blob, ArrayBuffer or Node Buffer (a Uint8Array). */
export type DocxInput = Blob | ArrayBuffer | Uint8Array | string;
export interface Diagnostic { code: string; message: string; part?: string; }
export interface ProgressEvent {
  stage: 'reading' | 'extracting' | 'parsing' | 'rendering' | 'complete';
  completed?: number; total?: number;
}
export interface Resource {
  path: string; mimeType: string; bytes: Uint8Array;
}
export interface ImageContext extends Resource { alt: string; formula: boolean; }
export interface ImageResult { bytes: Uint8Array; mimeType: string; }
export interface ProcessedImage { fileUrl: string; fileSize?: number; fileName?: string; }
export type LargeImageHandler = (fileBlob: Blob, fileSuffix: string, fileName: string) => ProcessedImage | Promise<ProcessedImage>;
export interface ConversionLimits {
  inputBytes: number; totalBytes: number; entryBytes: number; entries: number; xmlDepth: number;
}
export interface ConversionOptions {
  output?: 'document' | 'fragment';
  /** Default image: embed self-contained SVG for OMML; mathml keeps the prior semantic markup. */
  formulaOutput?: 'image' | 'mathml';
  /** Word grouped drawings: PNG (default, 3x display resolution) or SVG. */
  drawingOutput?: 'png' | 'svg';
  title?: string;
  imageHandler?: {
    /** Defaults to 2048 bytes (2 KB). Images at or below the threshold stay Base64 even with processLargeImage; larger ones use that callback when supplied. */
    base64ImageSize?: number;
    /** Receives the final displayable image after any format conversion; its fileUrl becomes <img src>. */
    processLargeImage?: LargeImageHandler;
    /** Called only for browser-supported raster formats. Returned URLs are checked. */
    resolve?: (image: ImageContext) => string | Promise<string>;
    /** Override or extend built-in EMF handling; return PNG/JPEG/GIF/WebP bytes for WMF/TIFF/SVG etc. */
    convert?: (image: ImageContext) => ImageResult | undefined | Promise<ImageResult | undefined>;
  };
  onProgress?: (event: ProgressEvent) => void;
  signal?: AbortSignal;
  limits?: Partial<ConversionLimits>;
}
export interface ConversionResult {
  html: string;
  warnings: Diagnostic[];
  /** Includes unsupported original images and embedded OLE files for caller recovery. */
  resources: Resource[];
  stats: { paragraphs: number; tables: number; images: number; formulas: number; };
}
export interface PdfConversionOptions extends ConversionOptions {
  pdf?: {
    format?: 'a4' | 'letter';
    landscape?: boolean;
    /** Page margins in millimeters. Default 15. */
    margin?: number;
    /** Browser rasterization scale, default 2 (1–4). */
    scale?: number;
    /** Node only: local Chrome/Edge executable; omitted uses installed Chrome. */
    executablePath?: string;
  };
}
export interface PdfConversionResult extends Omit<ConversionResult, 'html'> {
  bytes: Uint8Array;
  mimeType: 'application/pdf';
}
