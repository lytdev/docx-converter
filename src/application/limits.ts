import { DocxError } from '../contracts/errors.js';
import type { ConversionLimits } from '../contracts/conversion.js';

export const DEFAULT_LIMITS: Readonly<ConversionLimits> = Object.freeze({
  inputBytes: 50 * 1024 * 1024,
  totalBytes: 150 * 1024 * 1024,
  entryBytes: 40 * 1024 * 1024,
  entries: 10000,
  xmlDepth: 128,
});

export function resolveLimits(overrides: Partial<ConversionLimits> = {}): ConversionLimits {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new DocxError('INVALID_LIMIT', `限制 ${key} 必须为正整数`);
    }
  }
  return limits;
}
