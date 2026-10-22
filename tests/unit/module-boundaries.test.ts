import { describe, expect, it, vi } from 'vitest';
import { dependencyAllowed, findCycles } from '../../scripts/check-architecture';
import { ConversionSession } from '../../src/application/conversion-session';
import { HtmlRenderer } from '../../src/rendering/html/html-renderer';
import type { DocumentModel } from '../../src/domain/document';
import type { ResourceReader } from '../../src/contracts/ports';
import { png } from '../fixtures/docx';

describe('module boundaries', () => {
  it('renders a supplied model through resource ports without a package or parser', async () => {
    const resources: ResourceReader = { bytes: () => png, mime: () => 'image/png' };
    const model: DocumentModel = { blocks: [{ kind: 'paragraph', style: { css: {} }, children: [
      { kind: 'text', text: 'Hello <world>', style: { bold: true } },
      { kind: 'image', path: 'picture.png', alt: '图', formula: false, css: {} },
    ] }] };
    const session = new ConversionSession({});
    const html = await new HtmlRenderer(resources, session.forPart('body'), { output: 'fragment' }).render(model);
    expect(html).toContain('Hello &lt;world&gt;');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('data:image/png;base64,');
    expect(session.warnings).toEqual([]);
  });

  it('keeps warnings, cancellation and progress isolated per conversion session', () => {
    const abort = new AbortController(), onProgress = vi.fn();
    const first = new ConversionSession({ signal: abort.signal, onProgress });
    const second = new ConversionSession({});
    first.forPart('a').warn('UNSUPPORTED', 'a');
    first.forPart('a').warn('UNSUPPORTED', 'a');
    first.forPart('b').warn('UNSUPPORTED', 'a');
    expect(first.warnings).toHaveLength(2); expect(second.warnings).toEqual([]);
    first.forPart('a').progress({ stage: 'parsing' });
    expect(onProgress).toHaveBeenCalledOnce();
    abort.abort();
    expect(() => first.checkAbort()).toThrow('转换已取消');
    expect(() => second.checkAbort()).not.toThrow();
  });

  it('rejects upward and feature-crossing dependencies, including type-only edges', () => {
    expect(dependencyAllowed('src/rendering/html/html-renderer.ts', 'src/modules/document/document-parser.ts')).toBe(false);
    expect(dependencyAllowed('src/modules/math/omml-converter.ts', 'src/modules/document/inline-parser.ts')).toBe(false);
    expect(dependencyAllowed('src/shared/markup.ts', 'src/application/convert-docx.ts')).toBe(false);
    expect(dependencyAllowed('apps/playground/main.ts', 'src/infrastructure/opc/docx-package.ts')).toBe(false);
    expect(dependencyAllowed('apps/playground/main.ts', 'src/index.ts')).toBe(true);
    expect(dependencyAllowed('src/rendering/html/image-renderer.ts', 'src/modules/images/image-resolver.ts')).toBe(true);
    expect(findCycles(new Map([['a', ['b']], ['b', ['a']]]))).toEqual(['a → b → a']);
    expect(findCycles(new Map([['a', ['b', 'c']], ['b', ['c']], ['c', []]]))).toEqual([]);
  });
});
