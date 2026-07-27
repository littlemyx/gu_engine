import { beforeEach, describe, expect, it } from 'vitest';

import { usePrefabStore } from './prefabStore';

import type { Prefab, WorldPayload } from './prefabTypes';

const world = (name: string, locations = 2): Prefab => ({
  id: `pf_${name}`,
  kind: 'world',
  name,
  version: 1,
  forkOf: null,
  origin: 'Лето',
  createdAt: 0,
  usedIn: 0,
  payload: {
    worldModel: {
      locations: Array.from({ length: locations }, (_, i) => ({ id: `loc${i}` })),
      anchorLocations: {},
    },
    images: {},
  } as unknown as WorldPayload,
});

describe('prefabStore', () => {
  beforeEach(() => usePrefabStore.getState().clear());

  it('сохраняет префаб первой версией', () => {
    usePrefabStore.getState().savePrefab(world('Взморье'));

    const [prefab] = usePrefabStore.getState().prefabs;
    expect(prefab).toMatchObject({ name: 'Взморье', version: 1, usedIn: 0 });
  });

  it('перезапись одноимённого поднимает версию и сохраняет счётчик применений', () => {
    usePrefabStore.getState().savePrefab(world('Взморье'));
    const { id } = usePrefabStore.getState().prefabs[0];
    usePrefabStore.getState().markApplied(id);

    usePrefabStore.getState().savePrefab(world('Взморье', 5));

    const { prefabs } = usePrefabStore.getState();
    expect(prefabs).toHaveLength(1);
    expect(prefabs[0]).toMatchObject({ id, version: 2, usedIn: 1 });
    expect(prefabs[0].kind === 'world' && prefabs[0].payload.worldModel.locations).toHaveLength(5);
  });

  it('одноимённые префабы разных типов не сливаются', () => {
    usePrefabStore.getState().savePrefab(world('Общий'));
    usePrefabStore.getState().savePrefab({ ...world('Общий'), id: 'pf_char', kind: 'character' } as unknown as Prefab);

    expect(usePrefabStore.getState().prefabs).toHaveLength(2);
  });

  it('форк — отдельная запись с ссылкой на источник и нулевым счётчиком', () => {
    usePrefabStore.getState().savePrefab(world('Взморье'));
    const source = usePrefabStore.getState().prefabs[0];
    usePrefabStore.getState().markApplied(source.id);

    usePrefabStore.getState().forkPrefab(source.id, 'Взморье зимой');

    const fork = usePrefabStore.getState().prefabs[1];
    expect(fork).toMatchObject({ name: 'Взморье зимой', forkOf: source.id, version: 1, usedIn: 0 });
    expect(fork.id).not.toBe(source.id);
  });

  it('удаление убирает только свой префаб', () => {
    usePrefabStore.getState().savePrefab(world('A'));
    usePrefabStore.getState().savePrefab(world('B'));
    const [a] = usePrefabStore.getState().prefabs;

    usePrefabStore.getState().removePrefab(a.id);

    expect(usePrefabStore.getState().prefabs.map(p => p.name)).toEqual(['B']);
  });
});
