import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { join } from 'node:path';
import { EMBEDDING_DIMENSIONS } from './db.ts';

export type Embed = (texts: string[]) => Promise<number[][]>;

const MODEL = 'Xenova/bge-small-en-v1.5';

let extractor: Promise<FeatureExtractionPipeline> | null = null;

/** Embeddings computed in-process, bge-small over ONNX; the model is cached in MOMENTUM_MODELS, or under C:\Projects\.momentum\models */
export function createEmbedder(cacheDir = process.env.MOMENTUM_MODELS ?? join(process.env.MOMENTUM_ROOT ?? 'C:\\Projects', '.momentum', 'models')): Embed {
  env.cacheDir = cacheDir;
  return async (texts) => {
    if (texts.length === 0) return [];
    // A load that failed (a download cut short) is tried again by the next call, not kept
    extractor ??= pipeline('feature-extraction', MODEL, { dtype: 'fp32' }).catch((e: Error) => {
      extractor = null;
      throw e;
    });
    const output = await (await extractor)(texts, { pooling: 'cls', normalize: true });
    const rows = output.tolist() as number[][];
    for (const row of rows) {
      if (row.length !== EMBEDDING_DIMENSIONS) throw new Error(`embedding has ${row.length} dimensions`);
    }
    return rows;
  };
}

export function toVector(v: number[]): string {
  return `[${v.join(',')}]`;
}
