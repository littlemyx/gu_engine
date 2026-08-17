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
 * Ревизия словаря owns. Поднимается, когда в отпечатки входит новая
 * собственная суть: записанные отпечатки становятся несравнимы с текущими, и
 * их надо один раз освежить (см. refreshFingerprints), иначе вся история
 * массово «протухнет» от одного апдейта кода.
 */
// 2 — worldModel вошёл в owns; 3 — лечение изолированных отпечатков reconcile.
export const OWNS_REV = 3;

/**
 * Собственная суть стадий для отпечатков.
 *
 * Бриф — весь: любое его поле — вход генерации, и решать за автора, какая
 * правка «неважная», нельзя. Модель мира — тоже own: она приходит не только
 * из генерации (world-префаб подставляет её целиком), и без неё в отпечатке
 * подмена мира не протухала бы календарь и хребет.
 *
 * `null` и отсутствие ключа дают один отпечаток (stableString → 'ø'), поэтому
 * пустые значения кладутся спокойно.
 */
export function storyOwns(brief: unknown, worldModel: unknown): Record<string, unknown> {
  return { 'brief/': brief ?? null, 'world/': worldModel ?? null };
}

/** owns ревизии 1 — только бриф. Заморожено для одноразового освежения отпечатков. */
export function ownsRev1(brief: unknown): Record<string, unknown> {
  return { 'brief/': brief ?? null };
}
