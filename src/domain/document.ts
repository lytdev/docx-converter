export type Css = Record<string, string>;
export interface RunStyle {
  latin?: string; eastAsia?: string; size?: number; color?: string;
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  background?: string; vertical?: string;
}
export interface ParaStyle {
  css: Css; outline?: number; numId?: string; level?: number;
}
export interface TextNode { kind: 'text'; text: string; style: RunStyle; }
export interface ImageNode {
  kind: 'image'; path?: string; alt: string; width?: number; height?: number;
  formula: boolean; latex?: string; css: Css;
}
export interface MathNode { kind: 'math'; mathml: string; latex?: string; display: boolean; }
export interface LinkNode { kind: 'link'; url: string; children: Inline[]; }
export type Inline = TextNode | ImageNode | MathNode | LinkNode | { kind: 'break' } | { kind: 'anchor'; id: string } | { kind: 'unsupported'; label: string };
export interface Paragraph {
  kind: 'paragraph'; style: ParaStyle; children: Inline[];
  list?: { id: string; level: number; format: string; start: number; text: string };
}
export interface Cell { blocks: Block[]; colspan: number; rowspan: number; css: Css; }
export interface Row { cells: Cell[]; css: Css; }
export interface Table { kind: 'table'; rows: Row[]; css: Css; caption?: Paragraph; }
export type Block = Paragraph | Table;
export interface DocumentModel { blocks: Block[]; }
