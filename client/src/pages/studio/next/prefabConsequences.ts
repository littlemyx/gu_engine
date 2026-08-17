import { briefOwn } from '@/artifacts/presence';
import { consequencesOf } from '@/processes/callSheet';

import type { Brief } from '@/narrative/types';
import type { CallSheetInput, CallSheetPosition } from '@/processes/callSheet';
import type { Prefab } from '@/prefabs/prefabTypes';

/**
 * Превью последствий вставки префаба: что протухнет и во что обойдётся
 * пересборка — ДО того, как вставка случилась.
 *
 * Механика — та же `consequencesOf`, что и у любой правки входа: строится
 * смета для мира, в котором префаб уже применён, и сравнивается с текущей.
 * Гипотетический мир собирается без записи в сторы: персонаж меняет бриф
 * (карточка LI встаёт в каст), мир меняет собственную суть стадии `world`.
 */

export interface PrefabConsequences {
  /** Позиции, которые придётся пересобрать ИЗ-ЗА вставки. */
  extra: CallSheetPosition[];
  /** Конфликты: протухнет авторское или запертое — решать в колл-щите. */
  decisions: CallSheetPosition[];
  cost: number;
}

const NONE: PrefabConsequences = { extra: [], decisions: [], cost: 0 };

export function prefabConsequences(prefab: Prefab, brief: Brief, before: CallSheetInput): PrefabConsequences {
  const after = afterInput(prefab, brief, before);
  if (!after) return NONE;

  const { extra, decisions } = consequencesOf(before, after);
  // Стадию, которую префаб закрывает собой, вычёркиваем: платить за её
  // пересборку не надо — вставка и есть её новое содержимое. У персонажа это
  // бриф (карточка LI — правка брифа), у мира — стадия world.
  const provided: string | null = prefab.kind === 'character' ? 'brief' : prefab.kind === 'world' ? 'world' : null;
  const owed = extra.filter(p => p.stage !== provided);

  return { extra: owed, decisions, cost: owed.reduce((sum, p) => sum + p.estCost, 0) };
}

/** Вход сметы для мира, где префаб применён. `null` — вставка ничего не трогает. */
function afterInput(prefab: Prefab, brief: Brief, before: CallSheetInput): CallSheetInput | null {
  if (prefab.kind === 'character') {
    // Та же семантика, что addLoveInterestCard: свой id обновляется, чужой встаёт в конец.
    const exists = brief.loveInterests.some(li => li.id === prefab.payload.li.id);
    const loveInterests = exists
      ? brief.loveInterests.map(li => (li.id === prefab.payload.li.id ? prefab.payload.li : li))
      : [...brief.loveInterests, prefab.payload.li];
    return { ...before, owns: briefOwn({ ...brief, loveInterests }) };
  }

  if (prefab.kind === 'world') {
    // Собственная суть мира в учёте не хранится (owns несёт только бриф),
    // поэтому подмена модели мира выражается добавлением own: отпечаток
    // `world/` меняется, и всё, что стоит на мире, честно протухает.
    return { ...before, owns: { ...before.owns, 'world/': prefab.payload.worldModel } };
  }

  // Аудио-набор текста не трогает: пересобирать нечего.
  return null;
}
