import { expect, it } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { docx, p, R } from '../fixtures/docx';

it('renders cached native line charts as images in both outputs, including labels and data table', async () => {
  const input = docx(p('<w:r><w:drawing><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="chart1"/></w:drawing></w:r>'), {
    rels: `<Relationship Id="chart1" Type="${R}/chart" Target="charts/chart1.xml"/>`,
    extra: { 'word/charts/chart1.xml': '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:lineChart><c:grouping val="standard"/><c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>收益</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:numLit><c:pt idx="0"><c:v>1</c:v></c:pt><c:pt idx="1"><c:v>2</c:v></c:pt></c:numLit></c:cat><c:val><c:numLit><c:formatCode>0%</c:formatCode><c:pt idx="0"><c:v>-0.6</c:v></c:pt><c:pt idx="1"><c:v>0.03</c:v></c:pt></c:numLit></c:val></c:ser></c:lineChart><c:valAx><c:scaling><c:min val="-0.6"/><c:max val="0.05"/></c:scaling><c:numFmt formatCode="0%"/></c:valAx><c:dTable/></c:plotArea></c:chart></c:chartSpace>' },
  });
  const html = await convertToHtml(input);
  expect(html.html).toContain('data:image/svg+xml;base64,');
  expect(html.warnings).toEqual([]);
  const json = await convertToJson(input);
  const block = json.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'image') throw new Error('Missing chart image');
  const svg = Buffer.from(block.children[0].src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('收益'); expect(svg).toContain('-60%'); expect(svg).toContain('3%');
  expect(svg).toContain('<path'); expect(html.stats.images).toBe(1);
});
