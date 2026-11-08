import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { renderJsonToHtml } from '../dist/index.js';
import { convertToHtmlFile, convertToJsonFile } from '../dist/node.js';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/check-html-json-consistency.mjs <input.docx> [report.json]');

const options = { output: 'fragment' };
const reportPath = resolve(process.argv[3] ?? '.tmp/html-json-consistency-report.json');
const [htmlResult, jsonResult] = await Promise.all([
  convertToHtmlFile(input, options),
  convertToJsonFile(input, options),
]);
const restoredHtml = await renderJsonToHtml(jsonResult, options);

const parse = html => new DOMParser().parseFromString(html, 'text/html');
const splitClass = value => value ? value.trim().split(/\s+/).filter(Boolean) : [];

function parseStyle(value) {
  const result = {};
  for (const declaration of (value ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const propertyValue = declaration.slice(colon + 1).trim();
    if (name && propertyValue) result[name] = propertyValue;
  }
  return result;
}

function children(element) {
  const result = [];
  for (let child = element.firstChild; child; child = child.nextSibling)
    if (child.nodeType === 1) result.push(child);
  return result;
}

function htmlNode(element) {
  const attributes = {};
  for (let index = 0; index < element.attributes.length; index++) {
    const attribute = element.attributes.item(index);
    if (!attribute || ['id', 'class', 'style', 'data-docx-meta'].includes(attribute.name.toLowerCase())) continue;
    attributes[attribute.name.toLowerCase()] = attribute.value;
  }
  return {
    tag: element.tagName.toLowerCase(),
    text: element.textContent ?? '',
    class: splitClass(element.getAttribute('class')),
    style: parseStyle(element.getAttribute('style')),
    attributes,
    children: children(element).map(htmlNode),
  };
}

function jsonNode(node) {
  const attributes = { ...node.attribute };
  for (const [name, value] of Object.entries(node)) {
    if (['tag', 'id', 'text', 'class', 'style', 'attribute', 'children'].includes(name)) continue;
    if (typeof value === 'string') attributes[name] = value;
  }
  return {
    tag: node.tag,
    text: node.text,
    class: node.class,
    style: node.style,
    attributes,
    children: node.children.map(jsonNode),
  };
}

function documentParts(html) {
  const document = parse(html);
  const body = document.getElementsByTagName('body')[0] ?? document.documentElement;
  const roots = body ? children(body) : [];
  const article = roots.find(element => element.tagName.toLowerCase() === 'article')
    ?? (body?.tagName.toLowerCase() === 'article' ? body : body?.getElementsByTagName('article')[0]);
  if (!article) throw new Error('HTML 中缺少 article.docx-document');
  let meta = {};
  try { meta = JSON.parse(article.getAttribute('data-docx-meta') || '{}'); }
  catch { throw new Error('article.docx-document 的 data-docx-meta 不是有效 JSON'); }
  return { meta, elements: children(article).map(htmlNode) };
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
}

function value(value) {
  const text = JSON.stringify(sorted(value));
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function compare(actual, expected, path, differences) {
  if (differences.length >= 100) return;
  if (actual.tag !== expected.tag) {
    differences.push(`${path}.tag: ${value(actual.tag)} != ${value(expected.tag)}`);
    return;
  }
  if (actual.text !== expected.text) differences.push(`${path}.text: ${value(actual.text)} != ${value(expected.text)}`);
  if (value(actual.class) !== value(expected.class)) differences.push(`${path}.class: ${value(actual.class)} != ${value(expected.class)}`);
  if (value(actual.style) !== value(expected.style)) differences.push(`${path}.style: ${value(actual.style)} != ${value(expected.style)}`);
  if (value(actual.attributes) !== value(expected.attributes)) differences.push(`${path}.attributes: ${value(actual.attributes)} != ${value(expected.attributes)}`);
  if (actual.children.length !== expected.children.length) {
    differences.push(`${path}.children.length: ${actual.children.length} != ${expected.children.length}`);
    return;
  }
  for (let index = 0; index < actual.children.length; index++)
    compare(actual.children[index], expected.children[index], `${path}.children[${index}]`, differences);
}

function compareElements(actual, expected, start) {
  const differences = [];
  if (actual.length !== expected.length) differences.push(`${start}.length: ${actual.length} != ${expected.length}`);
  for (let index = 0; index < Math.min(actual.length, expected.length); index++)
    compare(actual[index], expected[index], `${start}[${index}]`, differences);
  return differences;
}

const html = documentParts(htmlResult.html);
const restored = documentParts(restoredHtml);
const jsonElements = jsonResult.elements.map(jsonNode);
const expectedMeta = { ...html.meta, title: html.meta.title || '' };
const metaDifferences = value(expectedMeta) === value(jsonResult.meta)
  ? []
  : [`meta: ${value(jsonResult.meta)} != ${value(expectedMeta)}`];
const structureDifferences = compareElements(jsonElements, html.elements, 'elements');
const restoredDifferences = compareElements(restored.elements, html.elements, 'restored.elements');
const warningCodes = Object.fromEntries(Object.entries(htmlResult.warnings.reduce((counts, warning) => {
  counts[warning.code] = (counts[warning.code] ?? 0) + 1;
  return counts;
}, {})).sort(([left], [right]) => left.localeCompare(right)));

const report = {
  file: resolve(input),
  name: basename(input),
  options,
  summary: {
    exactStringMatch: htmlResult.html === restoredHtml,
    metaMatch: metaDifferences.length === 0,
    structureMatch: structureDifferences.length === 0,
    restoredMatch: restoredDifferences.length === 0,
    ignoredAttributes: ['id'],
    htmlChars: htmlResult.html.length,
    restoredHtmlChars: restoredHtml.length,
    jsonBytes: Buffer.byteLength(JSON.stringify(jsonResult)),
    topLevelElements: jsonResult.elements.length,
    htmlWarnings: htmlResult.warnings.length,
    warningCodes,
    htmlResources: htmlResult.resources.length,
    stats: htmlResult.stats,
  },
  meta: jsonResult.meta,
  differences: {
    meta: metaDifferences,
    structure: structureDifferences,
    restored: restoredDifferences,
  },
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report.summary, null, 2));
if (metaDifferences.length || structureDifferences.length || restoredDifferences.length) {
  console.error(`差异已写入 ${reportPath}`);
  process.exitCode = 1;
} else {
  console.log(`一致性校验通过，报告：${reportPath}`);
}
