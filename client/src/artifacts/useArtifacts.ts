import { useEffect, useMemo } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import { useArtifactStore } from './artifactStore';
import { reconcile } from './migrate';
import { briefOwn, collectPresence } from './presence';

import type { ArtifactIndex } from './types';

/**
 * Учёт артефактов, сведённый с тем, что реально лежит в сторах.
 *
 * Дозаведение делается на каждом изменении сторов, а не однажды при старте:
 * артефакты появляются не только из прогона, но и из импорта чужого `.guproj`
 * и из старых прогонов, доехавших до коммита. Уже учтённое дозаведение не
 * трогает, поэтому владение и дубли переживают любую синхронизацию.
 */
export function useArtifacts(): { index: ArtifactIndex; owns: Record<string, unknown> } {
  const brief = useBriefStore(s => s.brief);
  const narrative = useNarrativeStore();
  const index = useArtifactStore(s => s.index);
  const replaceIndex = useArtifactStore(s => s.replaceIndex);

  const present = useMemo(
    () =>
      collectPresence({
        brief,
        castPlan: narrative.castPlan,
        worldModel: narrative.worldModel,
        calendar: narrative.calendar,
        spine: narrative.spine,
        schedule: narrative.schedule,
        eventUnits: narrative.eventUnits,
        unitProse: narrative.unitProse,
        spineBeatProse: narrative.spineBeatProse,
        endings: narrative.endings,
        anchorNarrations: narrative.anchorNarrations,
        images: narrative.images,
        audioTracks: narrative.audioBase ? ['base'] : [],
      }),
    [brief, narrative],
  );

  const owns = useMemo(() => briefOwn(brief), [brief]);

  useEffect(() => {
    const next = reconcile(index, present, owns);
    if (next !== index) replaceIndex(next);
  }, [index, present, owns, replaceIndex]);

  return { index, owns };
}
