import { PROMPT_VERSIONS, STAGE_INPUTS } from './stageGraph';

import type { ArtifactIndex, ArtifactStage } from './types';
import { parseArtifactKey } from './types';

/**
 * Отпечаток входов артефакта. Обобщение приёма из
 * `narrative/imageFingerprint.ts`: там фон помнил хэш локации, для которой
 * нарисован, и протухал, когда локацию переписали. Здесь то же самое, но для
 * любой стадии.
 *
 * Ключевая тонкость: вход берётся ПЕРЕСЧИТАННЫМ отпечатком предка, а не тем,
 * что лежит у предка в сторе. Иначе правка брифа протухала бы только каст —
 * ведь у каста в сторе записан старый отпечаток брифа, и он совпадал бы сам с
 * собой сколько угодно долго. Пересчёт идёт сверху вниз, и изменение доезжает
 * до концовок само.
 */

/** Отпечатки, посчитанные для текущего состояния мира: ключ артефакта → хэш. */
export type FingerprintMap = Record<string, string>;

/** FNV-1a: стабилен между сессиями, в отличие от хэшей объектов в рантайме. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Устойчивый к порядку ключей снимок значения: `{a:1,b:2}` и `{b:2,a:1}` дают
 * одну строку. Иначе артефакты протухали бы от перестановки полей в сторе.
 */
export function stableString(value: unknown): string {
  if (value === null || value === undefined) return 'ø';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${k}:${stableString(v)}`).join(',')}}`;
}

export interface FingerprintContext {
  /** Пересчитанные отпечатки предков. Заполняется обходом сверху вниз. */
  current: FingerprintMap;
  /**
   * Собственная суть артефакта: то, что не выводится из предков. У брифа это
   * сам бриф, у картинки — описание локации. Для большинства стадий пусто:
   * они целиком определяются входами и версией промпта.
   */
  own?: unknown;
}

/** Отпечаток артефакта: версия промпта + собственная суть + отпечатки входов. */
export function computeFingerprint(stage: ArtifactStage, ctx: FingerprintContext, item = ''): string {
  const inputs = STAGE_INPUTS[stage].map(input => `${input}=${stageFingerprint(input, ctx.current)}`).join('|');

  return fnv1a([`v${PROMPT_VERSIONS[stage]}`, stage, item, stableString(ctx.own), inputs].join('||'));
}

/**
 * Отпечаток стадии целиком. У поэлементных стадий (диалоги, картинки) это
 * свёртка всех её элементов: переписан хоть один — протухает всё, что ниже.
 */
export function stageFingerprint(stage: ArtifactStage, current: FingerprintMap): string {
  const prefix = `${stage}/`;
  const parts = Object.keys(current)
    .filter(key => key.startsWith(prefix))
    .sort()
    .map(key => `${key}=${current[key]}`);

  return parts.length === 0 ? 'ø' : fnv1a(parts.join(','));
}

/** Отпечатки, записанные в артефактах при их рождении. */
export function storedFingerprints(index: ArtifactIndex): FingerprintMap {
  const map: FingerprintMap = {};
  for (const [key, meta] of Object.entries(index)) {
    if (meta.fingerprint !== null) map[key] = meta.fingerprint;
  }
  return map;
}

/**
 * Пересчёт отпечатков всего индекса для текущего состояния мира.
 * Обход строго в топологическом порядке: предки считаются раньше потомков.
 */
export function recomputeAll(
  index: ArtifactIndex,
  order: ArtifactStage[],
  owns: Record<string, unknown> = {},
): FingerprintMap {
  const current: FingerprintMap = {};

  for (const stage of order) {
    for (const key of Object.keys(index)) {
      const parsed = parseArtifactKey(key as never);
      if (parsed.stage !== stage) continue;
      current[key] = computeFingerprint(stage, { current, own: owns[key] }, parsed.item);
    }
  }

  return current;
}
