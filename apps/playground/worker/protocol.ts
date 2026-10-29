import type { ConversionResult, JsonConversionResult, ProgressEvent, Resource } from '../../../src/index';

export interface PlaygroundConversionResult extends ConversionResult {
  json: JsonConversionResult;
  convertedImages: Resource[];
}

export interface ConversionRequest { bytes: ArrayBuffer; title: string }
export type ConversionResponse =
  | { type: 'progress'; event: ProgressEvent }
  | { type: 'result'; result: PlaygroundConversionResult }
  | { type: 'error'; message: string };
