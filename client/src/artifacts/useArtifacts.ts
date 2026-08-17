import { useEffect, useMemo } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import { useArtifactStore } from './artifactStore';
import { healIsolatedFingerprints, reconcile, refreshFingerprints } from './migrate';
import { collectPresence, OWNS_REV, ownsRev1, storyOwns } from './presence';

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

  const owns = useMemo(() => storyOwns(brief, narrative.worldModel), [brief, narrative.worldModel]);

  useEffect(() => {
    // Смена формулы индекса: отпечатки в сторе записаны старым кодом —
    // освежаем один раз, ДО сверки, иначе история «протухла» бы апдейтом.
    // Ревизия 2: worldModel вошёл в owns. Ревизия 3: лечение отпечатков,
    // рождённых изолированным reconcile (медиа протухали с рождения).
    const store = useArtifactStore.getState();
    let base = index;
    if (store.ownsRev < OWNS_REV) {
      if (store.ownsRev < 2) base = refreshFingerprints(index, ownsRev1(brief), owns);
      base = healIsolatedFingerprints(base, owns);
      store.markOwnsRev(OWNS_REV);
    }

    const next = reconcile(base, present, owns);
    if (next !== index) replaceIndex(next);
  }, [index, present, owns, brief, replaceIndex]);

  return { index, owns };
}
