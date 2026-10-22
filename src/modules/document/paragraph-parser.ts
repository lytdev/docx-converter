import type { Paragraph, Inline, RunStyle } from '../../domain/document.js';
import { child } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { ParseContext } from './parse-context.js';
import { pt } from '../../shared/units.js';
export function parseParagraph(el: X, context: ParseContext, parseInlines: (el: X, style: RunStyle) => Inline[]): Paragraph {
  context.stats.paragraphs++;
  const pr = child(el, 'pPr');
  const resolved = context.styles.paragraph(pr);
  const p: Paragraph = { kind: 'paragraph', style: resolved.para, children: [] };
  // Apply paragraph font baseline also to MathML and empty paragraphs.
  if (resolved.run.size) p.style.css['font-size'] = pt(resolved.run.size);
  p.children = parseInlines(el, resolved.run);
  if (p.style.numId && p.style.numId !== '0') {
    const level = p.style.level ?? 0, spec = context.numbering.get(p.style.numId, level);
    if (spec) {
      p.list = { id: p.style.numId, level, ...spec };
      if (!['bullet', 'decimal', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman', 'none'].includes(spec.format) || /%\d.*%\d/.test(spec.text))
        context.operations.warn('LIST_FORMAT', '复杂列表编号文本使用浏览器列表标记近似显示');
    } else context.operations.warn('MISSING_NUMBERING', `未找到编号定义 ${p.style.numId}/${level}`);
  }
  return p;
}
