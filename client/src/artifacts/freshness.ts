import { recomputeAll } from './fingerprint';

import type { ArtifactIndex, ArtifactMeta, ArtifactStage, Freshness } from './types';

/**
 * Свежесть не хранится, а считается. Хранимая свежесть — это кэш, который
 * кто-нибудь обязательно забудет сбросить: именно так и появлялись истории,
 * где сцена сгенерирована по позапрошлому брифу, а интерфейс уверял, что всё
 * в порядке. Считать дешевле, чем ловить такие расхождения.
 */
export function deriveFreshness(meta: ArtifactMeta | undefined, currentFingerprint: string): Freshness {
  if (!meta || meta.fingerprint === null) return 'missing';
  return meta.fingerprint === currentFingerprint ? 'fresh' : 'stale';
}

/**
 * Свежесть всех артефактов индекса за один проход: отпечатки пересчитываются
 * сверху вниз, каждый сравнивается с записанным при рождении.
 *
 * `owns` даёт собственную суть там, где она есть (сам бриф, описание локации
 * под картинку) — для остальных стадий всё определяется входами.
 */
export function deriveAllFreshness(
  index: ArtifactIndex,
  order: ArtifactStage[],
  owns: Record<string, unknown> = {},
): Record<string, Freshness> {
  const current = recomputeAll(index, order, owns);

  const result: Record<string, Freshness> = {};
  for (const key of Object.keys(index)) {
    result[key] = deriveFreshness(index[key], current[key]);
  }
  return result;
}

export interface ZoneReadiness {
  missing: number;
  stale: number;
  fresh: number;
  total: number;
}

/** Сводка по набору артефактов — то, что показывает панель «Готовность зоны». */
export function summarize(freshness: Record<string, Freshness>, keys: string[]): ZoneReadiness {
  const summary: ZoneReadiness = { missing: 0, stale: 0, fresh: 0, total: keys.length };
  for (const key of keys) {
    const value = freshness[key] ?? 'missing';
    summary[value] += 1;
  }
  return summary;
}
