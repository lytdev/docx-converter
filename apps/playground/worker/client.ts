import type { ProgressEvent } from '../../../src/index';
import type { ConversionRequest, ConversionResponse, PlaygroundConversionResult } from './protocol';

/** Owns one job and releases its worker, timer and pending promise together. */
export class ConversionWorkerClient {
  private cancelJob?: () => void;
  cancel(): void { this.cancelJob?.(); }

  convert(bytes: ArrayBuffer, title: string, onProgress: (event: ProgressEvent) => void): Promise<PlaygroundConversionResult> {
    this.cancel();
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./entry.ts', import.meta.url), { type: 'module' });
      let settled = false;
      const finish = (result?: PlaygroundConversionResult, error?: Error) => {
        if (settled) return;
        settled = true;
        worker.terminate(); clearTimeout(timer); this.cancelJob = undefined;
        if (error) reject(error); else resolve(result!);
      };
      const timer = setTimeout(() => finish(undefined, new Error('转换超过 60 秒，已停止。可以拆分文档后重试。')), 60000);
      this.cancelJob = () => finish(undefined, new DOMException('已取消', 'AbortError'));
      worker.onerror = () => finish(undefined, new Error('转换进程启动或运行失败，请刷新后重试。'));
      worker.onmessage = ({ data }: MessageEvent<ConversionResponse>) => {
        if (settled) return;
        switch (data.type) {
          case 'progress': onProgress(data.event); break;
          case 'result': finish(data.result); break;
          case 'error': finish(undefined, new Error(data.message)); break;
        }
      };
      const request: ConversionRequest = { bytes, title };
      try { worker.postMessage(request, [bytes]); }
      catch (error) { finish(undefined, error instanceof Error ? error : new Error(String(error))); }
    });
  }
}
