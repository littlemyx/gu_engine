import { newLoveInterest } from '@/narrative/loveInterestCard';

import type { Prefab, PrefabKind } from './prefabTypes';

/**
 * Пустой префаб, заведённый автором вручную.
 *
 * Библиотека до сих пор наполнялась только «вынуть из истории» — то есть
 * закрыть роль было нечем, пока история не сыграна хоть раз. Здесь префаб
 * заводится от одного имени: содержимое (спрайт, фоны, эмбиенты) дописывается
 * потом, а роль закрывается сразу.
 *
 * Версия и счётчик применений выставляются стором при сохранении, поэтому тут
 * они нулевые.
 */
export function blankPrefab(kind: PrefabKind, name: string, origin: string, createdAt: number): Prefab {
  const base = {
    id: `pf_${kind}_${createdAt.toString(36)}`,
    name,
    version: 0,
    forkOf: null,
    origin,
    createdAt,
    usedIn: 0,
  };

  if (kind === 'character') {
    return { ...base, kind, payload: { li: { ...newLoveInterest(), name }, sprite: null, audio: null } };
  }
  if (kind === 'world') {
    return { ...base, kind, payload: { worldModel: { locations: [], anchorLocations: {} }, images: {} } };
  }
  return { ...base, kind, payload: { base: null, moodBeds: {}, specialBeds: {}, sfx: {} } };
}
