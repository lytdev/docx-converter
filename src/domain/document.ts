export type Css = Record<string, string>;
export type HtmlAttributes = Record<string, string>;
export interface Annotation {
  id: string;
  text: string;
}
interface Annotated {
  annotations?: Annotation[];
}
export interface RunStyle {
  latin?: string; eastAsia?: string; size?: number; color?: string;
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  background?: string; vertical?: string;
}
export interface ParaStyle {
  css: Css; outline?: number; numId?: string; level?: number;
}
export interface TextNode extends Annotated { kind: 'text'; text: string; style: RunStyle; }
export interface ImageNode extends Annotated {
  kind: 'image'; path?: string; alt: string; width?: number; height?: number;
  formula: boolean; latex?: string; css: Css;
  /** Resolved display URL in the JSON output; absent when the image cannot be displayed. */
  src?: string;
  /** SVG constructed from supported chart data by the parser. */
  generatedSvg?: string;
  generatedKind?: 'drawing' | 'chart';
  /** HTML element attributes projected into JSON for renderer parity. */
  attributes?: HtmlAttributes;
}
export interface MathNode extends Annotated {
  kind: 'math'; mathml: string; latex?: string; display: boolean;
  /** Self-contained PNG or SVG data URL when formulaOutput is image and rendering succeeds. */
  src?: string;
  /** HTML element attributes projected into JSON for renderer parity. */
  attributes?: HtmlAttributes;
}
export interface LinkNode extends Annotated { kind: 'link'; url: string; children: Inline[]; }
export interface FootnoteNode extends Annotated { kind: 'footnote'; number: string; text: string; }
export type Inline = TextNode | ImageNode | MathNode | LinkNode | FootnoteNode
  | ({ kind: 'break' } & Annotated)
  | ({ kind: 'anchor'; id: string } & Annotated)
  | ({ kind: 'unsupported'; label: string } & Annotated);
export interface Paragraph {
  kind: 'paragraph'; style: ParaStyle; children: Inline[];
  list?: { id: string; level: number; format: string; start: number; text: string };
}
export interface Cell { blocks: Block[]; colspan: number; rowspan: number; css: Css; }
export interface Row { cells: Cell[]; css: Css; }
export interface Table { kind: 'table'; rows: Row[]; css: Css; caption?: Paragraph; }
export type Block = Paragraph | Table;
export interface DocumentModel { blocks: Block[]; }
export interface DocumentPageMetadata {
  size?: { width?: string; height?: string };
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
    header?: string;
    footer?: string;
    gutter?: string;
  };
}
export interface ThemeFonts {
  latin?: string;
  eastAsia?: string;
  bidi?: string;
}
export interface DocumentThemeMetadata {
  name?: string;
  colors: Record<string, string>;
  fonts: {
    major: ThemeFonts;
    minor: ThemeFonts;
  };
}
export interface DocumentMetadata {
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string;
  description?: string;
  lastModifiedBy?: string;
  created?: string;
  modified?: string;
  category?: string;
  contentStatus?: string;
  version?: string;
  revision?: string;
  language?: string;
  identifier?: string;
  source?: string;
  rights?: string;
  page?: DocumentPageMetadata;
  theme?: DocumentThemeMetadata;
  [name: string]: unknown;
}
