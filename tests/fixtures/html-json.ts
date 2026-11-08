import type { HtmlJsonDocument, HtmlJsonNode } from '../../src/index';

export function jsonNodes(document: HtmlJsonDocument): HtmlJsonNode[] {
  const result: HtmlJsonNode[] = [];
  const visit = (node: HtmlJsonNode): void => {
    result.push(node);
    node.children.forEach(visit);
  };
  document.elements.forEach(visit);
  return result;
}

export function jsonElements(document: HtmlJsonDocument, tag: string): HtmlJsonNode[] {
  return jsonNodes(document).filter(node => node.tag === tag);
}

export function jsonElement(document: HtmlJsonDocument, tag: string): HtmlJsonNode {
  const node = jsonElements(document, tag)[0];
  if (!node) throw new Error(`Expected ${tag}`);
  return node;
}
