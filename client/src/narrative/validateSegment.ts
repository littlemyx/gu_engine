import type {
  AnchorPlan,
  ArchetypeProfile,
  Brief,
  DraftChoice,
  DraftScene,
  GeneratedSegment,
  OutlinePlan,
  SegmentIssue,
} from './types';
import { validateGeneratedSegment } from './types';
import { ARCHETYPES } from './archetypes';

/**
 * Семантическая валидация сгенерированного сегмента.
 *
 * Проверяет:
 *   1. Reachability state-инварианта anchorTo:
 *      хотя бы один путь от entrySceneId до выхода (nextSceneId === null)
 *      должен суммарно сдвигать state в anchorTo.entryStateRequired.ranges
 *      и устанавливать все anchorTo.entryStateRequired.flagsRequired.
 *   2. Лимит шага архетипа: для slow_burn-типа архетипов с заданным
 *      maxPerSceneDelta никакой выбор не должен делать скачок больше лимита.
 *   3. Pivot-инвариант: для tension_to_affection_pivot хотя бы один
 *      выбор должен резко двигать affection (≥ 0.12) и снижать tension.
 *
 * Возвращает SegmentIssue[]; пустой массив = всё ок.
 *
 * Алгоритм за O(scenes × choices × paths). Для типичного сегмента
 * (3-6 сцен × 2-3 выбора) это ~десятки путей, считается мгновенно.
 */

export type SegmentValidationContext = {
  anchorFrom: AnchorPlan;
  anchorTo: AnchorPlan;
  /** Профиль архетипа маршрута, или null для common-route segments. */
  archetype: ArchetypeProfile | null;
};

const DELTA_TOLERANCE = 0.001;
const PIVOT_AFFECTION_DELTA = 0.12;

export function validateSegmentSemantics(segment: GeneratedSegment, ctx: SegmentValidationContext): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const sceneMap = new Map<string, DraftScene>(segment.scenes.map(s => [s.id, s]));

  // Стартовое состояние: нижняя граница диапазонов anchorFrom (если есть)
  // + флаги, выставленные anchorFrom и его предками (establishes).
  const startState: Record<string, number> = {};
  if (ctx.anchorFrom.entryStateRequired?.ranges) {
    for (const [path, [lo]] of Object.entries(ctx.anchorFrom.entryStateRequired.ranges)) {
      startState[path] = lo;
    }
  }
  const startFlags = new Set<string>(ctx.anchorFrom.establishes);

  // Целевые требования
  const targetRanges = ctx.anchorTo.entryStateRequired?.ranges ?? {};
  const targetFlags = ctx.anchorTo.entryStateRequired?.flagsRequired ?? [];

  // Перечисляем все пути от entry до выхода (nextSceneId === null).
  const paths: DraftChoice[][] = [];
  const enumerate = (sceneId: string, acc: DraftChoice[], visited: Set<string>) => {
    if (visited.has(sceneId)) return; // защита от циклов
    const scene = sceneMap.get(sceneId);
    if (!scene) return;
    const next = new Set(visited);
    next.add(sceneId);
    for (const choice of scene.choices) {
      const path = [...acc, choice];
      if (choice.nextSceneId === null) {
        paths.push(path);
      } else {
        enumerate(choice.nextSceneId, path, next);
      }
    }
  };
  enumerate(segment.entrySceneId, [], new Set());

  // Если ни одного пути нет — это структурная проблема,
  // её должен ловить уже validateGeneratedSegment, но защитимся.
  if (paths.length === 0) return issues;

  // Проверка: хотя бы один путь приводит state в нужные диапазоны и
  // выставляет все требуемые флаги.
  let satisfying = 0;
  for (const path of paths) {
    const state = { ...startState };
    const flags = new Set(startFlags);
    for (const choice of path) {
      for (const [p, d] of Object.entries(choice.effects.stateDeltas)) {
        state[p] = (state[p] ?? 0) + d;
      }
      for (const f of choice.effects.flagSet) flags.add(f);
      for (const f of choice.effects.flagClear) flags.delete(f);
    }
    if (pathSatisfies(state, flags, targetRanges, targetFlags)) satisfying++;
  }

  if (satisfying === 0) {
    issues.push({
      severity: 'error',
      scope: 'state-reachability',
      message: `ни один из ${paths.length} путей не приводит state в требования anchorTo (${ctx.anchorTo.id})`,
    });
  }

  // Лимит шага per-choice (например, slow_burn ⇒ не более 0.08).
  const maxDelta = ctx.archetype?.trajectory.maxPerSceneDelta;
  if (maxDelta !== undefined) {
    for (const scene of segment.scenes) {
      for (const choice of scene.choices) {
        for (const [path, delta] of Object.entries(choice.effects.stateDeltas)) {
          if (Math.abs(delta) > maxDelta + DELTA_TOLERANCE) {
            issues.push({
              severity: 'warning',
              scope: `${scene.id}/${choice.id}`,
              message: `шаг ${path}=${delta} превышает archetype.trajectory.maxPerSceneDelta=${maxDelta}`,
            });
          }
        }
      }
    }
  }

  // Pivot-инвариант для tension_to_affection_pivot:
  // должен быть хотя бы один выбор с большим affection-скачком и tension-падением.
  if (ctx.archetype?.trajectory.shape === 'tension_to_affection_pivot') {
    const focus = ctx.anchorTo.characterFocus ?? ctx.anchorFrom.characterFocus;
    const affKey = focus ? `relationship[${focus}].affection` : null;
    const tenKey = focus ? `relationship[${focus}].tension` : null;
    let foundPivot = false;
    if (affKey && tenKey) {
      for (const scene of segment.scenes) {
        for (const choice of scene.choices) {
          const aff = choice.effects.stateDeltas[affKey] ?? 0;
          const ten = choice.effects.stateDeltas[tenKey] ?? 0;
          if (aff >= PIVOT_AFFECTION_DELTA && ten <= -PIVOT_AFFECTION_DELTA / 2) {
            foundPivot = true;
            break;
          }
        }
        if (foundPivot) break;
      }
    }
    if (!foundPivot && segment.scenes.length >= 3) {
      // Только если сегмент достаточно крупный, чтобы pivot был в принципе уместен.
      issues.push({
        severity: 'warning',
        scope: 'archetype-trajectory',
        message: `архетип ожидает pivot-сцену с резким ростом affection и снижением tension; не найдено ни одного такого выбора`,
      });
    }
  }

  return issues;
}

/**
 * Прогоняет structural + semantic validators по всем сегментам outline-а
 * и возвращает map "fromId->toId" → SegmentIssue[]. Пустой массив = ок.
 *
 * Используется графом outline-а для подсветки невалидных рёбер и счётчиками.
 */
export function getAllSegmentValidations(
  brief: Brief,
  outline: OutlinePlan,
  segments: Record<string, GeneratedSegment>,
): Record<string, SegmentIssue[]> {
  const result: Record<string, SegmentIssue[]> = {};
  const anchorById = new Map(outline.anchors.map(a => [a.id, a]));

  for (const e of outline.anchorEdges) {
    const key = `${e.from}->${e.to}`;
    const seg = segments[key];
    if (!seg) continue;
    const anchorFrom = anchorById.get(e.from);
    const anchorTo = anchorById.get(e.to);
    if (!anchorFrom || !anchorTo) continue;

    const focusLiId = anchorTo.characterFocus ?? anchorFrom.characterFocus ?? null;
    const li = focusLiId ? brief.loveInterests.find(l => l.id === focusLiId) : null;
    const archetype: ArchetypeProfile | null = li ? ARCHETYPES[li.archetype] : null;

    const issues: SegmentIssue[] = [
      ...validateGeneratedSegment(seg),
      ...validateSegmentSemantics(seg, { anchorFrom, anchorTo, archetype }),
    ];
    if (issues.length > 0) result[key] = issues;
  }
  return result;
}

function pathSatisfies(
  state: Record<string, number>,
  flags: Set<string>,
  targetRanges: Record<string, [number, number]>,
  targetFlags: string[],
): boolean {
  for (const [path, [lo, hi]] of Object.entries(targetRanges)) {
    const v = state[path] ?? 0;
    if (v < lo - DELTA_TOLERANCE || v > hi + DELTA_TOLERANCE) return false;
  }
  for (const f of targetFlags) {
    if (!flags.has(f)) return false;
  }
  return true;
}
