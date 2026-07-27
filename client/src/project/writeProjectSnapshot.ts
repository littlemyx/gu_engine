import { NARRATIVE_STORE_VERSION } from '@/narrative/narrativeMigrations';
import { EMPTY_NARRATIVE_DATA } from '@/narrative/narrativeStore';
import { BRIEF_STORE_VERSION, STUDIO_STORE_VERSION } from '@/pages/studio/projectFile/projectFileFormat';

import type { Brief } from '@/narrative/types';
import type { StudioProjectData } from '@/pages/studio/studioProjectStore';
import type { ProjectNarrativeSlice } from '@/pages/studio/projectFile/projectFileFormat';
import type { SelectorConfig } from 'gu-engine-story-core';

/**
 * Запись состояния проекта в ЧУЖОЙ неймспейс — в ключи проекта, к которому эта
 * вкладка не привязана. Нужно ровно в одном сценарии: открывается .guproj с
 * другим projectId, и его данные должны лечь туда, где их найдёт новая вкладка
 * после навигации.
 *
 * Почему не «применить в живые сторы, а потом переключить persist»: persist
 * вкладки уже привязан к её собственному проекту, и подмена ключей на лету
 * оставила бы половину записей не там. Проще записать снимок и перезагрузиться —
 * штатная регидрация разберётся сама.
 *
 * Здесь захардкожен формат конверта zustand/persist ({state, version}). Это
 * осознанная связка с внутренностями библиотеки; её стережёт round-trip-тест
 * writeProjectSnapshot.test.ts — если формат изменится, тест упадёт раньше
 * пользователя.
 */

export type ProjectSnapshot = {
  narrative: ProjectNarrativeSlice;
  brief: { brief: Brief; selector: SelectorConfig };
  studio: StudioProjectData;
};

function writeEnvelope(base: string, id: string, state: unknown, version: number): void {
  localStorage.setItem(`${base}:${id}`, JSON.stringify({ state, version }));
}

/**
 * Засев брифа в свежий неймспейс — для «Новый проект → Подставить образец».
 * Пишется только бриф: остальные сторы нового проекта стартуют с дефолтов.
 */
export function seedProjectBrief(id: string, brief: Brief, selector: SelectorConfig): void {
  writeEnvelope('gu-narrative-brief', id, { brief, selector }, BRIEF_STORE_VERSION);
}

export function writeProjectSnapshot(id: string, snapshot: ProjectSnapshot): void {
  // EMPTY_NARRATIVE_DATA первым слоем: поля, которых в файле нет, должны быть
  // пустыми, а не отсутствовать — иначе стор дополнит их своими дефолтами
  // только частично. calendarRun — всегда null: чужой незавершённый прогон
  // ссылается на батчи, которых в этом браузере нет.
  writeEnvelope(
    'gu-narrative-state',
    id,
    { ...EMPTY_NARRATIVE_DATA, ...snapshot.narrative, calendarRun: null },
    NARRATIVE_STORE_VERSION,
  );
  writeEnvelope('gu-narrative-brief', id, snapshot.brief, BRIEF_STORE_VERSION);
  writeEnvelope('gu-studio-project', id, snapshot.studio, STUDIO_STORE_VERSION);
  // Консоль прогона и счётчик расходов не пишем намеренно: они описывают
  // сессию работы, а не проект, и открытый файл начинает с чистой консоли.
}
