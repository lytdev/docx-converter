import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { convertDocx } from '../../src/index';
import { docx, p, text, mt, image, png, R, A, ns, sampleDocx } from '../fixtures/docx';
import { hex, oleEquation } from '../fixtures/ole';
import { textWmf } from '../fixtures/wmf';

const dom = (html: string) => new DOMParser().parseFromString(html.replace(/<!DOCTYPE[^>]*>/i, '').replace(/<br>/g, '<br/>').replace(/<img\b([^>]*[^/])>/g, '<img$1/>').replace(/<meta\b([^>]*[^/])>/g, '<meta$1/>'), 'application/xml');
const elements = (html: string, name: string) => Array.from(dom(html).getElementsByTagName(name));
describe('DOCX conversion', () => {
  it('preserves text, spaces, escaped markup and mixed content order', async () => {
    const r = await convertDocx(docx(p(text('A &amp; &lt;B&gt;  ') + '<w:r><w:tab/><w:t>C</w:t><w:br/><w:t>D</w:t></w:r>')));
    expect(r.html).toContain('A &amp; &lt;B&gt;  \tC'); expect(r.html).toContain('<br>');
    expect(r.stats.paragraphs).toBe(1); expect(r.html).toMatch(/^<!DOCTYPE html>/);
  });
  it('accepts Uint8Array views, ArrayBuffer and Blob; emits fragment on request', async () => {
    const bytes = docx(p(text('hello'))), padded = new Uint8Array(bytes.length + 10); padded.set(bytes, 5);
    for (const input of [padded.subarray(5, 5 + bytes.length), bytes.buffer as ArrayBuffer, new Blob([bytes as Uint8Array<ArrayBuffer>])]) {
      const r = await convertDocx(input, { output: 'fragment' }); expect(r.html).toContain('hello'); expect(r.html).not.toContain('<head>');
    }
  });
  it('resolves style inheritance and explicit false; splits East Asian fonts', async () => {
    const styles = `<w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="SimSun"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:styleId="Base"><w:rPr><w:b/><w:color w:val="CC2200"/></w:rPr></w:style><w:style w:styleId="Child"><w:basedOn w:val="Base"/></w:style></w:styles>`;
    const r = await convertDocx(docx(p(text('中文ABC', '<w:b w:val="0"/>'), '<w:pStyle w:val="Child"/>'), { styles }));
    const spans = elements(r.html, 'span');
    expect(spans[0].getAttribute('style')).toContain('font-family:"SimSun","Calibri"');
    expect(spans[1].getAttribute('style')).toContain('font-family:"Calibri","SimSun"');
    expect(spans[0].getAttribute('style')).toContain('font-weight:normal');
    expect(spans[0].getAttribute('style')).toContain('font-size:12pt'); expect(r.html).toContain('#CC2200');
  });
  it('uses outline levels, never heading names; explicit body overrides inherited heading', async () => {
    const styles = `<w:styles ${ns}><w:style w:styleId="H"><w:name w:val="ordinary"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style><w:style w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>`;
    const r = await convertDocx(docx(p(text('yes'), '<w:pStyle w:val="H"/>') + p(text('body'), '<w:pStyle w:val="H"/><w:outlineLvl w:val="9"/>') + p(text('named'), '<w:pStyle w:val="Heading1"/>') + `<w:tbl><w:tr><w:tc>${p(text('cell'), '<w:pStyle w:val="H"/>')}</w:tc></w:tr></w:tbl>`, { styles }));
    expect(elements(r.html, 'h2')).toHaveLength(1); expect(elements(r.html, 'h1')).toHaveLength(0); expect(elements(r.html, 'td')[0].getElementsByTagName('p').length).toBe(1);
  });
  it('resolves theme font and theme color', async () => {
    const theme = `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="t"><a:accent1><a:srgbClr val="336699"/></a:accent1></a:clrScheme><a:fontScheme name="t"><a:minorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:font script="Hans" typeface="SimSun"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;
    const r = await convertDocx(docx(p(text('中A', '<w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia"/><w:color w:themeColor="accent1"/>')), { theme }));
    expect(r.html).toContain('#336699'); expect(r.html).toContain('Georgia'); expect(r.html).toContain('SimSun');
  });
  it('merges only adjacent text with equal effective styles', async () => {
    const r = await convertDocx(docx(p(text('A') + text('B') + text('C', '<w:b/>') + text('D'))));
    expect(elements(r.html, 'span')).toHaveLength(3); expect(r.html).toContain('>AB</span>');
  });
  it('preserves colspan, rowspan and explicit border suppression', async () => {
    const r = await convertDocx(docx(`<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="8"/><w:insideH w:val="single"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/><w:vMerge w:val="restart"/><w:tcBorders><w:top w:val="nil"/></w:tcBorders><w:shd w:fill="FFFF00"/></w:tcPr>${p(text('merged'))}</w:tc><w:tc>${p(text('right1'))}</w:tc></w:tr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/><w:vMerge/></w:tcPr></w:tc><w:tc>${p(text('right2'))}</w:tc></w:tr></w:tbl>`));
    const cells = elements(r.html, 'td'); expect(cells).toHaveLength(3);
    expect(cells[0].getAttribute('rowspan')).toBe('2'); expect(cells[0].getAttribute('colspan')).toBe('2');
    expect(cells[0].getAttribute('style')).toContain('border-top:none'); expect(cells[0].getAttribute('style')).toContain('#FFFF00');
  });
  it('does not turn automatic cell shading black while preserving explicit and theme fills', async () => {
    const theme = `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="t"><a:accent1><a:srgbClr val="336699"/></a:accent1><a:accent2><a:srgbClr val="AA0000"/></a:accent2></a:clrScheme></a:themeElements></a:theme>`;
    const cell = (shading: string, label: string) => `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" ${shading}/></w:tcPr>${p(text(label, '<w:color w:val="auto"/>'))}</w:tc>`;
    const table = `<w:tbl><w:tr>${cell('w:fill="auto"', 'auto')}${cell('w:fill="000000"', 'black')}${cell('w:fill="auto" w:themeFill="accent1" w:themeColor="accent2"', 'theme')}</w:tr></w:tbl>`;
    const result = await convertDocx(docx(table, { theme }));
    const cells = elements(result.html, 'td');
    expect(cells).toHaveLength(3);
    expect(cells[0].getAttribute('style')).not.toContain('background-color');
    expect(cells[1].getAttribute('style')).toContain('background-color:#000000');
    expect(cells[2].getAttribute('style')).toContain('background-color:#336699');
    expect(cells[2].getAttribute('style')).not.toContain('#AA0000');
    expect(cells[0].getElementsByTagName('span')[0].getAttribute('style')).toContain('color:#000000');
  });
  it('keeps nested table cells separate from the outer grid', async () => {
    const r = await convertDocx(docx(`<w:tbl><w:tr><w:tc>${p(text('outer'))}<w:tbl><w:tr><w:tc>${p(text('inner'))}</w:tc></w:tr></w:tbl></w:tc><w:tc>${p(text('sibling'))}</w:tc></w:tr></w:tbl>`));
    expect(elements(r.html, 'table')).toHaveLength(2); expect(elements(r.html, 'td')).toHaveLength(3); expect(r.stats.tables).toBe(2);
  });
  it('renders multilevel lists and continues numbering after a paragraph', async () => {
    const numbering = `<w:numbering ${ns}><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
    const item = (s: string, level = 0) => p(text(s), `<w:numPr><w:numId w:val="7"/><w:ilvl w:val="${level}"/></w:numPr>`);
    const r = await convertDocx(docx(item('a') + item('nested', 1) + item('b') + p(text('break')) + item('c'), { numbering }));
    const ordered = elements(r.html, 'ol'); expect(ordered.map(e => e.getAttribute('start'))).toEqual(['3', '5']);
    expect(elements(r.html, 'ul')).toHaveLength(1); expect(elements(r.html, 'li')).toHaveLength(4);
  });
  it('embeds image bytes, dimensions and pure text captions; exports original resource', async () => {
    const r = await convertDocx(docx(p(image()) + p(text('图 1 实验示意图')), { rels: `<Relationship Id="image1" Type="${R}/image" Target="media/a.png"/>`, media: { 'a.png': png } }));
    expect(elements(r.html, 'figure')).toHaveLength(1); expect(elements(r.html, 'img')[0].getAttribute('alt')).toBe('图 1 实验示意图');
    expect(r.html).toContain('data:image/png;base64,'); expect(r.html).toContain('width:100px;height:50px'); expect(r.resources[0].bytes).toEqual(png);
  });
  it('moves adjacent table titles into caption', async () => {
    const r = await convertDocx(docx(p(text('表 2 测试')) + `<w:tbl><w:tr><w:tc>${p(text('data'))}</w:tc></w:tr></w:tbl>`));
    expect(elements(r.html, 'caption')[0].textContent).toBe('表 2 测试'); expect(elements(r.html, 'p')).toHaveLength(1);
  });
  it('calls async image resolver and rejects unsafe URL results', async () => {
    const input = docx(p(image()), { rels: `<Relationship Id="image1" Type="${R}/image" Target="media/a.png"/>`, media: { 'a.png': png } });
    const good = await convertDocx(input, { images: { resolve: async image => `/assets/${image.path.split('/').pop()}` } });
    expect(good.html).toContain('src="/assets/a.png"');
    const bad = await convertDocx(input, { images: { resolve: () => 'javascript:alert(1)' } });
    expect(bad.html).not.toContain('javascript:'); expect(bad.warnings.some(w => w.code === 'UNSAFE_IMAGE_URL')).toBe(true);
  });
  it('reports unsupported images and supports explicit conversion adapters', async () => {
    const input = docx(p(image()), { rels: `<Relationship Id="image1" Type="${R}/image" Target="media/a.wmf"/>`, media: { 'a.wmf': new Uint8Array([1, 2, 3]) } });
    const fallback = await convertDocx(input); expect(fallback.resources).toHaveLength(1); expect(fallback.warnings.some(w => w.code === 'UNSUPPORTED_IMAGE')).toBe(true);
    const adapted = await convertDocx(input, { images: { convert: async () => ({ bytes: png, mimeType: 'image/png' }) } });
    expect(adapted.html).toContain('<img'); expect(adapted.resources[0].path).toBe('word/media/a.wmf');
  });
  it('does not fetch external images or emit dangerous links', async () => {
    const r = await convertDocx(docx(p(image() + `<w:hyperlink r:id="link1">${text('bad')}</w:hyperlink>`), { rels: `<Relationship Id="image1" Type="${R}/image" Target="file:///C:/secret.png" TargetMode="External"/><Relationship Id="link1" Type="${R}/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>` }));
    expect(r.html).not.toContain('file:///'); expect(r.html).not.toContain('javascript:'); expect(r.warnings.map(w => w.code)).toContain('EXTERNAL_IMAGE');
  });
  it('produces standalone SVG images and LaTeX for OMML by default', async () => {
    const formula = `<m:oMath><m:f><m:num><m:sSup><m:e>${mt('x')}</m:e><m:sup>${mt('2')}</m:sup></m:sSup></m:num><m:den><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/> <m:e>${mt('y')}</m:e></m:rad></m:den></m:f><m:m><m:mr><m:e>${mt('1')}</m:e><m:e>${mt('2')}</m:e></m:mr><m:mr><m:e>${mt('3')}</m:e><m:e>${mt('4')}</m:e></m:mr></m:m></m:oMath>`;
    const r = await convertDocx(docx(p(text('before') + formula + text('after'))));
    const formulas = elements(r.html, 'img').filter(e => e.getAttribute('data-type') === 'formula');
    expect(formulas).toHaveLength(1);
    expect(formulas[0].getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(formulas[0].getAttribute('src')!.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<svg'); expect(svg).toContain('<path'); expect(svg).not.toContain('<math');
    expect(r.html).not.toContain('<math');
    const latex = formulas[0].getAttribute('data-latex');
    expect(latex).toContain('\\frac'); expect(latex).toContain('\\begin{matrix}1&2\\\\3&4\\end{matrix}');
    expect(r.html.indexOf('before')).toBeLessThan(r.html.indexOf('<img')); expect(r.html.indexOf('<img')).toBeLessThan(r.html.indexOf('after'));
  });
  it('allows explicit MathML output for consumers that need semantic markup', async () => {
    const r = await convertDocx(docx(p(`<m:oMath><m:f><m:num>${mt('x')}</m:num><m:den>${mt('2')}</m:den></m:f></m:oMath>`)), { formulaOutput: 'mathml' });
    expect(elements(r.html, 'mfrac')).toHaveLength(1);
    expect(elements(r.html, 'img')).toHaveLength(0);
  });
  it('keeps the SVG viewport complete when the paragraph specifies a font size', async () => {
    const formula = `<m:oMath><m:sSub><m:e>${mt('P')}</m:e><m:sub>${mt('c')}</m:sub></m:sSub>${mt('=')}<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:e>${mt('P')}</m:e></m:nary></m:oMath>`;
    const plain = await convertDocx(docx(p(formula)));
    const styles = `<w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
    const sized = await convertDocx(docx(p(formula), { styles }));
    const svg = (html: string) => Buffer.from(elements(html, 'img')[0].getAttribute('src')!.split(',')[1], 'base64').toString('utf8');
    const width = (value: string) => Number(value.match(/\bwidth="([\d.]+)ex"/)![1]);
    expect(width(svg(sized.html))).toBeCloseTo(width(svg(plain.html)), 2);
    expect(svg(sized.html)).toContain('viewBox=');
    expect(elements(sized.html, 'p')[0].getAttribute('style')).toContain('font-size:12pt');
  });
  it('preserves hidden n-ary limits and direct roman math style', async () => {
    const r = await convertDocx(docx(p(`<m:oMath><m:nary><m:naryPr><m:chr m:val="∑"/><m:subHide m:val="1"/></m:naryPr><m:sub>${mt('i')}</m:sub><m:sup>${mt('n')}</m:sup><m:e><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>real</m:t></m:r></m:e></m:nary></m:oMath>`)), { formulaOutput: 'mathml' });
    expect(elements(r.html, 'mover')).toHaveLength(1); expect(elements(r.html, 'munderover')).toHaveLength(0); expect(r.html).toContain('mathvariant="normal">real');
  });
  it('warns on unsupported math instead of attaching inaccurate LaTeX', async () => {
    const r = await convertDocx(docx(p(`<m:oMath><m:phant><m:e>${mt('x')}</m:e></m:phant></m:oMath>`)));
    expect(r.warnings.some(w => w.code === 'UNSUPPORTED_MATH')).toBe(true); expect(r.html).not.toContain('data-latex=');
    expect(elements(r.html, 'img')[0].getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
  });
  it('retains OLE resource and preview without inventing LaTeX', async () => {
    const r = await convertDocx(docx(p(`<w:r><w:object><v:shape style="width:40pt;height:20pt"><v:imagedata r:id="preview"/></v:shape><o:OLEObject ProgID="Equation.3" r:id="ole"/></w:object></w:r>`), { rels: `<Relationship Id="preview" Type="${R}/image" Target="media/a.png"/><Relationship Id="ole" Type="${R}/oleObject" Target="embeddings/e.bin"/>`, media: { 'a.png': png }, extra: { 'word/embeddings/e.bin': new Uint8Array([1, 2]) } }));
    expect(r.html).toContain('formula-item formula-image'); expect(r.html).not.toContain('data-latex'); expect(r.resources).toHaveLength(2); expect(r.stats.formulas).toBe(1);
  });
  it('attaches reconstructed OLE LaTeX to its preview image and rejects a stale WMF', async () => {
    const mtef = hex('03 01 01 03 00 01 02 83 78 00 02 83 2B 00 02 83 30 00 00 00');
    const body = p('<w:r><w:object><v:shape style="width:40pt;height:20pt"><v:imagedata r:id="preview"/></v:shape><o:OLEObject ProgID="Equation.3" r:id="ole"/></w:object></w:r>');
    const rels = `<Relationship Id="preview" Type="${R}/image" Target="media/a.wmf"/><Relationship Id="ole" Type="${R}/oleObject" Target="embeddings/e.bin"/>`;
    const convert = (label: string) => convertDocx(docx(body, { rels, media: { 'a.wmf': textWmf(label) }, extra: { 'word/embeddings/e.bin': oleEquation(mtef) } }), { images: { convert: () => ({ bytes: png, mimeType: 'image/png' }) } });
    const matching = await convert('x+0');
    expect(elements(matching.html, 'img')[0].getAttribute('data-latex')).toBe('x+0');
    expect(matching.resources).toHaveLength(2);
    const stale = await convert('x+9');
    expect(elements(stale.html, 'img')[0].hasAttribute('data-latex')).toBe(false);
    expect(stale.warnings.some(w => w.code === 'OLE_PREVIEW_MISMATCH')).toBe(true);
  });
  it('escapes OLE LaTeX inside the image attribute', async () => {
    const ole = oleEquation(hex('03 01 01 03 00 01 02 83 22 00 02 83 26 00 02 83 3C 00 00 00'));
    const body = p('<w:r><w:object><v:shape><v:imagedata r:id="preview"/></v:shape><o:OLEObject ProgID="Equation.3" r:id="ole"/></w:object></w:r>');
    const r = await convertDocx(docx(body, { rels: `<Relationship Id="preview" Type="${R}/image" Target="media/a.png"/><Relationship Id="ole" Type="${R}/oleObject" Target="embeddings/e.bin"/>`, media: { 'a.png': png }, extra: { 'word/embeddings/e.bin': ole } }));
    expect(elements(r.html, 'img')[0].getAttribute('data-latex')).toBe('"\\&<');
    expect(r.html).toContain('data-latex="&quot;\\&amp;&lt;"');
  });
  it('reports staged progress and marks complete only on success', async () => {
    const stages: string[] = [];
    await convertDocx(docx(p(text('a')) + '<w:tbl><w:tr><w:tc/></w:tr></w:tbl>'), { onProgress: event => stages.push(`${event.stage}:${event.total ?? ''}`) });
    expect(stages).toContain('parsing:2'); expect(stages.at(-1)).toBe('complete:');
    const errorStages: string[] = [];
    await expect(convertDocx(new Uint8Array([0]), { onProgress: e => errorStages.push(e.stage) })).rejects.toThrow(); expect(errorStages).not.toContain('complete');
  });
  it('supports cancellation before conversion and after an async image hook', async () => {
    const ctrl = new AbortController(); ctrl.abort(); await expect(convertDocx(docx(''), { signal: ctrl.signal })).rejects.toMatchObject({ code: 'ABORTED' });
    const during = new AbortController();
    await expect(convertDocx(docx(p(image()), { rels: `<Relationship Id="image1" Type="${R}/image" Target="media/a.png"/>`, media: { 'a.png': png } }), { signal: during.signal, images: { resolve: async () => { during.abort(); return '/a.png'; } } })).rejects.toMatchObject({ code: 'ABORTED' });
  });
  it('rejects XML entities, zip traversal, missing parts, depth and actual size limits', async () => {
    const truncated = docx(p(text('short'))).slice(0, -22);
    await expect(convertDocx(truncated)).rejects.toMatchObject({ code: 'INVALID_ZIP' });
    await expect(convertDocx(docx('', { extra: { 'word/document.xml': `<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><w:document ${ns}><w:body/></w:document>` } }))).rejects.toMatchObject({ code: 'UNSAFE_XML' });
    await expect(convertDocx(docx('', { extra: { '../escape': 'x' } }))).rejects.toMatchObject({ code: 'ZIP_PATH' });
    await expect(convertDocx(docx(p(text('a'))), { limits: { totalBytes: 30 } })).rejects.toMatchObject({ code: 'ZIP_LIMIT' });
    await expect(convertDocx(docx(p(text('a'))), { limits: { xmlDepth: 2 } })).rejects.toMatchObject({ code: 'XML_DEPTH' });
    await expect(convertDocx(docx(''), { limits: { entries: 1 } })).rejects.toMatchObject({ code: 'ZIP_ENTRIES' });
  });
  it('preserves explicit math font, size and color', async () => {
    const r = await convertDocx(docx(p(`<m:oMath><m:r><w:rPr><w:rFonts w:ascii="Cambria Math"/><w:sz w:val="32"/><w:color w:val="CC0000"/></w:rPr><m:t>x</m:t></m:r></m:oMath>`)), { formulaOutput: 'mathml' });
    const style = elements(r.html, 'mstyle')[0].getAttribute('style');
    expect(style).toContain('font-family:"Cambria Math"'); expect(style).toContain('font-size:16pt'); expect(style).toContain('#CC0000');
  });
  it('does not merge repeated stylesheet cycles infinitely', async () => {
    const styles = `<w:styles ${ns}><w:style w:styleId="a"><w:basedOn w:val="b"/></w:style><w:style w:styleId="b"><w:basedOn w:val="a"/></w:style></w:styles>`;
    const r = await convertDocx(docx(p(text('cycle'), '<w:pStyle w:val="a"/>'), { styles })); expect(r.warnings.some(w => w.code === 'STYLE_CYCLE')).toBe(true);
  });
  it('converts the representative fixture without warnings', async () => {
    const r = await convertDocx(sampleDocx()); expect(r.warnings).toEqual([]); expect(r.stats.formulas).toBe(2); expect(r.stats.tables).toBe(1); expect(r.stats.images).toBe(1);
  });
});
