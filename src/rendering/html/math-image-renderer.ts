import type { MathNode } from '../../domain/document.js';
import type { RenderContext } from '../../contracts/ports.js';
import { esc } from '../../shared/markup.js';
import { resolveMathImageOutput } from '../math-image-source.js';
import type { MathImageFormat } from '../math-image-source.js';

export async function renderMathImage(node: MathNode, context: RenderContext, format: MathImageFormat): Promise<string> {
  const image = await resolveMathImageOutput(node, context, format);
  if (!image) return '<span class="unsupported-content" data-type="formula">[公式图片生成失败]</span>';
  const align = image.verticalAlignEx === undefined ? 'middle' : `${image.verticalAlignEx}ex`;
  const layout = node.display ? 'display:block;margin:.6em 0;' : `vertical-align:${align};`;
  return `<img src="${image.src}" alt="${esc(node.latex || '公式')}" class="formula-item formula-image" data-type="formula"${node.latex !== undefined ? ` data-latex="${esc(node.latex)}"` : ''} style="max-width:100%;width:${image.widthEx}ex;height:${image.heightEx}ex;${layout}">`;
}
