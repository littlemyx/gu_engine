import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storageKey } from '@/project/projectScope';

import { STUDIO_STORE_VERSION } from './projectFile/projectFileFormat';

import type { DialogueVariantBracket } from '@/narrative/types';
import type { PrefabProvenanceRef } from './projectFile/projectFileFormat';

/**
 * Состояние шелла, принадлежащее ПРОЕКТУ, а не пользователю. Отделено от
 * studioStore намеренно: ширины панелей и открытые доки — привычка автора и
 * должны следовать за ним из проекта в проект, а выбранная ветка хребта и
 * происхождение префабов описывают конкретную историю, едут в .guproj и
 * обязаны меняться вместе с ней.
 *
 * Ключ скоуплен projectId — две вкладки с разными историями не делят выбор
 * веток.
 */

/** Персистная часть: ровно она едет в .guproj и в снимок проекта. */
export type StudioProjectData = {
  /** branchPointId → outcomeId. Настройка показа, не параметр генерации. */
  branchAssignment: Record<string, string>;
  /**
   * Следы применённых к проекту префабов. Сам префаб копируется в сторы, так
   * что проект самодостаточен; здесь остаётся происхождение — оно едет в файл
   * проекта и отвечает на вопрос «откуда в истории этот персонаж».
   */
  prefabProvenance: PrefabProvenanceRef[];
  /** В какой ступени отношений читается «Сценарий». */
  scriptBracket: DialogueVariantBracket;
};

type StudioProjectState = StudioProjectData & {
  setBranch: (branchPointId: string, outcomeId: string | null) => void;
  resetBranches: () => void;
  recordPrefabApplied: (ref: PrefabProvenanceRef) => void;
  setScriptBracket: (bracket: DialogueVariantBracket) => void;
};

/** Пустой проект: чем «Новый проект» отличается от открытой истории. */
export const EMPTY_STUDIO_PROJECT: StudioProjectData = {
  branchAssignment: {},
  prefabProvenance: [],
  scriptBracket: 'neutral',
};

export const useStudioProjectStore = create<StudioProjectState>()(
  persist(
    set => ({
      ...EMPTY_STUDIO_PROJECT,

      setBranch: (branchPointId, outcomeId) =>
        set(s => {
          const next = { ...s.branchAssignment };
          if (outcomeId == null) delete next[branchPointId];
          else next[branchPointId] = outcomeId;
          return { branchAssignment: next };
        }),
      resetBranches: () => set({ branchAssignment: {} }),
      // Повторное применение того же префаба перезаписывает запись: важно,
      // из какой версии пришёл нынешний персонаж, а не сколько было попыток.
      recordPrefabApplied: ref =>
        set(s => ({
          prefabProvenance: [...s.prefabProvenance.filter(p => p.id !== ref.id), ref],
        })),
      setScriptBracket: scriptBracket => set({ scriptBracket }),
    }),
    {
      name: storageKey('gu-studio-project'),
      version: STUDIO_STORE_VERSION,
      partialize: s => ({
        branchAssignment: s.branchAssignment,
        prefabProvenance: s.prefabProvenance,
        scriptBracket: s.scriptBracket,
      }),
    },
  ),
);
