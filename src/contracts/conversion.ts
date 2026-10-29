/** Browser File/Blob and Node Buffer (a Uint8Array) are accepted. */
export type DocxInput = Blob | ArrayBuffer | Uint8Array;
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
  title?: string;
  images?: {
    /** Byte threshold for processLargeImage; equal-sized images stay inline. Requires processLargeImage to offload. */
    maxInlineBytes?: number;
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
