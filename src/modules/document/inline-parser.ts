import type { Inline, RunStyle } from '../../domain/document.js';
import { convertMath } from '../math/omml-converter.js';
import { oleEquationLatex } from '../math/ole-equation.js';
import { previewConflicts } from '../math/preview-consistency.js';
import type { DrawingParser } from './drawing-parser.js';
import { attr, child, children, descendants, is, NS } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { ParseContext } from './parse-context.js';
export class InlineParser {
  constructor(private readonly context: ParseContext, private readonly drawings: DrawingParser) {}
  parse(el: X, inherited: RunStyle): Inline[] {
    return children(el).flatMap(n => this.inline(n, inherited));
  }
  private inline(el: X, inherited: RunStyle): Inline[] {
    if (is(el, 'r')) return this.parse(el, this.context.styles.run(child(el, 'rPr'), inherited));
    if (is(el, 't')) return [{ kind: 'text', text: el.textContent ?? '', style: { ...inherited } }];
    if (is(el, 'tab')) return [{ kind: 'text', text: '\t', style: { ...inherited } }];
    if (is(el, 'br') || is(el, 'cr')) return [{ kind: 'break' }];
    if (is(el, 'noBreakHyphen')) return [{ kind: 'text', text: '‑', style: { ...inherited } }];
    if (is(el, 'softHyphen')) return [{ kind: 'text', text: '\u00ad', style: { ...inherited } }];
    if (is(el, 'hyperlink')) {
      const id = attr(el, 'id', NS.r), anchor = attr(el, 'anchor');
      const rel = id ? this.context.source.relationships(this.context.source.main).get(id) : undefined;
      return [{ kind: 'link', url: anchor ? `#bookmark-${anchor}` : rel?.external ? rel.target : '', children: this.parse(el, inherited) }];
    }
    if (is(el, 'bookmarkStart')) {
      const name = attr(el, 'name'); return name ? [{ kind: 'anchor', id: `bookmark-${name}` }] : [];
    }
    if (is(el, 'oMath', NS.m) || is(el, 'oMathPara', NS.m)) {
      this.context.stats.formulas++;
      return [convertMath(el, this.context.operations, is(el, 'oMathPara', NS.m), inherited)];
    }
    if (is(el, 'drawing') || is(el, 'pict')) return this.drawings.parse(el, false);
    if (is(el, 'object')) {
      const ole = descendants(el, 'OLEObject', NS.o)[0];
      const id = attr(ole, 'id', NS.r);
      const rel = id ? this.context.source.relationships(this.context.source.main).get(id) : undefined;
      const olePath = rel && !rel.external && rel.type.endsWith('/oleObject')
        ? this.context.source.resolve(this.context.source.main, rel.target) : undefined;
      if (olePath) this.context.resources.add(olePath);
      const progId = ole?.getAttribute('ProgID') ?? '';
      const formula = /Equation|MathType/i.test(progId);
      if (formula) this.context.stats.formulas++;
      const images = this.drawings.parse(el, formula);
      if (formula) {
        const latex = oleEquationLatex(olePath ? this.context.source.bytes(olePath) : undefined);
        if (!latex) this.context.operations.warn('OLE_LATEX_UNAVAILABLE', '部分 OLE 公式缺少可解析的 MTEF；已保留预览图，不生成 data-latex');
        else for (const image of images) if (image.kind === 'image') {
          if (image.path?.toLowerCase().endsWith('.wmf') && previewConflicts(this.context.source.bytes(image.path), latex))
            this.context.operations.warn('OLE_PREVIEW_MISMATCH', 'OLE 公式的可编辑数据与预览图明显不符；已省略 data-latex');
          else image.latex = latex;
        }
      } else this.context.operations.warn('OLE_OBJECT', '嵌入对象只显示文档中的预览图，不执行 OLE');
      return images.length ? images : [{ kind: 'unsupported', label: formula ? '[旧版公式：无可用预览]' : '[嵌入对象：无可用预览]' }];
    }
    if (is(el, 'AlternateContent', NS.mc)) {
      const choices = children(el).filter(e => e.namespaceURI === NS.mc);
      // Prefer a branch with a raster image or OMML; don't duplicate Choice and Fallback.
      const supported = choices.find(e => descendants(e, 'blip', NS.a).length || descendants(e, 'oMath', NS.m).length)
        ?? child(el, 'Fallback', NS.mc) ?? choices[0];
      return supported ? this.parse(supported, inherited) : [];
    }
    if (is(el, 'sdt')) { const content = child(el, 'sdtContent'); return content ? this.parse(content, inherited) : []; }
    if (is(el, 'del') || is(el, 'moveFrom')) { this.context.operations.warn('TRACKED_CHANGES', '修订按接受后的内容显示，删除内容已省略'); return []; }
    if (is(el, 'ins') || is(el, 'moveTo') || is(el, 'smartTag') || is(el, 'customXml')) return this.parse(el, inherited);
    if (is(el, 'fldSimple')) { this.context.operations.warn('FIELD_RESULT', '域使用文档中保存的结果，不重新计算'); return this.parse(el, inherited); }
    if (is(el, 'instrText') || is(el, 'fldChar')) { this.context.operations.warn('FIELD_RESULT', '域使用文档中保存的结果，不重新计算'); return []; }
    if (is(el, 'sym')) {
      const code = attr(el, 'char'), font = attr(el, 'font');
      this.context.operations.warn('SYMBOL_FONT', '符号字体字符需本机安装对应字体，请核对显示效果');
      return code && /^[\da-f]{1,6}$/i.test(code) && parseInt(code, 16) <= 0x10ffff ? [{ kind: 'text', text: String.fromCodePoint(parseInt(code, 16)), style: { ...inherited, latin: font } }] : [];
    }
    if (['pPr', 'rPr', 'bookmarkEnd', 'proofErr', 'lastRenderedPageBreak', 'commentRangeStart', 'commentRangeEnd', 'permStart', 'permEnd'].includes(el.localName ?? '')) return [];
    this.context.operations.warn('UNSUPPORTED_INLINE', `未完整支持的行内结构：${el.localName}`);
    return this.parse(el, inherited);
  }

}
