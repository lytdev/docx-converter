import { docx, R } from './docx';

const body = `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="3810000" cy="1905000"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:dm="data1"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

const data = `<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram"><dgm:ptLst><dgm:pt modelId="1"><dgm:t><a:p><a:r><a:t>步骤一</a:t></a:r></a:p></dgm:t></dgm:pt><dgm:pt modelId="2"><dgm:t><a:p><a:r><a:t>步骤二</a:t></a:r></a:p></dgm:t></dgm:pt></dgm:ptLst><dgm:extLst><a:ext><dsp:dataModelExt relId="drawing1"/></a:ext></dgm:extLst></dgm:dataModel>`;

const shape = (x: number, geometry: string, text: string) => `<dsp:sp><dsp:nvSpPr><dsp:cNvPr id="1" name="${geometry}"/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x="${x}" y="0"/><a:ext cx="762000" cy="952500"/></a:xfrm><a:prstGeom prst="${geometry}"/></dsp:spPr><dsp:style><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef></dsp:style><dsp:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="1800"/><a:t>${text}</a:t></a:r></a:p></dsp:txBody></dsp:sp>`;

export const smartArtDocx = (shapes = [
  { geometry: 'roundRect', text: '步骤一' },
  { geometry: 'pieWedge', text: '步骤二' },
]) => {
  const width = Math.max(762000, shapes.length * 762000);
  const drawing = `<dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="1" name="组合 1"/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="952500"/><a:chOff x="0" y="0"/><a:chExt cx="${width}" cy="952500"/></a:xfrm></dsp:grpSpPr>${shapes.map((item, index) => shape(index * 762000, item.geometry, item.text)).join('')}</dsp:spTree></dsp:drawing>`;
  return docx(body, {
  rels: `<Relationship Id="data1" Type="${R}/diagramData" Target="diagrams/data1.xml"/><Relationship Id="drawing1" Type="http://schemas.microsoft.com/office/2007/relationships/diagramDrawing" Target="diagrams/drawing1.xml"/>`,
  extra: { 'word/diagrams/data1.xml': data, 'word/diagrams/drawing1.xml': drawing },
  });
};
