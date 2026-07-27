import { useNarrativeStore } from '@/narrative/narrativeStore';

import { upsertProject } from './projectRegistry';
import { projectId } from './projectScope';

/**
 * Регистрация проекта вкладки в общем реестре. Без неё проект существовал бы
 * только как набор ключей в localStorage: пикер не знал бы ни его имени, ни
 * того, что он вообще есть, и удалить его было бы нечем.
 *
 * Имя проекта — заголовок хребта: он появляется после первого прогона и
 * меняется при перегенерации, поэтому за ним следим подпиской, а не разовым
 * снимком на старте.
 */
export function bootProject(): void {
  const id = projectId;
  if (!id) return;

  let lastTitle = useNarrativeStore.getState().spine?.title;
  upsertProject(id, lastTitle || undefined);

  useNarrativeStore.subscribe(state => {
    const title = state.spine?.title;
    if (title === lastTitle) return;
    lastTitle = title;
    upsertProject(id, title || undefined);
  });
}
