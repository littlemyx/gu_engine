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

/**
 * Как назначена роль кастинг-стола.
 *
 * Слот помнит не только id префаба, но и его версию и снимок содержимого:
 * префабы иммутабельны по версиям, а библиотека — машинная и в .guproj не
 * едет. Без снимка чужой проект открылся бы с пустыми ролями.
 */
export type CastRef = {
  prefabId: string;
  version: number;
  /** linked — следит за библиотекой; forked — отвязан правкой под проект. */
  mode: 'linked' | 'forked';
  /** Имя на момент назначения: показывается, даже когда префаба рядом нет. */
  name: string;
  /** Копия содержимого — проект самодостаточен. */
  snapshot: unknown;
};

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
  /** Кастинг-стол: id роли → чем она закрыта. Пусто — роль не назначена. */
  castSlots: Record<string, CastRef>;
};

type StudioProjectState = StudioProjectData & {
  setBranch: (branchPointId: string, outcomeId: string | null) => void;
  resetBranches: () => void;
  recordPrefabApplied: (ref: PrefabProvenanceRef) => void;
  setScriptBracket: (bracket: DialogueVariantBracket) => void;
  castRole: (roleId: string, ref: CastRef | null) => void;
};

/** Пустой проект: чем «Новый проект» отличается от открытой истории. */
export const EMPTY_STUDIO_PROJECT: StudioProjectData = {
  branchAssignment: {},
  prefabProvenance: [],
  scriptBracket: 'neutral',
  castSlots: {},
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
      castRole: (roleId, ref) =>
        set(s => {
          const next = { ...s.castSlots };
          if (ref == null) delete next[roleId];
          else next[roleId] = ref;
          return { castSlots: next };
        }),
    }),
    {
      name: storageKey('gu-studio-project'),
      version: STUDIO_STORE_VERSION,
      partialize: s => ({
        branchAssignment: s.branchAssignment,
        prefabProvenance: s.prefabProvenance,
        scriptBracket: s.scriptBracket,
        castSlots: s.castSlots,
      }),
    },
  ),
);
