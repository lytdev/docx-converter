import { attr, bool, child, children, is, NS } from '../../infrastructure/xml/dom.js';
import { esc } from '../../shared/markup.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { MathNode, RunStyle } from '../../domain/document.js';
import type { DiagnosticSink } from '../../contracts/ports.js';
import { color, pt } from '../../shared/units.js';

interface Expression { ml: string; tex: string; }
const texText = (s: string): string => s.replace(/[\\{}$%&#_^~]/g, c => ({ '\\': '\\backslash ', '~': '\\sim ', '^': '\\hat{}' }[c] ?? `\\${c}`));
const symbols: Record<string, string> = { 'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\epsilon ', 'θ': '\\theta ', 'λ': '\\lambda ', 'μ': '\\mu ', 'π': '\\pi ', 'σ': '\\sigma ', 'φ': '\\phi ', 'ω': '\\omega ', 'Δ': '\\Delta ', 'Σ': '\\Sigma ', 'Ω': '\\Omega ', '∞': '\\infty ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '±': '\\pm ', '×': '\\times ', '÷': '\\div ', '∑': '\\sum ', '∏': '\\prod ', '∫': '\\int ', '∂': '\\partial ', '∈': '\\in ', '→': '\\to ' };
const latex = (s: string): string => [...s].map(c => /\s/.test(c) ? '\\ ' : symbols[c] ?? texText(c)).join('');
export function convertMath(root: X, diagnostics: DiagnosticSink, display = false, inherited: RunStyle = {}): MathNode {
  let complete = true;
  const c = (e: X | undefined, name: string) => child(e, name, NS.m);
  const mv = (e?: X) => attr(e, 'val', NS.m);
  const join = (items: Expression[]): Expression => ({ ml: items.map(x => x.ml).join(''), tex: items.map(x => x.tex).join('') });
  const content = (e?: X): Expression => join(children(e).filter(n => !n.localName?.endsWith('Pr')).map(convert));
  const arg = (e: X, name: string): Expression => content(c(e, name));
  const row = (a: Expression) => `<mrow>${a.ml}</mrow>`;
  function convert(e: X): Expression {
    if (e.namespaceURI !== NS.m) return { ml: '', tex: '' };
    const tag = e.localName ?? '';
    if (tag.endsWith('Pr')) return { ml: '', tex: '' };
    if (['oMath', 'oMathPara', 'e', 'num', 'den', 'sub', 'sup', 'deg', 'lim', 'fName'].includes(tag)) return content(e);
    if (tag === 'r') {
      const text = children(e).filter(n => is(n, 't', NS.m)).map(n => n.textContent ?? '').join('');
      const pr = c(e, 'rPr'), wpr = child(e, 'rPr');
      const normal = !!c(pr, 'nor'), style = mv(c(pr, 'sty'));
      const bold = style ? ['b', 'bi'].includes(style) : bool(child(wpr, 'b')) === true;
      const italic = style ? ['i', 'bi'].includes(style) : normal ? bool(child(wpr, 'i')) === true : bool(child(wpr, 'i')) !== false;
      const variant = bold ? italic ? 'bold-italic' : 'bold' : italic ? 'italic' : 'normal';
      const font = attr(child(wpr, 'rFonts'), 'ascii') ?? attr(child(wpr, 'rFonts'), 'hAnsi');
      const size = Number(attr(child(wpr, 'sz'), 'val')) / 2;
      const runColor = color(attr(child(wpr, 'color'), 'val'));
      const css = [font ? `font-family:"${font.replace(/["\\;{}<>\r\n]/g, '')}"` : '', size > 0 && size <= 1000 ? `font-size:${pt(size)}` : '', runColor ? `color:${runColor}` : ''].filter(Boolean).join(';');
      const wrap = (s: string) => css ? `<mstyle style="${esc(css)}">${s}</mstyle>` : s;
      if (normal) return { ml: wrap(`<mtext mathvariant="${variant}">${esc(text)}</mtext>`), tex: `\\text{${texText(text)}}` };
      const tokens = text.match(/\d+(?:\.\d+)?|[\p{L}\p{M}]+|\s+|./gu) ?? [];
      return { ml: wrap(tokens.map(t => /^\s+$/.test(t) ? `<mspace width="${t.length * 0.25}em"/>` : /^\d/.test(t) ? `<mn>${esc(t)}</mn>` : /^[\p{L}\p{M}]/u.test(t) ? `<mi mathvariant="${variant}">${esc(t)}</mi>` : `<mo>${esc(t)}</mo>`).join('')), tex: bold ? `\\mathbf{${latex(text)}}` : latex(text) };
    }
    if (tag === 'f') {
      const a = arg(e, 'num'), b = arg(e, 'den'), type = mv(c(c(e, 'fPr'), 'type'));
      return { ml: `<mfrac${type === 'noBar' ? ' linethickness="0"' : type === 'skw' ? ' bevelled="true"' : ''}>${row(a)}${row(b)}</mfrac>`, tex: type === 'noBar' ? `\\genfrac{}{}{0pt}{}{${a.tex}}{${b.tex}}` : `\\frac{${a.tex}}{${b.tex}}` };
    }
    if (['sSub', 'sSup', 'sSubSup', 'sPre'].includes(tag)) {
      const a = arg(e, 'e'), sub = arg(e, 'sub'), sup = arg(e, 'sup');
      if (tag === 'sPre') return { ml: `<mmultiscripts>${row(a)}<mprescripts/>${row(sub)}${row(sup)}</mmultiscripts>`, tex: `{}_{${sub.tex}}^{${sup.tex}}{${a.tex}}` };
      const mlTag = { sSub: 'msub', sSup: 'msup', sSubSup: 'msubsup' }[tag]!;
      return { ml: `<${mlTag}>${row(a)}${tag !== 'sSup' ? row(sub) : ''}${tag !== 'sSub' ? row(sup) : ''}</${mlTag}>`, tex: `{${a.tex}}${tag !== 'sSup' ? `_{${sub.tex}}` : ''}${tag !== 'sSub' ? `^{${sup.tex}}` : ''}` };
    }
    if (tag === 'rad') {
      const a = arg(e, 'e'), degree = arg(e, 'deg');
      const hidden = mv(c(c(e, 'radPr'), 'degHide'));
      const root = degree.tex && !['1', 'true', 'on'].includes(hidden ?? '');
      return { ml: root ? `<mroot>${row(a)}${row(degree)}</mroot>` : `<msqrt>${row(a)}</msqrt>`, tex: `\\sqrt${root ? `[${degree.tex}]` : ''}{${a.tex}}` };
    }
    if (tag === 'nary') {
      const pr = c(e, 'naryPr'), op = mv(c(pr, 'chr')) ?? '∫';
      const a = arg(e, 'e'), sub = arg(e, 'sub'), sup = arg(e, 'sup');
      const showSub = !['1', 'true', 'on'].includes(mv(c(pr, 'subHide')) ?? '') && !!sub.ml;
      const showSup = !['1', 'true', 'on'].includes(mv(c(pr, 'supHide')) ?? '') && !!sup.ml;
      const side = mv(c(pr, 'limLoc')) === 'subSup';
      const wrap = showSub && showSup ? side ? 'msubsup' : 'munderover' : showSub ? side ? 'msub' : 'munder' : showSup ? side ? 'msup' : 'mover' : '';
      const operator = `<mo largeop="true" movablelimits="false">${esc(op)}</mo>`;
      return { ml: `<mrow>${wrap ? `<${wrap}>` : ''}${operator}${showSub ? row(sub) : ''}${showSup ? row(sup) : ''}${wrap ? `</${wrap}>` : ''}${a.ml}</mrow>`, tex: `${latex(op)}${showSub ? `_{${sub.tex}}` : ''}${showSup ? `^{${sup.tex}}` : ''}{${a.tex}}` };
    }
    if (tag === 'd') {
      const pr = c(e, 'dPr'), open = mv(c(pr, 'begChr')) ?? '(', close = mv(c(pr, 'endChr')) ?? ')', sep = mv(c(pr, 'sepChr')) ?? '|';
      const parts = children(e).filter(n => is(n, 'e', NS.m)).map(content);
      const delimiter = (s: string) => s === '' ? '.' : latex(s);
      return { ml: `<mrow><mo stretchy="true">${esc(open)}</mo>${parts.map(row).join(`<mo stretchy="true">${esc(sep)}</mo>`)}<mo stretchy="true">${esc(close)}</mo></mrow>`, tex: `\\left${delimiter(open)} ${parts.map(p => p.tex).join(`\\middle${delimiter(sep)} `)} \\right${delimiter(close)}` };
    }
    if (tag === 'm' || tag === 'eqArr') {
      const rows = tag === 'm' ? children(e).filter(n => is(n, 'mr', NS.m)).map(r => children(r).filter(n => is(n, 'e', NS.m)).map(content)) : children(e).filter(n => is(n, 'e', NS.m)).map(n => [content(n)]);
      if (tag === 'm') {
        // OMML column properties apply to `count` successive columns. Missing
        // properties use the Word default (center), not an inferred equation layout.
        const columnCount = Math.max(1, ...rows.map(r => r.length));
        const alignments: string[] = [];
        for (const column of children(c(c(e, 'mPr'), 'mcs')).filter(n => is(n, 'mc', NS.m))) {
          const pr = c(column, 'mcPr'), value = mv(c(pr, 'mcJc'));
          const align = value === 'left' || value === 'right' ? value : 'center';
          const count = Number(mv(c(pr, 'count')) ?? 1);
          if (Number.isSafeInteger(count) && count > 0) {
            const repeat = Math.min(count, columnCount - alignments.length);
            for (let i = 0; i < repeat; i++) alignments.push(align);
          }
        }
        while (alignments.length < columnCount) alignments.push('center');
        // A common Word layout uses spaces in a one-column matrix to indent
        // continuation equations. Font-dependent spaces cannot preserve that
        // intent in SVG: split only this narrow pattern at its top-level '='.
        if (columnCount === 1 && alignments[0] === 'left' && rows.length > 1) {
          const cells = children(e).filter(n => is(n, 'mr', NS.m)).map(r => c(r, 'e')!);
          const split = cells.map(cell => {
            const parts = children(cell).filter(n => !n.localName?.endsWith('Pr'));
            const index = parts.findIndex(n => is(n, 'r', NS.m) && (c(n, 't')?.textContent ?? '').includes('='));
            if (index < 0) return undefined;
            const run = parts[index], texts = children(run).filter(n => is(n, 't', NS.m));
            if (texts.length !== 1) return undefined;
            const text = texts[0].textContent ?? '', at = text.indexOf('=');
            const fragment = (value: string): X => {
              const copy = run.cloneNode(true) as X;
              c(copy, 't')!.textContent = value;
              return copy;
            };
            const before = [...parts.slice(0, index), fragment(text.slice(0, at))];
            const after = [fragment(text.slice(at)), ...parts.slice(index + 1)];
            const whitespaceOnly = before.every(n => is(n, 'r', NS.m) && children(n).filter(t => is(t, 't', NS.m)).every(t => !t.textContent?.trim()));
            return { before, after, whitespaceOnly, indented: before.some(n => /\s/.test(c(n, 't')?.textContent ?? '')) };
          });
          if (split[0] && !split[0].whitespaceOnly && split.slice(1).every(s => s?.whitespaceOnly && s.indented)) {
            const aligned = split.map((s, i) => [i === 0 ? join(s!.before.map(convert)) : { ml: '', tex: '' }, join(s!.after.map(convert))]);
            return {
              ml: `<mtable columnalign="right left" columnspacing="0em">${aligned.map(r => `<mtr>${r.map(a => `<mtd><mrow>${a.ml}</mrow></mtd>`).join('')}</mtr>`).join('')}</mtable>`,
              tex: `\\begin{aligned}${aligned.map(r => r.map(a => a.tex).join('&')).join('\\\\')}\\end{aligned}`,
            };
          }
        }
        const body = rows.map(r => r.map(a => a.tex).join('&')).join('\\\\');
        const centered = alignments.every(a => a === 'center');
        return {
          ml: `<mtable columnalign="${alignments.join(' ')}">${rows.map(r => `<mtr>${r.map(a => `<mtd>${a.ml}</mtd>`).join('')}</mtr>`).join('')}</mtable>`,
          tex: centered ? `\\begin{matrix}${body}\\end{matrix}` : `\\begin{array}{${alignments.map(a => a[0]).join('')}}${body}\\end{array}`,
        };
      }
      return { ml: `<mtable>${rows.map(r => `<mtr>${r.map(a => `<mtd>${a.ml}</mtd>`).join('')}</mtr>`).join('')}</mtable>`, tex: `\\begin{aligned}${rows.map(r => r.map(a => a.tex).join('&')).join('\\\\')}\\end{aligned}` };
    }
    if (['acc', 'bar', 'groupChr'].includes(tag)) {
      const a = arg(e, 'e'), pr = c(e, `${tag}Pr`), bottom = mv(c(pr, 'pos')) === 'bot';
      const mark = mv(c(pr, 'chr')) ?? (tag === 'bar' ? '¯' : tag === 'groupChr' ? '⏟' : '̂');
      const name = bottom ? 'munder' : 'mover';
      const commands: Record<string, string> = { '̂': 'hat', '̃': 'tilde', '̇': 'dot', '̈': 'ddot', '⃗': 'vec', '¯': bottom ? 'underline' : 'overline', '⏞': 'overbrace', '⏟': 'underbrace' };
      return { ml: `<${name} ${bottom ? 'accentunder' : 'accent'}="true">${row(a)}<mo stretchy="true">${esc(mark)}</mo></${name}>`, tex: commands[mark] ? `\\${commands[mark]}{${a.tex}}` : `\\${bottom ? 'underset' : 'overset'}{${latex(mark)}}{${a.tex}}` };
    }
    if (tag === 'limLow' || tag === 'limUpp') {
      const a = arg(e, 'e'), lim = arg(e, 'lim'), low = tag === 'limLow';
      return { ml: `<${low ? 'munder' : 'mover'}>${row(a)}${row(lim)}</${low ? 'munder' : 'mover'}>`, tex: `\\${low ? 'underset' : 'overset'}{${lim.tex}}{${a.tex}}` };
    }
    if (tag === 'func') { const a = arg(e, 'fName'), b = arg(e, 'e'); return { ml: `<mrow>${a.ml}<mo>⁡</mo>${b.ml}</mrow>`, tex: `${a.tex} ${b.tex}` }; }
    if (tag === 'box') return arg(e, 'e');
    // Preserve readable content, but don't attach misleading LaTeX for unsupported constructs.
    complete = false;
    diagnostics.report({ code: 'UNSUPPORTED_MATH', message: `公式结构 ${tag} 暂未完整支持，已保留可解析内容` });
    return content(e);
  }
  const result = convert(root);
  const css = [inherited.size ? `font-size:${pt(inherited.size)}` : '', inherited.color ? `color:${inherited.color}` : ''].filter(Boolean).join(';');
  return { kind: 'math', display, mathml: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${display ? 'block' : 'inline'}"${css ? ` style="${esc(css)}"` : ''}><mrow>${result.ml}</mrow></math>`, latex: complete ? result.tex : undefined };
}
