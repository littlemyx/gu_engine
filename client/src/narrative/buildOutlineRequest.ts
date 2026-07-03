import type { Brief, ArchetypeProfile, ArchetypeId } from './types';
import { ARCHETYPES } from './archetypes';

export type OutlineTargets = {
  /** Целевое число якорей (из targetDurationMinutes, ~2.5 мин на якорь). */
  anchorCount: number;
  /** Распределение якорей по актам, индекс = act - 1. */
  anchorsPerAct: number[];
  /** Число «чисто сюжетных» якорей без LI (из commonRouteShare). */
  plotOnlyAnchorCount: number;
};

const MINUTES_PER_ANCHOR = 2.5;
const MIN_ANCHORS = 6;
const MAX_ANCHORS = 20;

/** Весовые доли актов: завязка/развязка легче середины. */
function actWeights(acts: number): number[] {
  if (acts <= 1) return [1];
  if (acts === 2) return [0.45, 0.55];
  if (acts === 3) return [0.25, 0.45, 0.3];
  if (acts === 4) return [0.2, 0.3, 0.3, 0.2];
  // 5+: равномерная середина, лёгкие края
  const middle = acts - 2;
  return [0.15, ...Array.from({ length: middle }, () => 0.7 / middle), 0.15];
}

/**
 * Первые реальные потребители brief.scale.targetDurationMinutes и
 * commonRouteShare: превращаем их в целевые числа для outline-генератора
 * и валидатора.
 */
export function computeOutlineTargets(brief: Brief): OutlineTargets {
  const anchorCount = Math.min(
    MAX_ANCHORS,
    Math.max(MIN_ANCHORS, Math.round(brief.scale.targetDurationMinutes / MINUTES_PER_ANCHOR)),
  );

  const weights = actWeights(brief.scale.acts);
  const anchorsPerAct = weights.map(w => Math.max(1, Math.round(anchorCount * w)));

  return {
    anchorCount,
    anchorsPerAct,
    plotOnlyAnchorCount: Math.round(brief.scale.commonRouteShare * anchorCount),
  };
}

/**
 * Собирает payload для /generate/outline:
 *   - бриф (как-есть)
 *   - только те профили архетипов, что используются LI в брифе
 *   - вычисленные целевые бюджеты (число якорей, распределение по актам)
 *
 * Не передаём всю библиотеку — экономит токены и фокусирует контекст LLM
 * на релевантных архетипах.
 */
export function buildOutlineRequestPayload(brief: Brief): {
  brief: Brief;
  archetypeProfiles: Record<ArchetypeId, ArchetypeProfile>;
  targets: OutlineTargets;
} {
  const usedIds = new Set<ArchetypeId>(brief.loveInterests.map(li => li.archetype));
  const archetypeProfiles = {} as Record<ArchetypeId, ArchetypeProfile>;
  for (const id of usedIds) {
    archetypeProfiles[id] = ARCHETYPES[id];
  }
  return { brief, archetypeProfiles, targets: computeOutlineTargets(brief) };
}
