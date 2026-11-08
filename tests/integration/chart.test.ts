import { expect, it } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { docx, p, R } from '../fixtures/docx';
import { jsonElement } from '../fixtures/html-json';

it('renders cached native line charts as images in both outputs, including labels and data table', async () => {
  const input = docx(p('<w:r><w:drawing><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="chart1"/></w:drawing></w:r>'), {
    rels: `<Relationship Id="chart1" Type="${R}/chart" Target="charts/chart1.xml"/>`,
    extra: { 'word/charts/chart1.xml': '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:lineChart><c:grouping val="standard"/><c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>收益</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:numLit><c:pt idx="0"><c:v>1</c:v></c:pt><c:pt idx="1"><c:v>2</c:v></c:pt></c:numLit></c:cat><c:val><c:numLit><c:formatCode>0%</c:formatCode><c:pt idx="0"><c:v>-0.6</c:v></c:pt><c:pt idx="1"><c:v>0.03</c:v></c:pt></c:numLit></c:val></c:ser></c:lineChart><c:valAx><c:scaling><c:min val="-0.6"/><c:max val="0.05"/></c:scaling><c:numFmt formatCode="0%"/></c:valAx><c:dTable/></c:plotArea></c:chart></c:chartSpace>' },
  });
  const html = await convertToHtml(input);
  expect(html.html).toContain('data:image/png;base64,');
  expect(html.warnings).toEqual([]);
  const pngJson = await convertToJson(input);
  expect(jsonElement(pngJson, 'img').src).toMatch(/^data:image\/png;base64,/);

  const svgJson = await convertToJson(input, { generatedImageOutput: 'svg' });
  const svg = Buffer.from(jsonElement(svgJson, 'img').src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('收益'); expect(svg).toContain('-60%'); expect(svg).toContain('3%');
  expect(svg).toContain('<path'); expect(html.stats.images).toBe(1);
});

it('renders cached clustered column charts with category labels and series colors', async () => {
  const input = docx(p('<w:r><w:drawing><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="chart1"/></w:drawing></w:r>'), {
    rels: `<Relationship Id="chart1" Type="${R}/chart" Target="charts/chart1.xml"/>`,
    extra: { 'word/charts/chart1.xml': '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:plotArea><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>系列 1</c:v></c:pt></c:strCache></c:strRef></c:tx><c:spPr><a:solidFill><a:srgbClr val="4874CB"/></a:solidFill></c:spPr><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>类别1</c:v></c:pt><c:pt idx="1"><c:v>类别2</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>4.3</c:v></c:pt><c:pt idx="1"><c:v>2.5</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser><c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:min val="0"/><c:max val="5"/></c:scaling></c:valAx></c:plotArea></c:chart></c:chartSpace>' },
  });
  const result = await convertToJson(input, { generatedImageOutput: 'svg' });
  const svg = Buffer.from(jsonElement(result, 'img').src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('fill="#4874CB"');
  expect(svg).toContain('类别1');
  expect(svg).toContain('类别2');
});
