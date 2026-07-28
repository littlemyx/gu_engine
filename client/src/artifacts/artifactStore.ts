import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storageKey } from '@/project/projectScope';

import {
  emptyMeta,
  onApprove,
  onGenerated,
  onLock,
  onNote,
  onNotesConsumed,
  onSelectTake,
  onUnlock,
  onUserEdit,
} from './transitions';

import type { GeneratedInfo } from './transitions';
import type { ArtifactIndex, ArtifactKey, ArtifactMeta } from './types';

/**
 * Стор артефактов — учётный слой поверх существующих сторов, а не замена им.
 *
 * Проза, каст, календарь по-прежнему живут в narrativeStore и briefStore:
 * переносить их сюда значило бы переписать половину проекта ради учёта.
 * Здесь хранится только то, чего в тех сторах нет и неоткуда взять — чей
 * артефакт, из чего он собран и какие у него были дубли.
 *
 * Ключ скоуплен projectId: две вкладки с разными историями не делят учёт.
 */

export type ArtifactState = {
  index: ArtifactIndex;

  /** Прогон сгенерировал артефакт. Запертое остаётся нетронутым. */
  generated: (key: ArtifactKey, info: GeneratedInfo) => void;
  /** Автор принял машинный вариант. */
  approve: (key: ArtifactKey) => void;
  /** Автор правил руками: артефакт становится авторским поверх текущих входов. */
  userEdit: (key: ArtifactKey, fingerprint: string) => void;
  lock: (key: ArtifactKey) => void;
  unlock: (key: ArtifactKey) => void;
  selectTake: (key: ArtifactKey, n: number) => void;
  /** Заметка режиссёру: уедет в previousIssues следующей генерации. */
  note: (key: ArtifactKey, note: string) => void;
  /** Заметки учтены прогоном. */
  consumeNotes: (keys: ArtifactKey[]) => void;
  /** Заменить весь индекс — открытие проекта, миграция, откат. */
  replaceIndex: (index: ArtifactIndex) => void;
  reset: () => void;
};

/** Точечное изменение одной меты. Отсутствующая заводится пустой. */
function edit(index: ArtifactIndex, key: ArtifactKey, fn: (meta: ArtifactMeta) => ArtifactMeta): ArtifactIndex {
  const before = index[key] ?? emptyMeta(key);
  const after = fn(before);
  return after === before ? index : { ...index, [key]: after };
}

export const useArtifactStore = create<ArtifactState>()(
  persist(
    set => ({
      index: {},

      generated: (key, info) => set(s => ({ index: edit(s.index, key, m => onGenerated(m, info)) })),
      approve: key => set(s => ({ index: edit(s.index, key, onApprove) })),
      userEdit: (key, fingerprint) => set(s => ({ index: edit(s.index, key, m => onUserEdit(m, fingerprint)) })),
      lock: key => set(s => ({ index: edit(s.index, key, onLock) })),
      unlock: key => set(s => ({ index: edit(s.index, key, onUnlock) })),
      selectTake: (key, n) => set(s => ({ index: edit(s.index, key, m => onSelectTake(m, n)) })),
      note: (key, text) => set(s => ({ index: edit(s.index, key, m => onNote(m, text)) })),

      consumeNotes: keys =>
        set(s => {
          let index = s.index;
          for (const key of keys) index = edit(index, key, onNotesConsumed);
          return { index };
        }),

      replaceIndex: index => set({ index }),
      reset: () => set({ index: {} }),
    }),
    {
      name: storageKey('gu-artifacts'),
      version: 1,
      partialize: s => ({ index: s.index }),
    },
  ),
);
