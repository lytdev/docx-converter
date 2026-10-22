import type { Block, Cell, Css, Row, Table } from '../../domain/document.js';
import { pt } from '../../shared/units.js';
import { width } from '../styles/ooxml-values.js';
import { attr, child, children, is, number, val } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { ParseContext } from './parse-context.js';
export class TableParser {
  constructor(private readonly context: ParseContext, private readonly parseBlocks: (parent: X) => Block[]) {}
  parse(el: X): Table {
    this.context.stats.tables++;
    const pr = child(el, 'tblPr');
    const styleId = val(child(pr, 'tblStyle'));
    const inherited = this.context.styles.resolve(styleId).table;
    const tb = { ...this.context.styles.borders(child(inherited, 'tblBorders')), ...this.context.styles.borders(child(pr, 'tblBorders')) };
    const css: Css = { 'border-collapse': 'collapse', border: 'none', 'max-width': '100%' };
    const tw = width(child(pr, 'tblW') ?? child(inherited, 'tblW')); if (tw) css.width = tw;
    const jc = val(child(pr, 'jc')); if (jc === 'center') { css['margin-left'] = 'auto'; css['margin-right'] = 'auto'; } else if (jc === 'right') css['margin-left'] = 'auto';
    const grid = children(child(el, 'tblGrid')).map(g => number(attr(g, 'w')) / 20);
    const rows: Row[] = [];
    const placements: { cell: Cell; row: number; col: number; overrides: Css }[] = [];
    let previous = new Map<number, typeof placements[number]>();
    let totalCols = grid.length;
    const trEls = children(el).filter(e => is(e, 'tr'));
    for (let ri = 0; ri < trEls.length; ri++) {
      const rowEl = trEls[ri], rowPr = child(rowEl, 'trPr');
      const row: Row = { cells: [], css: {} }, current = new Map<number, typeof placements[number]>();
      const height = attr(child(rowPr, 'trHeight'), 'val'); if (height) row.css.height = pt(number(height) / 20);
      let col = Math.max(0, number(val(child(rowPr, 'gridBefore'))));
      if (col) row.cells.push({ blocks: [], colspan: col, rowspan: 1, css: { border: 'none' } });
      for (const tc of children(rowEl).filter(e => is(e, 'tc'))) {
        const cp = child(tc, 'tcPr');
        const colspan = Math.min(1000, Math.max(1, number(val(child(cp, 'gridSpan')), 1)));
        const vm = child(cp, 'vMerge'), restart = vm && val(vm) === 'restart';
        const over = this.context.styles.borders(child(cp, 'tcBorders'));
        const above = previous.get(col);
        if (vm && !restart && above && above.cell.colspan === colspan) {
          above.cell.rowspan++;
          // Continue rows may redefine the bottom edge of the merged region.
          if (over.bottom !== undefined) above.overrides.bottom = over.bottom;
          current.set(col, above); col += colspan; continue;
        }
        if (vm && !restart) this.context.operations.warn('INVALID_MERGE', '纵向合并缺少对应起始单元格，已按普通单元格保留');
        const cellCss: Css = { padding: '4pt 5pt' };
        const cw = width(child(cp, 'tcW')); if (cw) cellCss.width = cw;
        else if (grid.length >= col + colspan) cellCss.width = pt(grid.slice(col, col + colspan).reduce((a, b) => a + b, 0));
        const bg = this.context.styles.resolveColor(child(cp, 'shd'), 'fill'); if (bg) cellCss['background-color'] = bg;
        const va = val(child(cp, 'vAlign')); cellCss['vertical-align'] = va === 'center' ? 'middle' : va === 'bottom' ? 'bottom' : 'top';
        for (const side of ['top', 'bottom', 'left', 'right']) {
          const margin = width(child(child(cp, 'tcMar'), side) ?? child(child(pr, 'tblCellMar'), side) ?? child(child(inherited, 'tblCellMar'), side));
          if (margin) cellCss[`padding-${side}`] = margin;
        }
        const cell: Cell = { colspan, rowspan: 1, css: cellCss, blocks: this.parseBlocks(tc) };
        const placement = { cell, row: ri, col, overrides: over };
        placements.push(placement); row.cells.push(cell);
        if (restart) current.set(col, placement);
        col += colspan;
      }
      totalCols = Math.max(totalCols, col);
      previous = current; rows.push(row);
    }
    for (const p of placements) {
      const { cell, row, col, overrides } = p;
      const borders: Css = { top: row === 0 ? tb.top : tb.insideH, bottom: row + cell.rowspan === rows.length ? tb.bottom : tb.insideH, left: col === 0 ? tb.left : tb.insideV, right: col + cell.colspan === totalCols ? tb.right : tb.insideV };
      for (const side of ['top', 'bottom', 'left', 'right']) cell.css[`border-${side}`] = overrides[side] ?? borders[side] ?? 'none';
    }
    return { kind: 'table', css, rows };
  }
}
