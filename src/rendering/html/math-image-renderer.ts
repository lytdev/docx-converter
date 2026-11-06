import type { MathNode } from '../../domain/document.js';
import type { RenderContext } from '../../contracts/ports.js';
import { attrs, esc, safeUrl } from '../../shared/markup.js';
import { resolveMathImageOutput } from '../math-image-source.js';
import type { MathImageFormat } from '../math-image-source.js';

export async function renderMathImage(node: MathNode, context: RenderContext, format: MathImageFormat): Promise<string> {
  if (node.attributes) {
    if (node.src) {
      const safe = safeUrl(node.src, true);
      if (safe) return `<img${attrs({ ...node.attributes, src: safe })}>`;
      context.warn('UNSAFE_IMAGE_URL', 'JSON 公式图片地址不是安全的内嵌或 HTTP(S) 图片');
    } else if (node.attributes.class === 'unsupported-content') {
      return `<span${attrs(node.attributes)}>[公式图片生成失败]</span>`;
    } else {
      return `<span${attrs(node.attributes)}>${node.mathml}</span>`;
    }
  }
  const image = await resolveMathImageOutput(node, context, format);
  if (!image) return '<span class="unsupported-content" data-type="formula">[公式图片生成失败]</span>';
  const align = image.verticalAlignEx === undefined ? 'middle' : `${image.verticalAlignEx}ex`;
  const layout = node.display ? 'display:block;margin:.6em 0;' : `vertical-align:${align};`;
  const className = `formula-item formula-image image-${node.display ? 'block' : 'inline'}`;
  return `<img src="${image.src}" alt="${esc(node.latex || '公式')}" class="${className}" data-type="formula"${node.latex !== undefined ? ` data-latex="${esc(node.latex)}"` : ''} style="max-width:100%;width:${image.widthEx}ex;height:${image.heightEx}ex;${layout}">`;
}
