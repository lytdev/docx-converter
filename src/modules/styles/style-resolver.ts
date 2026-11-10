import type { Css, DocumentThemeMetadata, ParaStyle, RunStyle } from '../../domain/document.js';
import type { DiagnosticSink } from '../../contracts/ports.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';
import { attr, bool, child, children, descendants, is, NS, number, val } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import { color, pt, round2 } from '../../shared/units.js';
interface Style { id: string; parent?: string; type?: string; run: RunStyle; para: ParaStyle; table?: X; }
const cleanFont = (s?: string): string | undefined => s?.replace(/[;{}<>\r\n\\]/g, '').slice(0, 150) || undefined;

export class Styles {
  private raw = new Map<string, X>();
  private cache = new Map<string, Style>();
  private themeColors = new Map<string, string>();
  private themeFonts = new Map<string, string>();
  private themeName?: string;
  defaultRun: RunStyle = {};
  defaultPara: ParaStyle = { css: {} };
  defaultParaId?: string;
  constructor(pkg: PartReader, private readonly diagnostics: DiagnosticSink) {
    const themePath = pkg.related(pkg.main, 'theme');
    const theme = themePath ? pkg.xml(themePath)?.documentElement : undefined;
    this.themeName = theme?.getAttribute('name') || undefined;
    for (const c of children(descendants(theme, 'clrScheme', NS.a)[0])) {
      const v = children(c)[0]; const hex = color(v?.getAttribute('lastClr') || v?.getAttribute('val') || undefined);
      if (hex && c.localName) this.themeColors.set(c.localName, hex);
    }
    for (const kind of ['major', 'minor']) {
      const font = descendants(theme, `${kind}Font`, NS.a)[0];
      for (const [key, tag] of [['HAnsi', 'latin'], ['Ascii', 'latin'], ['EastAsia', 'ea'], ['Bidi', 'cs']]) {
        let name = child(font, tag, NS.a)?.getAttribute('typeface');
        if (!name && tag === 'ea') name = children(font).find(e => e.localName === 'font' && e.getAttribute('script') === 'Hans')?.getAttribute('typeface');
        if (name) this.themeFonts.set(`${kind}${key}`, name);
      }
    }
    const path = pkg.related(pkg.main, 'styles');
    const root = path ? pkg.xml(path)?.documentElement : undefined;
    const defaults = child(root, 'docDefaults');
    this.defaultRun = this.readRun(child(child(defaults, 'rPrDefault'), 'rPr'));
    this.defaultPara = this.readPara(child(child(defaults, 'pPrDefault'), 'pPr'));
    for (const el of children(root).filter(e => is(e, 'style'))) {
      const id = attr(el, 'styleId');
      if (!id) continue;
      this.raw.set(id, el);
      if (attr(el, 'type') === 'paragraph' && ['1', 'true'].includes(attr(el, 'default') ?? '')) this.defaultParaId = id;
    }
  }
  resolve(id?: string, trail = new Set<string>()): Style {
    const empty = { id: id ?? '', run: {}, para: { css: {} } };
    if (!id || !this.raw.has(id)) return empty;
    if (this.cache.has(id)) return this.cache.get(id)!;
    if (trail.has(id)) { this.diagnostics.report({ code: 'STYLE_CYCLE', message: `样式继承循环：${id}` }); return empty; }
    trail.add(id);
    const el = this.raw.get(id)!;
    const parent = this.resolve(val(child(el, 'basedOn')), trail);
    const para = this.readPara(child(el, 'pPr'));
    const style: Style = {
      id, parent: parent.id, type: attr(el, 'type'),
      run: { ...parent.run, ...this.readRun(child(el, 'rPr')) },
      para: { ...parent.para, ...para, css: { ...parent.para.css, ...para.css } },
      table: child(el, 'tblPr') ?? parent.table,
    };
    this.cache.set(id, style); return style;
  }
  resolveColor(el?: X, key = 'val'): string | undefined {
    const fill = key === 'fill';
    const theme = attr(el, fill ? 'themeFill' : 'themeColor');
    const aliases: Record<string, string> = { text1: 'dk1', text2: 'dk2', background1: 'lt1', background2: 'lt2' };
    let value = theme ? this.themeColors.get(aliases[theme] ?? theme) : undefined;
    const explicit = attr(el, key);
    // "auto" in a shading fill is not an explicit black background.
    // Keep the existing black fallback for automatic foreground text/borders.
    value ??= fill && explicit === 'auto' ? undefined : color(explicit);
    if (!value) return;
    const tint = attr(el, fill ? 'themeFillTint' : 'themeTint');
    const shade = attr(el, fill ? 'themeFillShade' : 'themeShade');
    if (tint || shade) {
      const t = tint && /^[\da-f]{2}$/i.test(tint) ? parseInt(tint, 16) / 255 : 0;
      const s = shade && /^[\da-f]{2}$/i.test(shade) ? parseInt(shade, 16) / 255 : 1;
      value = '#' + [1, 3, 5].map(i => Math.round((parseInt(value!.slice(i, i + 2), 16) * s) * (1 - t) + 255 * t).toString(16).padStart(2, '0')).join('');
    }
    return value;
  }
  themeColor(name?: string): string | undefined {
    if (!name) return;
    const aliases: Record<string, string> = { tx1: 'dk1', tx2: 'dk2', bg1: 'lt1', bg2: 'lt2' };
    return this.themeColors.get(aliases[name] ?? name);
  }
  documentTheme(): DocumentThemeMetadata {
    const fonts = (kind: 'major' | 'minor') => {
      const latin = this.themeFonts.get(`${kind}HAnsi`) ?? this.themeFonts.get(`${kind}Ascii`);
      const eastAsia = this.themeFonts.get(`${kind}EastAsia`);
      const bidi = this.themeFonts.get(`${kind}Bidi`);
      return {
        ...(latin ? { latin } : {}),
        ...(eastAsia ? { eastAsia } : {}),
        ...(bidi ? { bidi } : {}),
      };
    };
    return {
      ...(this.themeName ? { name: this.themeName } : {}),
      colors: Object.fromEntries(this.themeColors),
      fonts: { major: fonts('major'), minor: fonts('minor') },
    };
  }
  readRun(pr?: X): RunStyle {
    const out: RunStyle = {};
    const fonts = child(pr, 'rFonts');
    const latin = cleanFont(this.themeFonts.get(attr(fonts, 'asciiTheme') ?? attr(fonts, 'hAnsiTheme') ?? '') ?? attr(fonts, 'ascii') ?? attr(fonts, 'hAnsi'));
    const east = cleanFont(this.themeFonts.get(attr(fonts, 'eastAsiaTheme') ?? '') ?? attr(fonts, 'eastAsia'));
    if (latin) out.latin = latin;
    if (east) out.eastAsia = east;
    const size = val(child(pr, 'sz'));
    if (size !== undefined && number(size) > 0) out.size = Math.min(number(size) / 2, 1000);
    const c = this.resolveColor(child(pr, 'color')); if (c) out.color = c;
    for (const [tag, key] of [['b', 'bold'], ['i', 'italic'], ['u', 'underline'], ['strike', 'strike']] as const) {
      const b = bool(child(pr, tag)); if (b !== undefined) out[key] = b;
    }
    const highlight = val(child(pr, 'highlight'));
    const highlights: Record<string, string> = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff' };
    const bg = highlight === 'none' ? 'transparent' : highlights[highlight ?? ''] ?? this.resolveColor(child(pr, 'shd'), 'fill');
    if (bg) out.background = bg;
    const vertical = val(child(pr, 'vertAlign')); if (vertical) out.vertical = vertical;
    return out;
  }
  readPara(pr?: X): ParaStyle {
    const out: ParaStyle = { css: {} };
    const css = out.css;
    const alignment = val(child(pr, 'jc'));
    const align: Record<string, string> = { left: 'left', right: 'right', center: 'center', both: 'justify', distribute: 'justify', start: 'start', end: 'end' };
    if (alignment && align[alignment]) css['text-align'] = align[alignment];
    const outline = val(child(pr, 'outlineLvl')); if (outline !== undefined) out.outline = number(outline, 9);
    const ind = child(pr, 'ind');
    for (const [keys, key] of [[['start', 'left'], 'margin-left'], [['end', 'right'], 'margin-right']] as const) {
      const v = attr(ind, keys[0]) ?? attr(ind, keys[1]); if (v !== undefined) css[key] = pt(number(v) / 20);
    }
    const firstChars = attr(ind, 'firstLineChars'), hangingChars = attr(ind, 'hangingChars');
    if (hangingChars !== undefined) css['text-indent'] = `${round2(-number(hangingChars) / 100)}em`;
    else if (firstChars !== undefined) css['text-indent'] = `${round2(number(firstChars) / 100)}em`;
    else if (attr(ind, 'hanging') !== undefined) css['text-indent'] = pt(-number(attr(ind, 'hanging')) / 20);
    else if (attr(ind, 'firstLine') !== undefined) css['text-indent'] = pt(number(attr(ind, 'firstLine')) / 20);
    const spacing = child(pr, 'spacing');
    for (const [a, k] of [['before', 'margin-top'], ['after', 'margin-bottom']]) if (attr(spacing, a) !== undefined) css[k] = pt(number(attr(spacing, a)) / 20);
    const line = attr(spacing, 'line');
    if (line !== undefined) css['line-height'] = attr(spacing, 'lineRule') === 'auto' || !attr(spacing, 'lineRule') ? String(round2(number(line) / 240)) : pt(number(line) / 20);
    const num = child(pr, 'numPr');
    if (val(child(num, 'numId')) !== undefined) out.numId = val(child(num, 'numId'));
    if (val(child(num, 'ilvl')) !== undefined) out.level = Math.min(8, Math.max(0, number(val(child(num, 'ilvl')))));
    return out;
  }
  paragraph(pr?: X): { run: RunStyle; para: ParaStyle } {
    const base = this.resolve(val(child(pr, 'pStyle')) ?? this.defaultParaId);
    const own = this.readPara(pr);
    return { run: { ...this.defaultRun, ...base.run }, para: { ...this.defaultPara, ...base.para, ...own, css: { ...this.defaultPara.css, ...base.para.css, ...own.css } } };
  }
  run(pr: X | undefined, paragraph: RunStyle): RunStyle {
    const style = this.resolve(val(child(pr, 'rStyle')));
    return { ...paragraph, ...style.run, ...this.readRun(pr) };
  }
  borders(el?: X): Css {
    const css: Css = {};
    for (const side of ['top', 'bottom', 'left', 'right', 'insideH', 'insideV']) {
      const b = child(el, side) ?? (side === 'left' ? child(el, 'start') : side === 'right' ? child(el, 'end') : undefined);
      if (!b) continue;
      const type = val(b);
      const styles: Record<string, string> = { single: 'solid', double: 'double', dotted: 'dotted', dashed: 'dashed', dashSmallGap: 'dashed', dotDash: 'dashed', triple: 'double' };
      css[side] = type === 'nil' || type === 'none' ? 'none' : `${pt(Math.max(0, number(attr(b, 'sz'), 4)) / 8)} ${styles[type ?? ''] ?? 'solid'} ${this.resolveColor(b, 'color') ?? '#000000'}`;
    }
    return css;
  }
}
