import { useMemo } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import { deriveBlueprint } from '../derive/blueprintModel';
import { deriveRelations } from '../derive/relationsModel';
import { deriveScore } from '../derive/scoreModel';
import { deriveScript } from '../derive/scriptModel';
import { deriveWorldMap } from '../derive/worldMapModel';
import { useStudioProjectStore } from '../studioProjectStore';

/**
 * Модели существующих вью для конвейерных зон.
 *
 * Зоны показывают те же чертёж, партитуру и сценарий, что и старый вьюпорт, —
 * переписывать их ради нового шелла незачем. Здесь собрана ровно та же
 * деривация, что в `studio/index.tsx`, минус производственная обвязка (сбои QA
 * и фаза прогона): в конвейере за производство отвечает ведомость, а не вью.
 */
export function useZoneViews() {
  const brief = useBriefStore(s => s.brief);
  const n = useNarrativeStore();
  const branchAssignment = useStudioProjectStore(s => s.branchAssignment);
  const scriptBracket = useStudioProjectStore(s => s.scriptBracket);

  const liIds = useMemo(() => brief.loveInterests.map(li => li.id), [brief.loveInterests]);

  const blueprint = useMemo(
    () =>
      n.spine && n.calendar
        ? deriveBlueprint({
            spine: n.spine,
            calendar: n.calendar,
            spineBeatProse: n.spineBeatProse,
            liIds,
            branchAssignment,
            issues: [],
            runPhase: null,
          })
        : null,
    [n.spine, n.calendar, n.spineBeatProse, liIds, branchAssignment],
  );

  const score = useMemo(
    () =>
      n.spine && n.calendar && n.schedule
        ? deriveScore({
            brief,
            calendar: n.calendar,
            spine: n.spine,
            schedule: n.schedule,
            worldModel: n.worldModel,
            eventUnits: n.eventUnits,
            unitProse: n.unitProse,
            spineBeatProse: n.spineBeatProse,
            branchAssignment,
            issues: [],
          })
        : null,
    [
      brief,
      n.calendar,
      n.spine,
      n.schedule,
      n.worldModel,
      n.eventUnits,
      n.unitProse,
      n.spineBeatProse,
      branchAssignment,
    ],
  );

  const script = useMemo(
    () =>
      n.spine && n.calendar
        ? deriveScript({
            brief,
            calendar: n.calendar,
            spine: n.spine,
            worldModel: n.worldModel,
            eventUnits: n.eventUnits,
            unitProse: n.unitProse,
            spineBeatProse: n.spineBeatProse,
            bracket: scriptBracket,
            branchAssignment,
            issues: [],
          })
        : null,
    [
      brief,
      n.calendar,
      n.spine,
      n.worldModel,
      n.eventUnits,
      n.unitProse,
      n.spineBeatProse,
      scriptBracket,
      branchAssignment,
    ],
  );

  const worldMap = useMemo(
    () =>
      deriveWorldMap({
        worldModel: n.worldModel,
        spine: n.spine,
        calendar: n.calendar,
        eventUnits: n.eventUnits,
        images: n.images,
      }),
    [n.worldModel, n.spine, n.calendar, n.eventUnits, n.images],
  );

  const relations = useMemo(
    () =>
      n.spine && n.calendar && n.schedule
        ? deriveRelations({
            brief,
            calendar: n.calendar,
            spine: n.spine,
            schedule: n.schedule,
            eventUnits: n.eventUnits,
            unitProse: n.unitProse,
          })
        : null,
    [brief, n.calendar, n.spine, n.schedule, n.eventUnits, n.unitProse],
  );

  return { blueprint, score, script, worldMap, relations };
}
