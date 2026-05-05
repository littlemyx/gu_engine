import type { AnchorPlan, ArchetypeProfile, Range, StateVarPath } from './types';

/**
 * Считает диапазоны state на входе сегмента — единый источник правды для
 * валидатора (validateSegmentSemantics) и для LLM-промпта (text-generator).
 *
 * Раньше валидатор брал `lo` от `anchorFrom.entryStateRequired.ranges` и для
 * остальных переменных молчаливо предполагал 0 (через `state[path] ?? 0`).
 * LLM никогда не знал об этом 0-предположении — отсюда вечный retry-цикл, когда
 * `anchorTo` требует, например, trust ∈ [0.3, 0.6], но trust не упомянут в
 * anchorFrom: LLM генерил +0.05/+0.1 от trust ∈ [0.0, 0.3], а валидатор считал,
 * что trust стартует с 0.0.
 *
 * Теперь baseline формируется детерминированно:
 *   1. Для каждого пути из anchorFrom.entryStateRequired.ranges → берём этот
 *      диапазон без изменений.
 *   2. Для путей, упомянутых только в anchorTo.entryStateRequired.ranges:
 *      - если path вида "relationship[<X>].<var>" и archetype.initialState[var]
 *        существует — используем archetype.initialState[var];
 *      - иначе если path — bare key и archetype.initialState[path] есть —
 *        используем его;
 *      - иначе если archetype.additionalStateVars[path] есть — используем
 *        [default, default] (точка-значение из объявления переменной);
 *      - иначе пробуем flat-форму "<var>_<X>" / "<X>_<var>" — это легаси-стиль,
 *        который мог сгенерить старый outline-LLM до фикса промта (например,
 *        "tension_asel" вместо "relationship[asel].tension"). Берём самое
 *        длинное совпадение, чтобы "external_pressure_asel" матчился на
 *        "external_pressure", а не на голое "pressure";
 *      - иначе fallback [0, 0].
 *
 * Возвращаемый объект покрывает ВСЕ переменные, которые валидатор будет
 * проверять, и которые LLM должен сдвигать.
 */
export function computeStartRanges(
  anchorFrom: AnchorPlan,
  anchorTo: AnchorPlan,
  archetype: ArchetypeProfile | null,
): Record<StateVarPath, Range> {
  const result: Record<StateVarPath, Range> = {};

  if (anchorFrom.entryStateRequired?.ranges) {
    for (const [path, range] of Object.entries(anchorFrom.entryStateRequired.ranges)) {
      result[path] = [range[0], range[1]];
    }
  }

  const targetPaths = anchorTo.entryStateRequired?.ranges ? Object.keys(anchorTo.entryStateRequired.ranges) : [];

  for (const path of targetPaths) {
    if (path in result) continue;
    result[path] = baselineForPath(path, archetype);
  }

  return result;
}

function baselineForPath(path: StateVarPath, archetype: ArchetypeProfile | null): Range {
  if (!archetype) return [0, 0];

  const lookup = (key: string): Range | null => {
    const fromInitial = archetype.initialState[key];
    if (fromInitial) return [fromInitial[0], fromInitial[1]];
    if (archetype.additionalStateVars && key in archetype.additionalStateVars) {
      const decl = archetype.additionalStateVars[key];
      return [decl.default, decl.default];
    }
    return null;
  };

  const relMatch = path.match(/^relationship\[[^\]]+\]\.(.+)$/);
  const bareKey = relMatch ? relMatch[1] : path;

  const direct = lookup(bareKey);
  if (direct) return direct;

  // Flat-форма: "<var>_<X>" или "<X>_<var>". Сортируем var-имена по убыванию
  // длины, чтобы самое специфичное совпадение выигрывало (external_pressure
  // важнее, чем pressure).
  const knownVars = [...Object.keys(archetype.initialState), ...Object.keys(archetype.additionalStateVars ?? {})].sort(
    (a, b) => b.length - a.length,
  );

  for (const v of knownVars) {
    if (path === v || path.startsWith(`${v}_`) || path.endsWith(`_${v}`)) {
      const r = lookup(v);
      if (r) return r;
    }
  }

  return [0, 0];
}
