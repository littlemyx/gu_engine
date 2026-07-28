import type { PresentItems } from './migrate';

/**
 * Мост между сторами истории и учётом артефактов.
 *
 * Артефакт — это мета: чей он и из чего собран. Сами данные лежат там же, где
 * лежали (narrativeStore, briefStore), и переносить их незачем. Значит, кто-то
 * должен отвечать на вопрос «что вообще существует» — вот эта функция.
 */

export interface StoryStores {
  brief: unknown;
  castPlan: unknown;
  worldModel: unknown;
  calendar: unknown;
  spine: unknown;
  schedule: unknown;
  eventUnits: Record<string, unknown>;
  unitProse: Record<string, unknown>;
  spineBeatProse: Record<string, unknown>;
  endings: Record<string, unknown>;
  anchorNarrations: unknown;
  images: Record<string, unknown>;
  audioTracks: string[];
}

/** Скалярная стадия присутствует, если поле не пусто. */
const scalar = (value: unknown): string[] => (value ? [''] : []);

export function collectPresence(stores: StoryStores): PresentItems {
  const present: PresentItems = {
    brief: scalar(stores.brief),
    cast: scalar(stores.castPlan),
    world: scalar(stores.worldModel),
    calendar: scalar(stores.calendar),
    spine: scalar(stores.spine),
    schedule: scalar(stores.schedule),
    anchor_transitions: scalar(stores.anchorNarrations),
    event_pool: Object.keys(stores.eventUnits),
    dialogue_units: Object.keys(stores.unitProse),
    beat_prose: Object.keys(stores.spineBeatProse),
    ending_prose: Object.keys(stores.endings),
    image: Object.keys(stores.images),
    audio: stores.audioTracks,
  };

  // Пустые стадии выбрасываем: ведомость сама нарисует им строку «не создано»,
  // а пустой массив в учёте означал бы «стадия есть, элементов ноль».
  for (const [stage, items] of Object.entries(present)) {
    if (!items || items.length === 0) delete present[stage as keyof PresentItems];
  }

  return present;
}

/**
 * Собственная суть брифа для отпечатка. Берётся весь бриф: любое его поле —
 * вход генерации, и решать за автора, какая правка «неважная», нельзя.
 */
export function briefOwn(brief: unknown): Record<string, unknown> {
  return { 'brief/': brief ?? null };
}
