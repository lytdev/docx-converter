import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ImageContext, ImageResult } from '../../contracts/conversion.js';

const execFile = promisify(execFileCallback);

/** Optional Node adapter: callers explicitly select the ImageMagick executable. */
export function createImageMagickPreviewConverter(executable = 'magick') {
  return async (image: ImageContext): Promise<ImageResult | undefined> => {
    if (!image.formula || !/\.(wmf|emf)$/i.test(image.path) || image.bytes.length > 8 * 1024 * 1024) return;
    const extension = image.path.toLowerCase().endsWith('.emf') ? 'emf' : 'wmf';
    const directory = await mkdtemp(join(tmpdir(), 'docx-converter-preview-'));
    const input = join(directory, `preview.${extension}`), output = join(directory, 'preview.png');
    try {
      await writeFile(input, image.bytes);
      await execFile(executable, ['-background', 'none', input, '-resize', '1600x1600>', `PNG32:${output}`], {
        timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true,
      });
      const bytes = await readFile(output);
      if (bytes.length > 16 * 1024 * 1024) return;
      return { bytes: new Uint8Array(bytes), mimeType: 'image/png' };
    } catch {
      // A failed preview leaves the original resource and the standard warning.
      return;
    } finally {
      await unlink(input).catch(() => {});
      await unlink(output).catch(() => {});
      await rmdir(directory);
    }
  };
}
