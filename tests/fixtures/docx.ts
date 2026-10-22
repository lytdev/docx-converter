import { strToU8, zipSync, zlibSync } from 'fflate';
export const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
export const ns = `xmlns:w="${W}" xmlns:m="${M}" xmlns:r="${R}" xmlns:a="${A}" xmlns:wp="${WP}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"`;
export const text = (s: string, pr = '') => `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t>${s}</w:t></w:r>`;
export const p = (s: string, pr = '') => `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${s}</w:p>`;
export const mt = (s: string) => `<m:r><m:t>${s}</m:t></m:r>`;
export const image = (id = 'image1', w = 100, h = 50) => `<w:r><w:drawing><wp:inline><wp:extent cx="${w * 9525}" cy="${h * 9525}"/><wp:docPr id="1" name="示意图" descr="测试图片"/><a:graphic><a:graphicData><a:blip r:embed="${id}"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
// A real 1x1 PNG, independently generated fixture; no source project data is redistributed.
export const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSf8AAAAASUVORK5CYII='), c => c.charCodeAt(0));
/** A visible, generated raster diagram used only by the public demonstration. */
function diagramPng(): Uint8Array {
  const w = 320, h = 100, pixels = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let rgb = [247, 249, 255];
    const box = [16, 126, 236].find(left => x >= left && x < left + 68 && y >= 18 && y < 82);
    if (box !== undefined) {
      rgb = x < box + 2 || x > box + 65 || y < 20 || y > 79 ? [164, 184, 235] : [230, 237, 254];
      if (x >= box + 16 && x <= box + 51 && [34, 35, 47, 48, 60, 61].includes(y)) rgb = [65, 97, 184];
    }
    if ([86, 196].some(left => x >= left && x <= left + 35 && (Math.abs(y - 50) <= 1 || x >= left + 25 && Math.abs(Math.abs(y - 50) - (left + 35 - x)) <= 1))) rgb = [80, 116, 205];
    pixels.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(data.length + 12), view = new DataView(out.buffer);
    view.setUint32(0, data.length); out.set(strToU8(type), 4); out.set(data, 8);
    let crc = 0xffffffff;
    for (const byte of out.subarray(4, out.length - 4)) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    view.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0); return out;
  };
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, w); view.setUint32(4, h); header[8] = 8; header[9] = 2;
  const parts = [new Uint8Array([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlibSync(pixels)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; } return out;
}
export interface FixtureOptions { styles?: string; numbering?: string; theme?: string; rels?: string; media?: Record<string, Uint8Array>; extra?: Record<string, string | Uint8Array>; }
export function docx(body: string, options: FixtureOptions = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${ns}><w:body>${body}<w:sectPr/></w:body></w:document>`),
  };
  let rels = options.rels ?? '';
  for (const type of ['styles', 'numbering', 'theme'] as const) {
    const value = options[type];
    if (value) { files[`word/${type}.xml`] = strToU8(value); rels += `<Relationship Id="${type}" Type="${R}/${type}" Target="${type}.xml"/>`; }
  }
  files['word/_rels/document.xml.rels'] = strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  for (const [path, bytes] of Object.entries(options.media ?? {})) files[`word/media/${path}`] = bytes;
  for (const [path, bytes] of Object.entries(options.extra ?? {})) files[path] = typeof bytes === 'string' ? strToU8(bytes) : bytes;
  return zipSync(files);
}
export const sampleStyles = `<w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="自定义标题"/><w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="80" w:after="240"/></w:pPr><w:rPr><w:sz w:val="40"/><w:b/><w:color w:val="2447A0"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Section"><w:basedOn w:val="Title"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:style></w:styles>`;
export function sampleDocx(): Uint8Array {
  const title = (s: string, id = 'Section') => p(text(s), `<w:pStyle w:val="${id}"/>`);
  const border = '<w:tblBorders><w:top w:val="single" w:sz="12" w:color="506BA1"/><w:bottom w:val="single" w:sz="12" w:color="506BA1"/><w:insideH w:val="single" w:sz="4" w:color="D9E2F1"/></w:tblBorders>';
  const cell = (s: string, bg = false) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/>${bg ? '<w:shd w:fill="EFF4FC"/>' : ''}</w:tcPr>${p(text(s))}</w:tc>`;
  return docx([
    title('文档转换 · 能力示例', 'Title'),
    p(text('这份示例展示字体、表格、图片与公式在 HTML 中的保留效果。')),
    title('01 / 字体与段落'),
    p(text('中文字体与 English fonts 可以分别设置。', '<w:rFonts w:ascii="Georgia" w:eastAsia="SimSun"/><w:sz w:val="26"/>')),
    p(text('粗体 ', '<w:b/>') + text('斜体 ', '<w:i/>') + text('下划线 ', '<w:u w:val="single"/>') + text('重点高亮', '<w:highlight w:val="yellow"/>')),
    title('02 / 表格与数据'), p(text('表 1 功能保留说明'), '<w:jc w:val="center"/>'),
    `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr>${cell('内容类型', true)}${cell('HTML 输出', true)}</w:tr><w:tr>${cell('字体 / 样式')}${cell('内联 CSS')}</w:tr><w:tr>${cell('数学公式')}${cell('SVG 图片 + LaTeX')}</w:tr></w:tbl>`,
    title('03 / 数学公式'),
    p(text('勾股定理：') + `<m:oMath><m:sSup><m:e>${mt('a')}</m:e><m:sup>${mt('2')}</m:sup></m:sSup>${mt('+')}<m:sSup><m:e>${mt('b')}</m:e><m:sup>${mt('2')}</m:sup></m:sSup>${mt('=')}<m:sSup><m:e>${mt('c')}</m:e><m:sup>${mt('2')}</m:sup></m:sSup></m:oMath>`),
    p(`<m:oMathPara><m:oMath>${mt('x=')}<m:f><m:num>${mt('−b±')}<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:e><m:sSup><m:e>${mt('b')}</m:e><m:sup>${mt('2')}</m:sup></m:sSup>${mt('−4ac')}</m:e></m:rad></m:num><m:den>${mt('2a')}</m:den></m:f></m:oMath></m:oMathPara>`),
    title('04 / 图片与图注'), p(image('image1', 320, 100)), p(text('图 1 内嵌 PNG 流程示意图'), '<w:jc w:val="center"/>'),
  ].join(''), { styles: sampleStyles, media: { 'diagram.png': diagramPng() }, rels: `<Relationship Id="image1" Type="${R}/image" Target="media/diagram.png"/>` });
}
