import type { Document } from '@xmldom/xmldom';
import type { ConversionLimits } from '../../contracts/conversion.js';
import { DocxError } from '../../contracts/errors.js';
import { children } from '../xml/dom.js';
import { parseXml } from '../xml/safe-xml.js';
import { readZip } from '../archive/zip-reader.js';
import type { PartReader, Relationship } from './part-reader.js';
export class DocxPackage implements PartReader {
  private files = new Map<string, Uint8Array>();
  private xmlCache = new Map<string, Document>();
  private relCache = new Map<string, Map<string, Relationship>>();
  private mimeDefaults = new Map<string, string>();
  private mimeOverrides = new Map<string, string>();
  readonly main: string;

  constructor(bytes: Uint8Array, private readonly limits: ConversionLimits) {
    this.files = readZip(bytes, limits);
    const ct = this.xml('[Content_Types].xml', true)!;
    for (const el of children(ct.documentElement)) {
      const type = el.getAttribute('ContentType') ?? '';
      if (el.localName === 'Default') this.mimeDefaults.set((el.getAttribute('Extension') ?? '').toLowerCase(), type);
      if (el.localName === 'Override') this.mimeOverrides.set((el.getAttribute('PartName') ?? '').replace(/^\//, ''), type);
    }
    const mainRel = [...this.relationships('').values()].find(r => r.type.endsWith('/officeDocument') && !r.external);
    if (!mainRel) throw new DocxError('NOT_DOCX', '缺少 DOCX 主文档关系');
    this.main = this.resolve('', mainRel.target);
    const root = this.xml(this.main, true)!.documentElement;
    if (root?.namespaceURI !== 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
      throw new DocxError('UNSUPPORTED_OOXML', '当前支持 Transitional DOCX；请将 Strict OOXML 文档另存为普通 DOCX');
  }
  bytes(path: string): Uint8Array | undefined { return this.files.get(path); }
  paths(): string[] { return [...this.files.keys()]; }
  mime(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    return this.mimeOverrides.get(path) ?? this.mimeDefaults.get(ext) ?? ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', wmf: 'image/x-wmf', emf: 'image/x-emf', webp: 'image/webp', svg: 'image/svg+xml' }[ext] ?? 'application/octet-stream');
  }
  xml(path: string, required = false): Document | undefined {
    if (this.xmlCache.has(path)) return this.xmlCache.get(path);
    const bytes = this.files.get(path);
    if (!bytes) { if (required) throw new DocxError('MISSING_PART', `缺少文档部件：${path}`); return; }
    const doc = parseXml(bytes, path, this.limits.xmlDepth);
    this.xmlCache.set(path, doc); return doc;
  }
  resolve(source: string, target: string): string {
    let decoded: string;
    try { decoded = decodeURIComponent(target); } catch { throw new DocxError('REL_PATH', '无效资源路径编码'); }
    if (/[\\\0]/.test(decoded) || /^[^/]*:/.test(decoded)) throw new DocxError('REL_PATH', '非法资源路径');
    const parts = decoded.startsWith('/') ? [] : source.split('/').slice(0, -1);
    for (const p of decoded.split('/')) {
      if (p === '..') { if (!parts.length) throw new DocxError('REL_PATH', '资源路径逃逸 DOCX 包'); parts.pop(); }
      else if (p && p !== '.') parts.push(p);
    }
    return parts.join('/');
  }
  relationships(source: string): Map<string, Relationship> {
    if (this.relCache.has(source)) return this.relCache.get(source)!;
    const slash = source.lastIndexOf('/');
    const path = source ? `${source.slice(0, slash + 1)}_rels/${source.slice(slash + 1)}.rels` : '_rels/.rels';
    const map = new Map<string, Relationship>();
    for (const el of children(this.xml(path)?.documentElement)) {
      map.set(el.getAttribute('Id') ?? '', { target: el.getAttribute('Target') ?? '', type: el.getAttribute('Type') ?? '', external: el.getAttribute('TargetMode') === 'External' });
    }
    this.relCache.set(source, map); return map;
  }
  related(source: string, kind: string): string | undefined {
    const rel = [...this.relationships(source).values()].find(r => !r.external && r.type.endsWith(`/${kind}`));
    return rel ? this.resolve(source, rel.target) : undefined;
  }
}
