import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import { useArtifactStore } from './artifactStore';
import { recomputeAll } from './fingerprint';
import { reconcile } from './migrate';
import { briefOwn, collectPresence } from './presence';
import { topoOrder } from './stageGraph';
import { onGenerated, onKeepOwn } from './transitions';

import type { ArtifactIndex } from './types';

/**
 * Учёт результатов прогона — зовётся в единственной точке коммита
 * (`calendarRunner`, сразу после `commitCalendarRun`).
 *
 * Раньше этого места и не могло быть: «что прогон произвёл» нигде не
 * записывалось, и понять, из какого брифа собрана сцена, было нельзя. Теперь
 * коммит стека сопровождается коммитом учёта, и оба происходят одним шагом:
 * история и знание о ней не расходятся.
 *
 * Запертое не трогается — за это отвечает `onGenerated`. Артефакты, чей
 * отпечаток не изменился (прогон взял их из кэша), тоже не переписываются:
 * лишний дубль в истории — это ложь о том, что работа была.
 *
 * `keepFresh` — строки, по которым автор в смете выбрал «оставить моё». Их
 * отпечаток тоже освежается (конфликт закрыт), но дубль не заводится: прогон
 * их не касался. Штамповать это можно только ЗДЕСЬ, после коммита: прогон мог
 * пересобрать предков, и лишь пост-коммитный пересчёт даёт тот отпечаток, при
 * котором авторская строка действительно свежа.
 */
export function recordRunCommit(runId: string, spent?: number, keepFresh: string[] = []): void {
  const n = useNarrativeStore.getState();
  const brief = useBriefStore.getState().brief;

  const present = collectPresence({
    brief,
    castPlan: n.castPlan,
    worldModel: n.worldModel,
    calendar: n.calendar,
    spine: n.spine,
    schedule: n.schedule,
    eventUnits: n.eventUnits,
    unitProse: n.unitProse,
    spineBeatProse: n.spineBeatProse,
    endings: n.endings,
    anchorNarrations: n.anchorNarrations,
    images: n.images,
    audioTracks: n.audioBase ? ['base'] : [],
  });

  const owns = briefOwn(brief);
  const store = useArtifactStore.getState();

  // Сначала завести то, что прогон создал впервые, потом обновить отпечатки.
  const withNew = reconcile(store.index, present, owns);
  const current = recomputeAll(withNew, topoOrder(), owns);

  const next: ArtifactIndex = { ...withNew };
  const kept = new Set(keepFresh);
  let touched = 0;

  for (const [key, meta] of Object.entries(withNew)) {
    if (meta.fingerprint === current[key]) continue;
    next[key] = kept.has(key)
      ? onKeepOwn(meta, current[key])
      : onGenerated(meta, { fingerprint: current[key], runId, cost: costPerItem(spent, present) });
    touched += 1;
  }

  if (touched > 0 || withNew !== store.index) store.replaceIndex(next);
}

/**
 * Потраченное за прогон делится поровну между позициями. Точная цена придёт
 * из costModel вместе с колл-щитом; до тех пор честнее показать усреднение,
 * чем не показать ничего.
 */
function costPerItem(spent: number | undefined, present: ReturnType<typeof collectPresence>): number | undefined {
  if (spent == null) return undefined;
  const items = Object.values(present).reduce((sum, list) => sum + (list?.length ?? 0), 0);
  return items > 0 ? spent / items : undefined;
}
