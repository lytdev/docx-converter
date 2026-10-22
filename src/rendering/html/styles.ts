import type { Css, RunStyle } from '../../domain/document.js';
import { esc } from '../../shared/markup.js';
import { pt } from '../../shared/units.js';
const cssText = (css: Css) => Object.entries(css).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}:${v}`).join(';');
export const styleAttr = (css: Css) => Object.keys(css).length ? ` style="${esc(cssText(css))}"` : '';

const fontName = (s: string) => `"${s.replace(/["\\;{}<>\r\n]/g, '')}"`;
export const cjk = (s: string) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u.test(s);
export function textCss(style: RunStyle, east: boolean): Css {
  const css: Css = {};
  const fonts = (east ? [style.eastAsia, style.latin] : [style.latin, style.eastAsia]).filter((s): s is string => !!s);
  if (fonts.length) css['font-family'] = [...new Set(fonts)].map(fontName).join(',');
  if (style.size) css['font-size'] = pt(style.size);
  if (style.color) css.color = style.color;
  if (style.bold !== undefined) css['font-weight'] = style.bold ? 'bold' : 'normal';
  if (style.italic !== undefined) css['font-style'] = style.italic ? 'italic' : 'normal';
  if (style.underline !== undefined || style.strike !== undefined) css['text-decoration'] = [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none';
  if (style.background) css['background-color'] = style.background;
  if (style.vertical === 'superscript' || style.vertical === 'subscript') { css['vertical-align'] = style.vertical === 'superscript' ? 'super' : 'sub'; css['font-size'] = style.size ? pt(style.size * .75) : '75%'; }
  if (style.vertical === 'baseline') css['vertical-align'] = 'baseline';
  return css;
}
