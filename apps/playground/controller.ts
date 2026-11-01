import { downloadHtml, downloadJson, downloadPdf, downloadResources } from './downloads';
import { convertToPdf } from '../../src/index';
import type { PlaygroundView } from './ui/view';
import type { ConversionWorkerClient } from './worker/client';
import type { PlaygroundConversionResult } from './worker/protocol';

/** Keeps only the latest request across sample fetching, File reads and worker execution. */
export class PlaygroundController {
  private generation = 0;
  private result?: PlaygroundConversionResult;
  private filename = 'document';
  private pdfInput?: File | string;

  constructor(private readonly view: PlaygroundView, private readonly worker: ConversionWorkerClient) {}

  start(): void {
    this.view.bind({
      url: url => { void this.convertUrl(url); },
      file: file => { void this.convert(file); },
      sample: () => { void this.sample(); },
      cancel: () => { this.generation++; this.worker.cancel(); this.view.cancelled(); },
      download: () => { if (this.result) this.view.saved('HTML 已生成', downloadHtml(this.result, this.filename)); },
      json: () => { if (this.result) this.view.saved('JSON 已生成', downloadJson(this.result, this.filename)); },
      pdf: () => { void this.makePdf(); },
      resources: () => { if (this.result) this.view.saved('资源包已生成', downloadResources(this.result, this.filename)); },
      copy: () => { void this.copy(); },
    });
  }

  private reset(): number {
    const id = ++this.generation;
    this.worker.cancel(); this.result = undefined; this.view.reset();
    return id;
  }
  private async convertUrl(url: string): Promise<void> {
    const id = this.reset();
    this.pdfInput = url;
    this.filename = '网络文档'; this.view.filename(url);
    this.view.loading('下载并转换文档…', true);
    try {
      const result = await this.worker.convert(url, this.filename, event => {
        if (id === this.generation) this.view.updateProgress(event);
      });
      if (id !== this.generation) return;
      this.result = result; this.view.show(result);
    } catch (error) { if (id === this.generation) this.view.fail(error); }
  }
  private async convert(file: File): Promise<void> {
    const id = this.reset();
    this.pdfInput = file;
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
  private async makePdf(): Promise<void> {
    if (!this.pdfInput) return;
    const input = this.pdfInput;
    this.view.loading('正在生成 PDF…');
    try {
      const pdf = await convertToPdf(input, { title: this.filename });
      if (this.pdfInput !== input) return;
      // 生成耗时通常超过浏览器为用户手势保留的窗口，自动下载可能被拦掉，
      // 所以状态栏同时给出可再次点击的保存链接。
      this.view.saved(`PDF 已生成（${Math.round(pdf.bytes.length / 1024)} KB）`, downloadPdf(pdf.bytes, this.filename));
    } catch (error) { this.view.fail(error); }
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
