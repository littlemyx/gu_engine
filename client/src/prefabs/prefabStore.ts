import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Prefab } from './prefabTypes';

/**
 * Библиотека префабов. Живёт отдельным ключом localStorage: она переживает
 * не только перезагрузку, но и полную смену истории — в этом весь смысл.
 */

type PrefabState = {
  prefabs: Prefab[];

  /** Сохранить новый префаб или перезаписать одноимённый (версия +1). */
  savePrefab: (prefab: Prefab) => void;
  removePrefab: (id: string) => void;
  /** Отпочковать копию: новая запись с forkOf на источник. */
  forkPrefab: (id: string, name: string) => void;
  /** Отметить применение — счётчик «в N историях». */
  markApplied: (id: string) => void;
  clear: () => void;
};

export const usePrefabStore = create<PrefabState>()(
  persist(
    set => ({
      prefabs: [],

      savePrefab: prefab =>
        set(s => {
          // Перезапись по имени и типу: автор сохраняет «Киру» поверх «Киры»,
          // а не заводит вторую. История версий не хранится — нужен форк.
          const previous = s.prefabs.find(p => p.kind === prefab.kind && p.name === prefab.name);
          if (!previous) return { prefabs: [...s.prefabs, { ...prefab, version: 1, usedIn: 0 }] };
          // Перезапись сохраняет id и счётчик применений: это тот же префаб
          // новой версии, а не второй такой же.
          const next: Prefab = {
            ...prefab,
            id: previous.id,
            version: previous.version + 1,
            usedIn: previous.usedIn,
          };
          return { prefabs: s.prefabs.map(p => (p.id === previous.id ? next : p)) };
        }),

      removePrefab: id => set(s => ({ prefabs: s.prefabs.filter(p => p.id !== id) })),

      forkPrefab: (id, name) =>
        set(s => {
          const source = s.prefabs.find(p => p.id === id);
          if (!source) return s;
          const fork = {
            ...source,
            id: `${source.id}_fork${s.prefabs.length + 1}`,
            name,
            version: 1,
            forkOf: source.id,
            usedIn: 0,
          } as Prefab;
          return { prefabs: [...s.prefabs, fork] };
        }),

      markApplied: id =>
        set(s => ({
          prefabs: s.prefabs.map(p => (p.id === id ? ({ ...p, usedIn: p.usedIn + 1 } as Prefab) : p)),
        })),

      clear: () => set({ prefabs: [] }),
    }),
    { name: 'gu-prefab-library' },
  ),
);
