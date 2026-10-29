import type { MathNode } from '../../domain/document.js';
import type { RenderContext } from '../../contracts/ports.js';
import { esc } from '../../shared/markup.js';
import { resolveMathImageSource } from '../math-image-source.js';

export function renderMathImage(node: MathNode, context: RenderContext): string {
  const src = resolveMathImageSource(node, context);
  if (!src) return '<span class="unsupported-content" data-type="formula">[公式图片生成失败]</span>';
  return `<img src="${src}" alt="${esc(node.latex || '公式')}" class="formula-item formula-image" data-type="formula"${node.latex !== undefined ? ` data-latex="${esc(node.latex)}"` : ''} style="max-width:100%;vertical-align:middle;${node.display ? 'display:block;margin:.6em 0;' : ''}">`;
}
