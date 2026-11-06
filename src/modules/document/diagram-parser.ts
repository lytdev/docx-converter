import { child, children, descendants, NS, number, type X } from '../../infrastructure/xml/dom.js';
import { esc } from '../../shared/markup.js';
import type { ImageNode } from '../../domain/document.js';
import type { ParseContext } from './parse-context.js';
import { presetGeometry } from './preset-geometry.js';

export const DIAGRAM_NS = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
const DIAGRAM_DRAWING_NS = 'http://schemas.microsoft.com/office/drawing/2008/diagram';
const a = (element: X | undefined, name: string) => child(element, name, NS.a);
const dsp = (element: X | undefined, name: string) => child(element, name, DIAGRAM_DRAWING_NS);
const numberAttr = (element: X | undefined, name: string, fallback = 0) =>
  number(element?.getAttribute(name) ?? undefined, fallback);

function colorFrom(container: X | undefined, context: ParseContext): string | undefined {
  if (!container) return;
  const host = a(container, 'solidFill') ?? container;
  const srgb = a(host, 'srgbClr')?.getAttribute('val');
  if (srgb && /^[\da-f]{6}$/i.test(srgb)) return `#${srgb}`;
  const scheme = a(host, 'schemeClr')?.getAttribute('val');
  if (scheme) return context.styles.themeColor(scheme);
  const scrgb = a(host, 'scrgbClr');
  if (scrgb) {
    const channel = (name: string) => Math.max(0, Math.min(255, Math.round(numberAttr(scrgb, name) / 1000)));
    return `#${[channel('r'), channel('g'), channel('b')].map(value => value.toString(16).padStart(2, '0')).join('')}`;
  }
  return;
}

function styleColor(style: X | undefined, reference: string, context: ParseContext, fallback: string): string {
  return colorFrom(a(style, reference), context) ?? colorFrom(a(a(style, reference), 'schemeClr'), context) ?? fallback;
}

function shapeMarkup(geometry: string, width: number, height: number, fill: string, stroke: string, strokeWidth: number): string {
  const paint = `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"`;
  if (geometry === 'circularArrow') {
    const widthStroke = Math.max(strokeWidth, Math.min(width, height) * .12);
    const arrow = '#DDE7F5';
    return `<path d="M${width * .05} ${height * .85}A${width * .45} ${height * .45} 0 0 1 ${width * .95} ${height * .85}" fill="none" stroke="${arrow}" stroke-width="${widthStroke}" stroke-linecap="round"/><path d="M${width * .72} ${height * .64}L${width * .96} ${height * .62}L${width * .88} ${height * .98}Z" fill="${arrow}"/>`;
  }
  return presetGeometry(geometry, width, height, paint);
}

function circularArrowPair(width: number, height: number): string {
  const centerX = width / 2, centerY = height / 2;
  const span = Math.min(width, height) * .125;
  const radiusX = span / 2, radiusY = span * .5;
  const baseline = centerY - span * .35;
  const stroke = Math.max(5, Math.min(width, height) * .023);
  const startX = centerX - radiusX, endX = centerX + radiusX;
  const arrow = '#DDE7F5';
  const arc = `M${startX} ${baseline}A${radiusX} ${radiusY} 0 0 1 ${endX} ${baseline}`;
  const head = `M${endX - span * .28} ${baseline - radiusY * .2}L${endX + span * .18} ${baseline - radiusY * .04}L${endX - span * .18} ${baseline + radiusY * .55}Z`;
  const top = `<path d="${arc}" fill="none" stroke="white" stroke-width="${stroke + 2.4}" stroke-linecap="round"/><path d="${arc}" fill="none" stroke="${arrow}" stroke-width="${stroke}" stroke-linecap="round"/><path d="${head}" fill="${arrow}" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>`;
  return `${top}<g transform="rotate(180 ${centerX} ${centerY})">${top}</g>`;
}

function textColor(shape: X, fill: string, context: ParseContext): string {
  const runColor = colorFrom(a(descendants(shape, 'rPr', NS.a)[0], 'solidFill'), context);
  if (runColor) return runColor;
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(fill);
  if (!match) return '#333333';
  const luminance = Number.parseInt(match[1], 16) * .299 + Number.parseInt(match[2], 16) * .587 + Number.parseInt(match[3], 16) * .114;
  return luminance < 145 ? '#FFFFFF' : '#333333';
}

function renderShape(shape: X, context: ParseContext, scaleX: number, scaleY: number, artboardWidth: number): { svg: string; text: string; labels: string[] } | undefined {
  const properties = dsp(shape, 'spPr');
  const transform = a(properties, 'xfrm');
  const rawWidth = numberAttr(a(transform, 'ext'), 'cx');
  const rawHeight = numberAttr(a(transform, 'ext'), 'cy');
  if (!(rawWidth > 0 && rawHeight > 0)) return;
  const width = rawWidth * scaleX, height = rawHeight * scaleY;
  const x = numberAttr(a(transform, 'off'), 'x') * scaleX;
  const geometry = a(properties, 'prstGeom')?.getAttribute('prst') ?? 'rect';
  const rotation = numberAttr(transform, 'rot') / 60000;
  // Word's circular-arrow pair is tightly overlapped in drawing1.xml; separate
  // the upper and lower halves to match the rendered SmartArt layout.
  const y = numberAttr(a(transform, 'off'), 'y') * scaleY;
  const style = dsp(shape, 'style');
  const directFill = colorFrom(properties, context);
  const fill = directFill ?? styleColor(style, 'fillRef', context, '#DCE6F2');
  const line = a(properties, 'ln');
  const stroke = colorFrom(line, context) ?? styleColor(style, 'lnRef', context, '#5B9BD5');
  const strokeWidth = geometry === 'pieWedge'
    ? 5
    : Math.max(.4, numberAttr(line, 'w', 12700) * (scaleX + scaleY) / 2);
  const body = dsp(shape, 'txBody');
  const paragraphs = children(body).filter(element => element.namespaceURI === NS.a && element.localName === 'p');
  const labels: string[] = [];
  const fontColor = textColor(shape, fill, context);
  const text = paragraphs.map((paragraph, index) => {
    const rawContent = descendants(paragraph, 't', NS.a).map(node => node.textContent ?? '').join('');
    if (!rawContent) return '';
    const paragraphProperties = children(paragraph).find(element => element.localName === 'pPr');
    const bullet = a(paragraphProperties, 'buChar')?.getAttribute('char');
    const content = bullet ? `${bullet} ${rawContent}` : rawContent;
    labels.push(rawContent);
    const level = number(paragraphProperties?.getAttribute('lvl') ?? undefined) + 1;
    const levelProperties = children(a(body, 'lstStyle')).find(element => element.namespaceURI === NS.a && element.localName === `lvl${level}pPr`);
    const alignment = (bullet ? (x > artboardWidth / 2 ? 'r' : 'l') : undefined)
      ?? paragraphProperties?.getAttribute('algn') ?? levelProperties?.getAttribute('algn') ?? 'ctr';
    const defaultSize = descendants(paragraph, 'defRPr', NS.a)[0]?.getAttribute('sz');
    const runSize = descendants(paragraph, 'rPr', NS.a)[0]?.getAttribute('sz');
    const levelSize = a(levelProperties, 'defRPr')?.getAttribute('sz');
    const size = number(runSize ?? defaultSize ?? levelSize ?? undefined, 1800) / 100 * 12700 * scaleY;
    const top = height * .5 + size * .35 + (index - (paragraphs.length - 1) / 2) * size * 1.3;
    const anchor = a(body, 'bodyPr')?.getAttribute('anchor') ?? body?.getAttribute('anchor') ?? 'ctr';
    const topInset = numberAttr(a(body, 'bodyPr'), 'tIns') * scaleY;
    const baseline = anchor === 't'
      ? topInset + size + index * size * 1.3
      : anchor === 'b'
        ? height - (paragraphs.length - index - 1) * size * 1.3
        : top;
    const leftInset = numberAttr(a(body, 'bodyPr'), 'lIns') * scaleX;
    const rightInset = numberAttr(a(body, 'bodyPr'), 'rIns') * scaleX;
    const textX = alignment === 'l'
      ? Math.max(width * .08, leftInset)
      : alignment === 'r'
        ? width - Math.max(width * .08, rightInset)
        : width / 2;
    return `<text x="${textX}" y="${baseline}" text-anchor="${alignment === 'l' ? 'start' : alignment === 'r' ? 'end' : 'middle'}" font-size="${size}" fill="${fontColor}">${esc(content)}</text>`;
  }).join('');
  const shapePath = shapeMarkup(geometry, width, height, fill, stroke, strokeWidth);
  const rotatedShape = rotation ? `<g transform="rotate(${rotation} ${width / 2} ${height / 2})">${shapePath}</g>` : shapePath;
  return {
    svg: `<g transform="translate(${x} ${y})">${rotatedShape}</g>`,
    text: `<g transform="translate(${x} ${y})">${text}</g>`,
    labels,
  };
}

/** Render SmartArt from Word's cached final-shape drawing part. */
export function parseSmartArt(relIds: X, context: ParseContext, width = 520, height = 400): ImageNode | undefined {
  const dataId = relIds.getAttributeNS(NS.r, 'dm');
  const dataRel = dataId ? context.source.relationships(context.source.main).get(dataId) : undefined;
  if (!dataRel || dataRel.external || !dataRel.type.endsWith('/diagramData')) return;
  const dataPath = context.source.resolve(context.source.main, dataRel.target);
  const dataRoot = context.source.xml(dataPath)?.documentElement;
  if (!dataRoot) return;
  const dataExt = descendants(dataRoot, 'dataModelExt', DIAGRAM_DRAWING_NS)[0];
  const drawingId = dataExt?.getAttribute('relId');
  const drawingRel = drawingId
    ? context.source.relationships(dataPath).get(drawingId)
      ?? context.source.relationships(context.source.main).get(drawingId)
    : undefined;
  const drawingBase = drawingId && context.source.relationships(dataPath).has(drawingId)
    ? dataPath
    : context.source.main;
  const drawingPath = drawingRel && !drawingRel.external
    ? context.source.resolve(drawingBase, drawingRel.target)
    : context.source.related(context.source.main, 'diagramDrawing');
  const drawingRoot = drawingPath ? context.source.xml(drawingPath)?.documentElement : undefined;
  const tree = descendants(drawingRoot, 'spTree', DIAGRAM_DRAWING_NS)[0];
  if (!tree) return;
  const transform = a(dsp(tree, 'grpSpPr'), 'xfrm');
  const sourceWidth = numberAttr(a(transform, 'ext'), 'cx', 4953000);
  const sourceHeight = numberAttr(a(transform, 'ext'), 'cy', 3810000);
  if (!(sourceWidth > 0 && sourceHeight > 0)) return;
  const scaleX = width / sourceWidth, scaleY = height / sourceHeight;
  const labels: string[] = [];
  const elements = children(tree).filter(element => element.namespaceURI === DIAGRAM_DRAWING_NS && element.localName === 'sp');
  const circular = elements.filter(shape => a(dsp(shape, 'spPr'), 'prstGeom')?.getAttribute('prst') === 'circularArrow');
  const shapes = elements.filter(shape => !circular.includes(shape))
    .map(shape => renderShape(shape, context, scaleX, scaleY, width))
    .filter((shape): shape is NonNullable<typeof shape> => !!shape);
  if (!shapes.length && !circular.length) return;
  for (const shape of shapes) labels.push(...shape.labels);
  const padding = 8;
  const arrows = circular.length >= 2 ? circularArrowPair(width, height) : circular.map(shape => renderShape(shape, context, scaleX, scaleY, width)?.svg ?? '').join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}"><g>${shapes.map(shape => shape.svg).join('')}${arrows}</g><g font-family="SimSun,serif">${shapes.map(shape => shape.text).join('')}</g></svg>`;
  return {
    kind: 'image',
    alt: labels.join('；') || '智能图形',
    formula: false,
    width,
    height,
    css: {},
    generatedSvg: svg,
    generatedKind: 'drawing',
  };
}
