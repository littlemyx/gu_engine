import { recomputeAll } from './fingerprint';
import { topoOrder } from './stageGraph';

import type { ArtifactIndex, ArtifactKey, ArtifactStage } from './types';
import { artifactKey } from './types';
import { emptyMeta } from './transitions';

/**
 * Заведение учёта для истории, которая была собрана до модели артефактов.
 *
 * Правило одно: оплаченное не протухает от миграции. У автора на руках готовая
 * история, за которую заплачено десятками вызовов; если завести её артефакты
 * пустыми, интерфейс на следующем же экране объявит всё несуществующим и
 * предложит пересобрать за деньги. Поэтому всё, что реально лежит в сторах,
 * заводится как `approved` со свежим отпечатком — принято автором по факту.
 */

/** Что из стадии реально лежит в сторах. Пустой список — стадии нет. */
export type PresentItems = Partial<Record<ArtifactStage, string[]>>;

/**
 * Собрать индекс для существующей истории.
 *
 * `owns` — собственная суть стадий, у которых она есть (бриф). Отпечатки
 * считаются по текущему состоянию мира, поэтому сразу после миграции всё
 * свежее, а протухнет только от настоящей правки.
 */
export function migrateExisting(present: PresentItems, owns: Record<string, unknown> = {}): ArtifactIndex {
  const index: ArtifactIndex = {};

  for (const [stage, items] of Object.entries(present) as [ArtifactStage, string[]][]) {
    for (const item of items) {
      const key = artifactKey(stage, item);
      index[key] = { ...emptyMeta(key), ownership: 'approved' };
    }
  }

  const current = recomputeAll(index, topoOrder(), owns);
  for (const key of Object.keys(index)) {
    index[key] = {
      ...index[key],
      fingerprint: current[key],
      takes: [{ n: 1, ts: Date.now(), origin: 'restored' }],
      selectedTake: 1,
    };
  }

  return index;
}

/**
 * Дозавести артефакты, появившиеся в сторах мимо учёта (импорт чужого
 * `.guproj`, старый прогон, доехавший до коммита). Уже учтённые не трогает —
 * иначе миграция затирала бы владение и историю дублей.
 */
export function reconcile(
  index: ArtifactIndex,
  present: PresentItems,
  owns: Record<string, unknown> = {},
): ArtifactIndex {
  const missing: PresentItems = {};

  for (const [stage, items] of Object.entries(present) as [ArtifactStage, string[]][]) {
    const unknown = items.filter(item => !(artifactKey(stage, item) in index));
    if (unknown.length) missing[stage] = unknown;
  }

  if (Object.keys(missing).length === 0) return index;
  return { ...index, ...migrateExisting(missing, owns) };
}

/**
 * Одноразовое освежение отпечатков при смене словаря owns (см. OWNS_REV).
 *
 * Отпечатки в сторе записаны старой формулой; после её смены сравнение со
 * свежепосчитанными врало бы «всё протухло», хотя не менялось ничего. Правило
 * то же, что у миграции: оплаченное не протухает от апдейта кода. Освежается
 * только то, что было свежим ПО СТАРОЙ формуле; протухшее по ней остаётся
 * протухшим — реальную устарелость миграция не амнистирует. Владение и дубли
 * не трогаются: это перезапись бухгалтерской записи, а не работа.
 */
export function refreshFingerprints(
  index: ArtifactIndex,
  oldOwns: Record<string, unknown>,
  newOwns: Record<string, unknown>,
): ArtifactIndex {
  const order = topoOrder();
  const wasCurrent = recomputeAll(index, order, oldOwns);
  const nowCurrent = recomputeAll(index, order, newOwns);

  let changed = false;
  const next: ArtifactIndex = { ...index };

  for (const [key, meta] of Object.entries(index)) {
    if (meta.fingerprint === null || meta.fingerprint !== wasCurrent[key]) continue;
    if (wasCurrent[key] === nowCurrent[key]) continue;
    next[key] = { ...meta, fingerprint: nowCurrent[key] };
    changed = true;
  }

  return changed ? next : index;
}

/** Артефакты, которых в сторах больше нет: их учёт — сироты. */
export function orphans(index: ArtifactIndex, present: PresentItems): ArtifactKey[] {
  const alive = new Set<string>();
  for (const [stage, items] of Object.entries(present) as [ArtifactStage, string[]][]) {
    for (const item of items) alive.add(artifactKey(stage, item));
  }
  return Object.keys(index).filter(key => !alive.has(key)) as ArtifactKey[];
}
