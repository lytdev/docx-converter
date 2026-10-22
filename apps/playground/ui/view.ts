import type { ProgressEvent } from '../../../src/index';
import type { PlaygroundConversionResult } from '../worker/protocol';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Tab = 'preview' | 'source';
export interface ViewActions {
  file(file: File): void;
  sample(): void;
  cancel(): void;
  download(): void;
  resources(): void;
  copy(): void;
}

/** Owns DOM presentation; conversion results and task lifetimes live in the controller. */
export class PlaygroundView {
  private selected: Tab = 'preview';
  private hasResult = false;
  private preview = el<HTMLIFrameElement>('preview');
  private pendingPreview?: string;
  private readonly source = el<HTMLTextAreaElement>('source');
  private readonly progress = el<HTMLProgressElement>('progress');

  bind(actions: ViewActions): void {
    const input = el<HTMLInputElement>('file'), dropzone = el<HTMLLabelElement>('dropzone');
    input.addEventListener('change', () => { if (input.files?.[0]) actions.file(input.files[0]); input.value = ''; });
    dropzone.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    for (const name of ['dragenter', 'dragover']) dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
    dropzone.addEventListener('drop', event => {
      event.preventDefault(); dropzone.classList.remove('over');
      const file = event.dataTransfer?.files[0]; if (file) actions.file(file);
    });
    for (const action of ['sample', 'cancel', 'download', 'resources', 'copy'] as const) el(action).addEventListener('click', () => actions[action]());
    for (const tab of ['preview', 'source'] as const) {
      el(`tab-${tab}`).addEventListener('click', () => this.setTab(tab));
      el(`tab-${tab}`).addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault(); this.setTab(tab === 'preview' ? 'source' : 'preview'); el(`tab-${this.selected}`).focus();
        }
      });
    }
  }

  private setTab(tab: Tab): void {
    this.selected = tab;
    for (const candidate of ['preview', 'source']) {
      el(`tab-${candidate}`).setAttribute('aria-selected', String(candidate === tab));
      el(`tab-${candidate}`).tabIndex = candidate === tab ? 0 : -1;
      el(`${candidate}-view`).hidden = !this.hasResult || candidate !== tab;
    }
    if (tab === 'preview' && this.pendingPreview !== undefined) {
      // Mount only when visible. A fresh frame avoids overlapping blank/srcdoc
      // navigations leaving a previously hidden sandbox document with no layout.
      const frame = this.preview.cloneNode(false) as HTMLIFrameElement;
      frame.srcdoc = this.pendingPreview;
      this.preview.replaceWith(frame);
      this.preview = frame;
      this.pendingPreview = undefined;
    }
  }

  reset(): void {
    this.hasResult = false; this.pendingPreview = undefined; this.preview.srcdoc = ''; this.source.value = '';
    el('cancel').hidden = true; el('empty').hidden = false; el('error').hidden = true;
    el('warnings').replaceChildren(); el('warning-count').textContent = '0';
    el<HTMLDetailsElement>('diagnostics').open = false;
    for (const id of ['download', 'copy', 'resources']) el<HTMLButtonElement>(id).disabled = true;
    for (const strong of el('stats').querySelectorAll('strong')) strong.textContent = '—';
    this.setTab(this.selected);
    el('output-info').textContent = '转换结果可直接嵌入项目或保存为 HTML 文件';
  }

  loading(status: string, cancellable = false): void {
    el('status').textContent = status; this.progress.removeAttribute('value'); el('cancel').hidden = !cancellable;
  }
  filename(name: string): void { el('filename').textContent = name; }
  sampleBusy(busy: boolean): void { el<HTMLButtonElement>('sample').disabled = busy; }
  cancelled(): void { el('cancel').hidden = true; el('status').textContent = '已取消'; this.progress.value = 0; }
  fail(error: unknown): void {
    el('cancel').hidden = true; el('status').textContent = '转换未完成'; this.progress.value = 0;
    el('error').textContent = error instanceof Error ? error.message : String(error); el('error').hidden = false;
  }
  updateProgress(event: ProgressEvent): void {
    const names = { reading: '读取文档', extracting: '解压文档', parsing: '解析正文', rendering: '生成 HTML', complete: '整理结果' };
    el('status').textContent = `${names[event.stage]}${event.total ? ` · ${event.completed}/${event.total}` : '…'}`;
    if (event.stage === 'parsing' && event.total) { this.progress.max = event.total; this.progress.value = event.completed ?? 0; }
    else this.progress.removeAttribute('value');
  }
  show(result: PlaygroundConversionResult): void {
    this.hasResult = true; this.pendingPreview = result.html; this.source.value = result.html;
    el('empty').hidden = true; el('cancel').hidden = true; this.setTab(this.selected);
    el('status').textContent = '转换完成'; this.progress.max = 1; this.progress.value = 1;
    const counts = [result.stats.paragraphs, result.stats.tables, result.stats.images, result.stats.formulas];
    el('stats').querySelectorAll('strong').forEach((node, i) => { node.textContent = String(counts[i]); });
    el('warning-count').textContent = String(result.warnings.length);
    const messages = result.warnings.length ? result.warnings.map(warning => warning.message) : ['未发现兼容性问题。建议导出前核对预览。'];
    for (const message of messages) { const li = document.createElement('li'); li.textContent = message; el('warnings').append(li); }
    el<HTMLDetailsElement>('diagnostics').open = result.warnings.length > 0;
    el<HTMLButtonElement>('download').disabled = false; el<HTMLButtonElement>('copy').disabled = false;
    el<HTMLButtonElement>('resources').disabled = !result.resources.length && !result.convertedImages.length;
    el('output-info').textContent = `HTML ${(new Blob([result.html]).size / 1024).toFixed(1)} KB · ${result.resources.length} 个原始资源 · ${result.convertedImages.length} 张公式预览 PNG`;
  }
  copied(): void {
    el('copy').textContent = '已复制'; setTimeout(() => { el('copy').textContent = '复制 HTML'; }, 1500);
  }
  selectSource(): void {
    this.setTab('source'); this.source.focus(); this.source.select();
    el('output-info').textContent = 'HTML 已选中，请按 Ctrl+C / Cmd+C 复制';
  }
}
