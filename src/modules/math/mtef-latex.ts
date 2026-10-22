/** Conservative MTEF 3/5 decoder: an unsupported record invalidates the entire expression. */
type Node = { kind: 'line' | 'char' | 'char3' | 'template3' | 'template5' | 'pile' | 'matrix' | 'embell'; value: number; variant: number; children: Node[] };
const requireValue = (valid: boolean): void => { if (!valid) throw new Error('Unsupported or malformed MTEF'); };
const script = (marker: string, value: string): string => value ? `${marker}{${value}}` : '';
const join = (nodes: Node[]): string => nodes.map(render).join('');
const slot = (nodes: Node[], index: number): string => { requireValue(index < nodes.length); return render(nodes[index]); };

function template(node: Node, version: number): string {
  const slots = node.children.filter(n => n.kind === 'line' || n.kind === 'pile');
  requireValue(node.children.every(n => n.kind === 'line' || n.kind === 'pile' || n.kind.startsWith('char')));
  const id = node.value, variation = node.variant;
  if (id <= 7) {
    requireValue(slots.length === 1 && (version === 3 ? variation <= 2 : (variation & ~3) === 0));
    const left = ['\\langle', '(', '\\{', '[', '|', '\\Vert', '\\lfloor', '\\lceil'];
    const right = ['\\rangle', ')', '\\}', ']', '|', '\\Vert', '\\rfloor', '\\rceil'];
    const hasLeft = version === 3 ? variation !== 2 : (variation & 1) !== 0;
    const hasRight = version === 3 ? variation !== 1 : (variation & 2) !== 0;
    return `\\left${hasLeft ? left[id] : '.'} ${slot(slots, 0)}\\right${hasRight ? right[id] : '.'}`;
  }
  if (id === (version === 3 ? 13 : 10)) {
    requireValue(variation <= 1 && slots.length >= 1 && slots.length <= 2);
    return variation === 0 ? `\\sqrt{${slot(slots, 0)}}` : `\\sqrt[${slot(slots, 1)}]{${slot(slots, 0)}}`;
  }
  if (id === (version === 3 ? 14 : 11)) {
    requireValue(slots.length === 2 && variation <= 1);
    return `\\frac{${slot(slots, 0)}}{${slot(slots, 1)}}`;
  }
  if (version === 3 && id === 41) {
    // MTEF 3 slash fractions have numerator and denominator slots in that order.
    // LaTeX \frac preserves the quotient semantics; the preview image keeps its diagonal appearance.
    requireValue(slots.length === 2 && variation <= 2);
    return `\\frac{${slot(slots, 0)}}{${slot(slots, 1)}}`;
  }
  if ((version === 3 && id === 15) || (version === 5 && id >= 27 && id <= 29)) {
    requireValue(slots.length === 2 && (version === 3 ? variation <= 2 : variation === 0));
    return script('_', slot(slots, 0)) + script('^', slot(slots, 1));
  }
  if (id === (version === 3 ? 16 : 12) || id === (version === 3 ? 17 : 13)) {
    requireValue(slots.length === 1 && variation <= 1);
    const command = id === (version === 3 ? 16 : 12) ? '\\underline' : '\\overline';
    const result = `${command}{${slot(slots, 0)}}`;
    return variation === 0 ? result : `${command}{${result}}`;
  }
  if ((version === 3 && id >= 29 && id <= 38) || (version === 5 && id >= 16 && id <= 20)) {
    requireValue(slots.length === 3 && (version === 3 ? variation <= 2 : (variation & ~0x43) === 0));
    const operators = ['\\sum', '\\prod', '\\coprod', '\\bigcup', '\\bigcap'];
    const index = version === 3 ? Math.floor((id - 29) / 2) : id - 16;
    const limits = version === 3 ? id % 2 === 1 : (variation & 64) !== 0;
    return `${operators[index]}${limits ? '\\limits' : '\\nolimits'}${script('_', slot(slots, 2))}${script('^', slot(slots, 1))} ${slot(slots, 0)}`;
  }
  if (id === (version === 3 ? 39 : 23)) {
    requireValue(slots.length === 3 && variation <= 2);
    return `\\mathop{${slot(slots, 0)}}\\limits${script('_', slot(slots, 1))}${script('^', slot(slots, 2))}`;
  }
  throw new Error('Unsupported MTEF template');
}

function character(node: Node): string {
  requireValue(node.variant > 0);
  const c = node.value, char = String.fromCodePoint(c);
  if (node.kind === 'char3' && node.variant >= 4 && node.variant <= 6 && c < 256) requireValue(!/\p{L}/u.test(char));
  requireValue(c >= 32 && c <= 0xffff && !(/[\p{Cc}\p{Co}\p{Cs}]/u.test(char)));
  const symbols: Record<number, string> = {
    0x2212: '-', 0x03b1: '\\alpha ', 0x03b2: '\\beta ', 0x03b3: '\\gamma ', 0x03b4: '\\delta ',
    0x03b8: '\\theta ', 0x03bb: '\\lambda ', 0x03bc: '\\mu ', 0x03c0: '\\pi ', 0x03c3: '\\sigma ',
    0x03c6: '\\phi ', 0x03c9: '\\omega ', 0x221e: '\\infty ', 0x2264: '\\leq ', 0x2265: '\\geq ',
    0x2260: '\\neq ', 0x00d7: '\\times ', 0x00f7: '\\div ', 0x00b1: '\\pm ', 0x2192: '\\to ',
  };
  let value = symbols[c] ?? (c === 92 ? '\\backslash ' : '{}#$%&_'.includes(char) ? `\\${char}` : char === '^' ? '\\hat{}' : char === '~' ? '\\sim ' : char);
  if ((node.variant === 1 || node.variant === 2) && /\p{L}/u.test(char)) value = `\\mathrm{${value}}`;
  if (node.variant === 7) value = `\\mathbf{${value}}`;
  for (const embell of node.children) {
    requireValue(embell.kind === 'embell');
    const command: Record<number, string> = { 2: 'dot', 3: 'ddot', 4: 'dddot', 8: 'tilde', 9: 'hat', 10: 'not', 11: 'vec', 12: 'overleftarrow', 13: 'overleftrightarrow', 17: 'bar' };
    if (command[embell.value]) value = `\\${command[embell.value]}{${value}}`;
    else if ([5, 6, 18].includes(embell.value)) value += "'".repeat(embell.value === 5 ? 1 : embell.value === 6 ? 2 : 3);
    else throw new Error('Unsupported embellishment');
  }
  return value;
}

function render(node: Node): string {
  switch (node.kind) {
    case 'line': return join(node.children);
    case 'char': case 'char3': return character(node);
    case 'template3': return template(node, 3);
    case 'template5': return template(node, 5);
    case 'pile': return `\\begin{gathered}${node.children.map(render).join('\\\\')}\\end{gathered}`;
    case 'matrix': return `\\begin{matrix}${node.children.map((part, i) => `${i ? (i % node.variant === 0 ? '\\\\' : '&') : ''}${render(part)}`).join('')}\\end{matrix}`;
    default: throw new Error('Unexpected MTEF node');
  }
}

class Reader {
  private pos = 0;
  private depth = 0;
  private records = 0;
  private readonly version: number;
  constructor(private readonly data: Uint8Array) {
    this.version = this.read();
    requireValue(this.version === 3 || this.version === 5);
    this.skip(4);
    if (this.version === 5) { this.string(); this.read(); }
  }
  convert(): string {
    const latex = join(this.list());
    while (this.pos < this.data.length) requireValue(this.read() === 0);
    return latex;
  }
  private list(): Node[] {
    requireValue(++this.depth <= 128);
    const nodes: Node[] = [];
    while (true) {
      requireValue(++this.records <= 100_000);
      const tag = this.read(), type = this.version === 3 ? tag & 15 : tag;
      if (type === 0) break;
      const flags = this.version === 3 ? tag >>> 4 : type <= 6 ? this.read() : 0;
      if (type <= 6 && (flags & 8)) this.nudge();
      const node = this.record(type, flags);
      if (node) nodes.push(node);
    }
    this.depth--;
    return nodes;
  }
  private record(type: number, flags: number): Node | undefined {
    switch (type) {
      case 1:
        if (flags & 4) this.skip(2);
        if (flags & 2) this.rulerRecord();
        return { kind: 'line', value: 0, variant: 0, children: (flags & 1) ? [] : this.list() };
      case 2: {
        const face = this.version === 3 ? this.read() - 128 : this.signed();
        requireValue(this.version === 3 || !(flags & 32));
        const code = this.word();
        if (this.version === 5) { if (flags & 4) this.read(); if (flags & 16) this.word(); }
        const embellished = !!(flags & (this.version === 3 ? 2 : 1));
        return { kind: this.version === 3 ? 'char3' : 'char', value: code, variant: face, children: embellished ? this.list() : [] };
      }
      case 3: {
        const selector = this.read(); let variation = this.read();
        if (this.version === 5 && (variation & 128)) variation = (variation & 127) | (this.read() << 8);
        this.read();
        return { kind: this.version === 3 ? 'template3' : 'template5', value: selector, variant: variation, children: this.list() };
      }
      case 4:
        this.skip(2); if (flags & 2) this.rulerRecord();
        return { kind: 'pile', value: 0, variant: 0, children: this.list() };
      case 5: {
        this.skip(3); const rows = this.read(), cols = this.read();
        requireValue(rows > 0 && cols > 0 && rows * cols <= 10_000);
        for (let i = Math.floor((rows + 4) / 4) + Math.floor((cols + 4) / 4); i > 0; i--) requireValue(this.read() === 0);
        const cells = this.list(); requireValue(cells.length === rows * cols);
        return { kind: 'matrix', value: rows, variant: cols, children: cells };
      }
      case 6: {
        const embell = this.read(); if (this.version === 3) requireValue(this.read() === 0);
        return { kind: 'embell', value: embell, variant: 0, children: [] };
      }
      case 7: this.ruler(); break;
      case 8: if (this.version === 3) { this.skip(2); this.string(); } else { this.unsigned(); this.read(); } break;
      case 9: { const size = this.read(); this.skip(size === 101 ? 2 : size === 100 ? 3 : 1); break; }
      case 10: case 11: case 12: case 13: case 14: break;
      case 15: requireValue(this.version === 5); this.unsigned(); break;
      case 16: { requireValue(this.version === 5); const options = this.read(); this.skip(options & 1 ? 8 : 6); if (options & 4) this.string(); break; }
      case 17: requireValue(this.version === 5); this.unsigned(); this.string(); break;
      case 18: {
        requireValue(this.version === 5); this.read(); this.dimensions(); this.dimensions();
        const count = this.read(); for (let i = 0; i < count; i++) if (this.unsigned() !== 0) this.read(); break;
      }
      case 19: requireValue(this.version === 5); this.string(); break;
      default: throw new Error('Unsupported MTEF record');
    }
    return;
  }
  private rulerRecord(): void { requireValue(this.read() === 7); this.ruler(); }
  private ruler(): void { this.skip(this.read() * 3); }
  private nudge(): void { const x = this.read(), y = this.read(); if (x === 128 && y === 128) this.skip(4); }
  private unsigned(): number { const b = this.read(); return b === 255 ? this.word() : b; }
  private signed(): number { const b = this.read(); return b === 255 ? this.word() - 32768 : b - 128; }
  private string(): void { while (this.read() !== 0) { /* zero-terminated metadata */ } }
  private dimensions(): void {
    let count = this.read();
    while (count > 0) { const b = this.read(); if ((b >>> 4) === 15) count--; if (count > 0 && (b & 15) === 15) count--; }
  }
  private read(): number { requireValue(this.pos < this.data.length); return this.data[this.pos++]; }
  private word(): number { return this.read() | (this.read() << 8); }
  private skip(count: number): void { requireValue(count >= 0 && count <= this.data.length - this.pos); this.pos += count; }
}

/** Reconstruct LaTeX from editable MTEF, never from the preview pixels. */
export function mtefLatex(data: Uint8Array): string | undefined {
  try { return new Reader(data).convert() || undefined; } catch { return; }
}
