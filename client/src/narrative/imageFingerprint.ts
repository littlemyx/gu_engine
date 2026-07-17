import type { WorldLocation, WorldModel } from './types';
import type { ImageGenState } from './narrativeStore';

/**
 * Связь фона с локацией, для которой он нарисован.
 *
 * Фоны кэшируются по ключу loc:<locationId>, а мир пересочиняется стадией
 * world_calendar на каждой перегенерации истории. Раньше это давало две тихие
 * поломки: локация с тем же id, но другим описанием, молча оставалась со старой
 * картинкой (арт не соответствует тексту), а фоны исчезнувших локаций копились
 * в сторе сиротами.
 *
 * Отпечаток считается по самой локации (имя/описание/детали), а не по полному
 * промпту: часть промпта из брифа (сеттинг, арт-стиль) меняется по воле автора
 * и не должна помечать протухшими все фоны разом — для этого есть кнопка
 * «Перегенерировать всё».
 */

/** Ключ фона локации в store.images (легаси-ключи — голые anchorId). */
export const locationImageKey = (locationId: string): string => `loc:${locationId}`;

/** FNV-1a: стабильный между сессиями (в отличие от хэшей объектов в рантайме). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Отпечаток локации: меняется ровно тогда, когда меняется её изображаемая суть. */
export function locationFingerprint(loc: Pick<WorldLocation, 'name' | 'description' | 'pointsOfInterest'>): string {
  return fnv1a([loc.name, loc.description, ...(loc.pointsOfInterest ?? [])].join('|'));
}

/** Фон протух: нарисован для другой версии локации (или отпечатка нет — легаси). */
export function imageIsStale(state: ImageGenState | undefined, fingerprint: string): boolean {
  if (!state || state.status !== 'done') return false;
  return state.locationHash !== fingerprint;
}

/**
 * Сверка кэша фонов с новым миром (зовётся коммитом календарного прогона):
 * фоны исчезнувших локаций выбрасываются, фоны переписанных локаций
 * возвращаются в очередь как pending — счётчик «Фоны n/N» честно покажет,
 * что именно надо перерисовать.
 */
export function reconcileImagesForWorld(
  images: Record<string, ImageGenState>,
  world: WorldModel | null,
): Record<string, ImageGenState> {
  if (!world) return images;
  const fingerprintByKey = new Map(world.locations.map(loc => [locationImageKey(loc.id), locationFingerprint(loc)]));

  const next: Record<string, ImageGenState> = {};
  for (const [key, state] of Object.entries(images)) {
    // Легаси-ключи (голые anchorId) миру не принадлежат — не трогаем.
    if (!key.startsWith('loc:')) {
      next[key] = state;
      continue;
    }
    const fingerprint = fingerprintByKey.get(key);
    if (fingerprint == null) continue; // локации больше нет — сирота
    next[key] = imageIsStale(state, fingerprint) ? { status: 'pending' } : state;
  }
  return next;
}
