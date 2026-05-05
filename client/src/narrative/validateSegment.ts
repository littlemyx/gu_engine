import type {
  AnchorPlan,
  ArchetypeProfile,
  Brief,
  DraftChoice,
  DraftScene,
  GeneratedSegment,
  OutlinePlan,
  SegmentIssue,
  StateVarPath,
} from './types';
import { validateGeneratedSegment } from './types';
import { ARCHETYPES } from './archetypes';
import { computeStartRanges } from './segmentBaseline';

/**
 * Семантическая валидация сгенерированного сегмента.
 *
 * Проверяет:
 *   1. Reachability state-инварианта anchorTo:
 *      хотя бы один путь от entrySceneId до выхода (nextSceneId === null)
 *      должен суммарно сдвигать state из baseline-диапазонов (computeStartRanges)
 *      в anchorTo.entryStateRequired.ranges и устанавливать все
 *      anchorTo.entryStateRequired.flagsRequired.
 *   2. Лимит шага архетипа: для slow_burn-типа архетипов с заданным
 *      maxPerSceneDelta никакой выбор не должен делать скачок больше лимита.
 *   3. Pivot-инвариант: для tension_to_affection_pivot хотя бы один
 *      выбор должен резко двигать affection (≥ 0.12) и снижать tension.
 *
 * Reachability — range-feasibility: для каждой target-переменной проверяем,
 * существует ли стартовое состояние в baseline-диапазоне такое, что start +
 * Σdelta попадает в target-диапазон. Это менее строго, чем точечная оценка по
 * lo-углу, и совпадает с тем baseline-блоком, который видит LLM в промпте.
 *
 * Возвращает SegmentIssue[]; пустой массив = всё ок.
 */

export type SegmentValidationContext = {
  anchorFrom: AnchorPlan;
  anchorTo: AnchorPlan;
  /** Профиль архетипа маршрута, или null для common-route segments. */
  archetype: ArchetypeProfile | null;
};

const DELTA_TOLERANCE = 0.001;
const PIVOT_AFFECTION_DELTA = 0.12;

type PathSummary = {
  deltas: Record<StateVarPath, number>;
  flags: Set<string>;
};

export function validateSegmentSemantics(segment: GeneratedSegment, ctx: SegmentValidationContext): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const sceneMap = new Map<string, DraftScene>(segment.scenes.map(s => [s.id, s]));

  const startRanges = computeStartRanges(ctx.anchorFrom, ctx.anchorTo, ctx.archetype);
  const startFlags = new Set<string>(ctx.anchorFrom.establishes);

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

  // Сводим каждый путь к Σdelta + final flags.
  const summaries: PathSummary[] = paths.map(path => {
    const deltas: Record<StateVarPath, number> = {};
    const flags = new Set(startFlags);
    for (const choice of path) {
      for (const [p, d] of Object.entries(choice.effects.stateDeltas)) {
        deltas[p] = (deltas[p] ?? 0) + d;
      }
      for (const f of choice.effects.flagSet) flags.add(f);
      for (const f of choice.effects.flagClear) flags.delete(f);
    }
    return { deltas, flags };
  });

  const hasSatisfying = summaries.some(s => isFeasible(s, startRanges, targetRanges, targetFlags));

  if (!hasSatisfying) {
    // Привязываем диагностику к ОДНОМУ "лучшему кандидат-пути" — тому, что
    // удовлетворяет максимуму требований, а на остальных имеет минимальный
    // суммарный gap. Так LLM получает связную картину "вот на этом пути
    // подкрути Σdelta этих переменных и доустанови этот флаг", а не разбросанные
    // подсказки от разных путей, которые он не может скомбинировать.
    const best = pickBestCandidatePath(summaries, startRanges, targetRanges, targetFlags);
    const totalReqs = Object.keys(targetRanges).length + targetFlags.length;
    const satisfiedReqs = best.varsFeasible + best.flagsSatisfied;
    issues.push({
      severity: 'error',
      scope: 'state-reachability',
      message:
        `Ни один из ${paths.length} путей до выхода не выполняет все требования anchorTo (${ctx.anchorTo.id}) ` +
        `одновременно. Лучший кандидат-путь удовлетворяет ${satisfiedReqs} из ${totalReqs} требований; ` +
        `см. конкретные правки ниже — все они относятся к ОДНОМУ этому пути, ` +
        `и фиксить их надо вместе на одной "успешной" ветке (а не размазывать по разным).`,
    });

    for (const [p, [tLo, tHi]] of Object.entries(targetRanges)) {
      const issue = diagnoseVariableForPath(p, [tLo, tHi], best.summary, startRanges);
      if (issue) issues.push(issue);
    }

    for (const f of targetFlags) {
      if (!best.summary.flags.has(f)) {
        issues.push({
          severity: 'error',
          scope: `state-reachability/flag:${f}`,
          message: `на лучшем кандидат-пути флаг "${f}" не установлен — добавь flagSet:["${f}"] в один из выборов этого пути.`,
        });
      }
    }
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
 * Прогоняет structural + semantic validators для одного сегмента и
 * возвращает SegmentIssue[]. Пустой массив = ок.
 *
 * Используется в SegmentDrawer для recompute issues по сегменту,
 * который был восстановлен из persisted-стора (и где status хука
 * `useSegmentGeneration` уже забыл свой `issues`-массив).
 */
export function getSegmentValidations(
  brief: Brief,
  outline: OutlinePlan,
  fromId: string,
  toId: string,
  segment: GeneratedSegment,
): SegmentIssue[] {
  const anchorFrom = outline.anchors.find(a => a.id === fromId);
  const anchorTo = outline.anchors.find(a => a.id === toId);
  if (!anchorFrom || !anchorTo) return [];
  const focusLiId = anchorTo.characterFocus ?? anchorFrom.characterFocus ?? null;
  const li = focusLiId ? brief.loveInterests.find(l => l.id === focusLiId) : null;
  const archetype: ArchetypeProfile | null = li ? ARCHETYPES[li.archetype] : null;
  return [
    ...validateGeneratedSegment(segment),
    ...validateSegmentSemantics(segment, { anchorFrom, anchorTo, archetype }),
  ];
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

function isFeasible(
  s: PathSummary,
  startRanges: Record<StateVarPath, [number, number]>,
  targetRanges: Record<StateVarPath, [number, number]>,
  targetFlags: string[],
): boolean {
  for (const [p, [tLo, tHi]] of Object.entries(targetRanges)) {
    const start = startRanges[p] ?? [0, 0];
    const d = s.deltas[p] ?? 0;
    const lower = Math.max(start[0], tLo - d);
    const upper = Math.min(start[1], tHi - d);
    if (lower > upper + DELTA_TOLERANCE) return false;
  }
  for (const f of targetFlags) {
    if (!s.flags.has(f)) return false;
  }
  return true;
}

/**
 * Запас от границы feasible-интервала, который мы рекомендуем LLM-у. Цель —
 * чтобы при перегенерации модель не садилась ровно на край, потому что
 * следующий ретрай легко проигрывает 0.01-0.02 на rounding-е и ошибка
 * возвращается. Полшага типичной дельты выбора (-0.1...+0.15) — норм запас.
 */
const RECOMMENDED_MARGIN = 0.05;

type CandidateScore = {
  summary: PathSummary;
  varsFeasible: number;
  flagsSatisfied: number;
  totalGap: number;
};

/**
 * Выбирает один путь, на котором меньше всего "не сходится". Метрика:
 *   1) больше всего переменных уже feasible
 *   2) больше всего требуемых флагов уже выставлено
 *   3) минимальный суммарный gap на оставшихся переменных
 *
 * Это даёт LLM-у одну "почти решённую" ветку, на которой надо точечно
 * докрутить дельты и/или флаги, вместо мерцания между разными путями.
 */
function pickBestCandidatePath(
  summaries: PathSummary[],
  startRanges: Record<StateVarPath, [number, number]>,
  targetRanges: Record<StateVarPath, [number, number]>,
  targetFlags: string[],
): CandidateScore {
  const scored: CandidateScore[] = summaries.map(s => {
    let varsFeasible = 0;
    let totalGap = 0;
    for (const [p, [tLo, tHi]] of Object.entries(targetRanges)) {
      const start = startRanges[p] ?? [0, 0];
      const d = s.deltas[p] ?? 0;
      const reachLo = start[0] + d;
      const reachHi = start[1] + d;
      if (reachHi < tLo - DELTA_TOLERANCE) {
        totalGap += tLo - reachHi;
      } else if (reachLo > tHi + DELTA_TOLERANCE) {
        totalGap += reachLo - tHi;
      } else {
        varsFeasible++;
      }
    }
    let flagsSatisfied = 0;
    for (const f of targetFlags) {
      if (s.flags.has(f)) flagsSatisfied++;
    }
    return { summary: s, varsFeasible, flagsSatisfied, totalGap };
  });
  scored.sort(
    (a, b) => b.varsFeasible - a.varsFeasible || b.flagsSatisfied - a.flagsSatisfied || a.totalGap - b.totalGap,
  );
  return scored[0];
}

/**
 * Diagnose одной переменной относительно ОДНОГО конкретного пути (а не
 * "лучшего из всех путей по этой переменной"). Возвращает null, если этот
 * путь уже feasible по этой переменной.
 */
function diagnoseVariableForPath(
  p: StateVarPath,
  [tLo, tHi]: [number, number],
  s: PathSummary,
  startRanges: Record<StateVarPath, [number, number]>,
): SegmentIssue | null {
  const start = startRanges[p] ?? [0, 0];
  const sLo = start[0];
  const sHi = start[1];
  const d = s.deltas[p] ?? 0;
  const reachLo = sLo + d;
  const reachHi = sHi + d;

  let direction: 'up' | 'down';
  let gap: number;
  if (reachHi < tLo - DELTA_TOLERANCE) {
    direction = 'up';
    gap = tLo - reachHi;
  } else if (reachLo > tHi + DELTA_TOLERANCE) {
    direction = 'down';
    gap = reachLo - tHi;
  } else {
    return null;
  }

  // Feasibility (interval): должен ∃ start ∈ [sLo, sHi] такой, что
  // start + Σdelta ∈ [tLo, tHi]. Эквивалентно: Σdelta ∈ [tLo - sHi, tHi - sLo].
  const feasLo = tLo - sHi;
  const feasHi = tHi - sLo;

  // Рекомендуем число НЕ на самой границе, чтобы LLM на ретрае не топталась
  // вокруг неё. Если интервал шире 2×margin — отступаем на margin от ближней
  // границы; если узкий — берём середину.
  let recommended: number;
  if (feasHi - feasLo < RECOMMENDED_MARGIN * 2) {
    recommended = (feasLo + feasHi) / 2;
  } else if (direction === 'down') {
    recommended = feasHi - RECOMMENDED_MARGIN;
  } else {
    recommended = feasLo + RECOMMENDED_MARGIN;
  }
  const extra = recommended - d;

  const fmtSigned = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
  return {
    severity: 'error',
    scope: `state-reachability/${p}`,
    message:
      `target [${tLo.toFixed(2)}, ${tHi.toFixed(2)}], baseline [${sLo.toFixed(2)}, ${sHi.toFixed(2)}], ` +
      `на лучшем кандидат-пути Σdelta=${fmtSigned(d)} → reachable [${reachLo.toFixed(2)}, ${reachHi.toFixed(2)}]; ` +
      `feasible Σdelta-диапазон для этой переменной [${fmtSigned(feasLo)}, ${fmtSigned(
        feasHi,
      )}], текущее значение вне него ` +
      `(промах ${gap.toFixed(2)} ${direction === 'up' ? 'вниз' : 'вверх'}). ` +
      `Цель: Σdelta по этому пути ≈ ${fmtSigned(recommended)} — добавь ещё ${fmtSigned(extra)} по этой переменной ` +
      `к одному или нескольким выборам ИМЕННО на этом пути.`,
  };
}
