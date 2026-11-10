import { expect, it } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { docx, p } from '../fixtures/docx';
import { jsonElement } from '../fixtures/html-json';

const theme = `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Test"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4874CB"/></a:accent1><a:accent2><a:srgbClr val="EE822F"/></a:accent2><a:accent3><a:srgbClr val="F2BA02"/></a:accent3><a:accent4><a:srgbClr val="75BD42"/></a:accent4><a:accent5><a:srgbClr val="30C0B4"/></a:accent5><a:accent6><a:srgbClr val="E54C5E"/></a:accent6></a:clrScheme></a:themeElements></a:theme>`;

const shape = (geometry: string, text: string, spPrExtra = '') => p(`<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><mc:Choice Requires="wps"><w:drawing><wp:inline><wp:extent cx="1905000" cy="952500"/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="952500"/></a:xfrm><a:prstGeom prst="${geometry}"/>${spPrExtra}</wps:spPr><wps:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef></wps:style><wps:txbx><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent></wps:txbx><wps:bodyPr anchor="ctr"/></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape/></w:pict></mc:Fallback></mc:AlternateContent>`);

it('renders a standalone upArrowCallout with no fill and its theme outline', async () => {
  const input = docx(shape('upArrowCallout', '测试箭头向上', '<a:noFill/>'), { theme });
  const json = await convertToJson(input, { generatedImageOutput: 'svg' });
  const image = jsonElement(json, 'img');
  expect(image.alt).toBe('测试箭头向上');
  const svg = Buffer.from(image.src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('fill="none"');
  expect(svg).toContain('stroke="#365798"');
  expect(svg).toContain('<rect');
  expect(svg).toContain('测试箭头向上');
  expect(svg).toMatch(/L100 0L/);
  const html = await convertToHtml(input, { generatedImageOutput: 'svg' });
  expect(html.html).toContain(image.src);
  expect(html.warnings).toEqual([]);
});

it('renders a standalone star12 using the theme accent fill', async () => {
  const input = docx(shape('star12', '爆炸'), { theme });
  const json = await convertToJson(input, { generatedImageOutput: 'svg' });
  const svg = Buffer.from(jsonElement(json, 'img').src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('fill="#4874CB"');
  expect(svg).toContain('stroke="#365798"');
  expect((svg.match(/L/g) ?? []).length).toBeGreaterThanOrEqual(22);
  expect(svg).toContain('>爆炸</text>');
});
