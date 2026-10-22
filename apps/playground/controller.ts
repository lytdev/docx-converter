import { downloadHtml, downloadResources } from './downloads';
import type { PlaygroundView } from './ui/view';
import type { ConversionWorkerClient } from './worker/client';
import type { PlaygroundConversionResult } from './worker/protocol';

/** Keeps only the latest request across sample fetching, File reads and worker execution. */
export class PlaygroundController {
  private generation = 0;
  private result?: PlaygroundConversionResult;
  private filename = 'document';

  constructor(private readonly view: PlaygroundView, private readonly worker: ConversionWorkerClient) {}

  start(): void {
    this.view.bind({
      file: file => { void this.convert(file); },
      sample: () => { void this.sample(); },
      cancel: () => { this.generation++; this.worker.cancel(); this.view.cancelled(); },
      download: () => { if (this.result) downloadHtml(this.result, this.filename); },
      resources: () => { if (this.result) downloadResources(this.result, this.filename); },
      copy: () => { void this.copy(); },
    });
  }

  private reset(): number {
    const id = ++this.generation;
    this.worker.cancel(); this.result = undefined; this.view.reset();
    return id;
  }
  private async convert(file: File): Promise<void> {
    const id = this.reset();
    this.filename = file.name.replace(/\.docx$/i, '') || 'document';
    this.view.filename(file.name);
    if (!/\.docx$/i.test(file.name)) return this.view.fail('请选择 .docx 文件。');
    if (file.size > 50 * 1024 * 1024) return this.view.fail('文件超过 50 MB 限制。');
    this.view.loading('读取文档…', true);
    try {
      const bytes = await file.arrayBuffer();
      if (id !== this.generation) return;
      const result = await this.worker.convert(bytes, this.filename, event => {
        if (id === this.generation) this.view.updateProgress(event);
      });
      if (id !== this.generation) return;
      this.result = result; this.view.show(result);
    } catch (error) { if (id === this.generation) this.view.fail(error); }
  }
  private async sample(): Promise<void> {
    const id = this.reset();
    this.view.loading('加载示例…'); this.view.sampleBusy(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample.docx`);
      if (!response.ok) throw new Error('示例文件加载失败');
      const bytes = await response.blob();
      if (id === this.generation) await this.convert(new File([bytes], '示例文档.docx'));
    } catch (error) { if (id === this.generation) this.view.fail(error); }
    finally { this.view.sampleBusy(false); }
  }
  private async copy(): Promise<void> {
    if (!this.result) return;
    try { await navigator.clipboard.writeText(this.result.html); this.view.copied(); }
    catch { this.view.selectSource(); }
  }
}
