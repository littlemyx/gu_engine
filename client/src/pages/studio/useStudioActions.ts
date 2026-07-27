import { useCallback, useMemo } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { buildStoryletBundle } from '@/narrative/buildStoryletBundle';
import { downloadJson, slugify } from '@/narrative/convertToGameProject';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { appendRunLog } from '@/narrative/runLog';
import { storageKey } from '@/project/projectScope';

import type { SegmentIssue } from '@/narrative/types';

/**
 * Действия шелла, которым нужен весь стек проекта: сборка бандла и архив
 * черновика. Живут отдельно от index.tsx — там и без них тесно.
 */

const DRAFT_ARCHIVE_KEY = storageKey('gu-draft-archive');

export type ExportGate =
  | { ok: true }
  /** Не собрать в принципе: нет артефактов. */
  | { ok: false; stackReason: string }
  /** Собрать можно, но QA нашёл ошибки. */
  | { ok: false; errors: SegmentIssue[] };

/**
 * Чистое правило гейта: сначала физическая возможность собрать бандл, потом
 * ошибки QA. Вынесено из хука, чтобы правило проверялось тестом, а не кликом.
 */
export function computeExportGate(inputs: {
  hasSpine: boolean;
  hasCalendar: boolean;
  hasSchedule: boolean;
  hasWorld: boolean;
  qaErrors: SegmentIssue[];
}): ExportGate {
  const stackReason = !inputs.hasSpine
    ? 'нет хребта — сначала прогон'
    : !inputs.hasCalendar
    ? 'нет календаря'
    : !inputs.hasSchedule
    ? 'нет расписания персонажей'
    : !inputs.hasWorld
    ? 'нет модели мира'
    : null;

  if (stackReason) return { ok: false, stackReason };
  if (inputs.qaErrors.length > 0) return { ok: false, errors: inputs.qaErrors };
  return { ok: true };
}

export function useStudioActions() {
  const brief = useBriefStore(s => s.brief);
  const selector = useBriefStore(s => s.selector);

  const spine = useNarrativeStore(s => s.spine);
  const calendar = useNarrativeStore(s => s.calendar);
  const schedule = useNarrativeStore(s => s.schedule);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const storyQA = useNarrativeStore(s => s.storyQA);

  const qaErrors = useMemo(() => (storyQA?.issues ?? []).filter(i => i.severity === 'error'), [storyQA]);

  /** Можно ли качать бандл прямо сейчас — или нужна модалка. */
  const exportGate = computeExportGate({
    hasSpine: spine != null,
    hasCalendar: calendar != null,
    hasSchedule: schedule != null,
    hasWorld: worldModel != null,
    qaErrors,
  });

  const exportBundle = useCallback(() => {
    const state = useNarrativeStore.getState();
    if (!state.spine || !state.calendar || !state.schedule || !state.worldModel) return;

    const { bundle } = buildStoryletBundle(
      brief,
      state.spine,
      state.calendar,
      state.schedule,
      state.worldModel,
      state.spineBeatProse,
      state.unitProse,
      state.eventUnits,
      state.endings,
      state.images,
      state.characters,
      {
        base: state.audioBase,
        moodBeds: state.audioMoodBeds,
        specialBeds: state.audioSpecialBeds,
        byLi: state.audioByLi,
        sfx: state.audioSfx,
      },
      { tagMap: state.tagMap, narrations: state.anchorNarrations ?? undefined },
      { selector },
    );

    downloadJson(`${slugify(bundle.title)}.gu.json`, bundle);
    appendRunLog('ok', `бандл собран · ${bundle.title}`);
  }, [brief, selector]);

  /**
   * Архив черновика перед сбросом: не восстанавливается кнопкой, но и не
   * теряется — оплаченные стадии лежат в localStorage, если понадобятся.
   */
  const archiveDraft = useCallback(() => {
    const run = useNarrativeStore.getState().calendarRun;
    if (!run) return;
    try {
      localStorage.setItem(DRAFT_ARCHIVE_KEY, JSON.stringify({ at: Date.now(), run }));
      appendRunLog('info', `черновик заархивирован · ${DRAFT_ARCHIVE_KEY}`);
    } catch {
      // Квота localStorage переполнена — сброс важнее архива.
      appendRunLog('error', 'архив черновика не сохранён — не хватило места в localStorage');
    }
  }, []);

  return { exportGate, exportBundle, archiveDraft, qaErrors };
}
