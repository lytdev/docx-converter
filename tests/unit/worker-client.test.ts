import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConversionWorkerClient } from '../../apps/playground/worker/client';
import type { ConversionResponse } from '../../apps/playground/worker/protocol';
import type { PlaygroundConversionResult } from '../../apps/playground/worker/protocol';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: MessageEvent<ConversionResponse>) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  respond(data: ConversionResponse): void { this.onmessage?.({ data } as MessageEvent<ConversionResponse>); }
}
const result: PlaygroundConversionResult = { html: '<p>done</p>', warnings: [], resources: [], convertedImages: [], stats: { paragraphs: 1, tables: 0, images: 0, formulas: 0 } };
beforeEach(() => { FakeWorker.instances = []; vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('settles and terminates the old job before starting a replacement', async () => {
  const client = new ConversionWorkerClient(), progress = vi.fn();
  const first = client.convert(new ArrayBuffer(1), 'first', progress);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const second = client.convert(new ArrayBuffer(1), 'second', progress);
  await rejected;
  const [oldWorker, worker] = FakeWorker.instances;
  expect(oldWorker.terminate).toHaveBeenCalledOnce();
  oldWorker.respond({ type: 'progress', event: { stage: 'complete' } });
  expect(progress).not.toHaveBeenCalled();
  worker.respond({ type: 'result', result });
  await expect(second).resolves.toEqual(result);
  expect(worker.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});

it('releases the timer and worker when cancelled or timed out', async () => {
  const client = new ConversionWorkerClient();
  const pending = client.convert(new ArrayBuffer(1), 'cancel', vi.fn());
  const cancelled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  client.cancel(); client.cancel(); await cancelled;
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  const timeout = client.convert(new ArrayBuffer(1), 'timeout', vi.fn());
  const expired = expect(timeout).rejects.toThrow('转换超过 60 秒');
  await vi.advanceTimersByTimeAsync(60000); await expired;
  expect(FakeWorker.instances[1].terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});

it('propagates worker errors while cleaning up the job', async () => {
  const client = new ConversionWorkerClient();
  const pending = client.convert(new ArrayBuffer(1), 'error', vi.fn());
  const rejected = expect(pending).rejects.toThrow('invalid docx');
  FakeWorker.instances[0].respond({ type: 'error', message: 'invalid docx' });
  await rejected;
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
