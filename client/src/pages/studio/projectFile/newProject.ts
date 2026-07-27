import { SAMPLE_BRIEF } from '@/narrative';
import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { clearRunLog } from '@/narrative/runLog';
import { upsertProject } from '@/project/projectRegistry';
import { newProjectId, studioUrl } from '@/project/projectScope';
import { seedProjectBrief } from '@/project/writeProjectSnapshot';
import { DEFAULT_SELECTOR_CONFIG } from 'gu-engine-story-core';

import { EMPTY_STUDIO_PROJECT, useStudioProjectStore } from '../studioProjectStore';
import { useStudioStore } from '../studioStore';

import { clearCurrentHandle } from './fileHandle';

/**
 * Новый проект: пустой бриф, пустая история, чистая консоль прогона.
 * Библиотека префабов и настройки не трогаются — префабы по замыслу
 * переживают смену истории, ради того и вынесены в отдельный стор.
 *
 * Осталось для тестов и для сброса в пределах одного проекта. Пункт меню
 * «Новый проект» ходит через startNewProject: с многопроектностью новый
 * проект — это новый неймспейс, а не стёртый старый.
 */
export function resetProjectStores(): void {
  const brief = useBriefStore.getState();
  brief.resetToBlank();
  brief.resetSelector();
  useNarrativeStore.getState().resetAll();
  useStudioProjectStore.setState(EMPTY_STUDIO_PROJECT);
  useStudioStore.setState({ selection: null });
  clearRunLog();
  clearCurrentHandle();
}

export type NewProjectOptions = {
  /** Имя в реестре проектов; пустое → «без названия». */
  name?: string;
  /** Подставить образцовый бриф (sample-brief.json) вместо пустого. */
  sample?: boolean;
};

/**
 * Завести новый проект и уйти в него. Текущий остаётся в реестре нетронутым:
 * автор больше ничего не теряет, нажав «Новый проект» — это открытие чистого
 * листа рядом, а не стирание работы. Образец сеется в неймспейс нового проекта
 * ДО навигации: сторы вкладки привязаны к старому и писать через них нельзя.
 */
export function startNewProject(options: NewProjectOptions = {}): string {
  const id = newProjectId();
  upsertProject(id, options.name?.trim() || undefined);
  if (options.sample) seedProjectBrief(id, SAMPLE_BRIEF, DEFAULT_SELECTOR_CONFIG);
  window.location.assign(studioUrl(id));
  return id;
}
