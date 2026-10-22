import { DocxError } from '../contracts/errors.js';
import type { ConversionOptions, Diagnostic, ProgressEvent } from '../contracts/conversion.js';
import type { ConversionContext } from '../contracts/ports.js';

/** One session per invocation: concurrent conversions never share state. */
export class ConversionSession {
  readonly warnings: Diagnostic[] = [];
  private readonly warned = new Set<string>();

  constructor(private readonly options: Pick<ConversionOptions, 'signal' | 'onProgress'>) {}

  checkAbort(): void {
    if (this.options.signal?.aborted) throw new DocxError('ABORTED', '转换已取消');
  }

  progress(event: ProgressEvent): void {
    this.options.onProgress?.(event);
  }

  forPart(part: string): ConversionContext {
    return {
      report: diagnostic => { this.warnings.push(diagnostic); },
      warn: (code, message) => {
        const key = JSON.stringify([part, code, message]);
        if (this.warned.has(key)) return;
        this.warned.add(key);
        this.warnings.push({ code, message, part });
      },
      checkAbort: () => this.checkAbort(),
      progress: event => this.progress(event),
    };
  }
}
