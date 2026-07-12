import type { Brief, SegmentIssue, WorldModel } from './types';
import type { Calendar, SpineBeat, SpinePlan } from './calendarTypes';
import { actSlotWindow } from './calendarTypes';
import { assignBeatSlots } from './beatSchedule';
import type { Guard } from './events';

/**
 * Валидация хребта (SpinePlan) против календаря и мира.
 *
 * Структура (фаза 1): id, окна, акты, флаговые зависимости, назначаемость
 * обязательных битов на слоты. Feasibility листьев (фаза 5): при наличии
 * развилок перебираются ВСЕ комбинации исходов (≤3 развилки × ≤3 исхода =
 * ≤27 листьев) — каждый лист обязан достигать финала и иметь хотя бы одну
 * выполнимую концовку; ветвовой бит, недостижимый на каждом листе, —
 * мёртвый контент (warning).
 *
 * Ошибки блокируют использование (retry-with-feedback previousIssues),
 * warnings показываются автору.
 */

/** Флаги, проверяемые guard-ом (только flag-листья — контракт LLM плоский). */
export function guardFlags(guard: Guard): string[] {
  if ('all' in guard) return guard.all.flatMap(guardFlags);
  if ('any' in guard) return guard.any.flatMap(guardFlags);
  if ('not' in guard) return guardFlags(guard.not);
  if ('flag' in guard) return [guard.flag];
  return [];
}

const VALID_ENDING_KINDS = new Set(['good', 'normal', 'bad']);

/** Лист ветвления: по одному исходу на каждую перечисляемую развилку. */
export type LeafAssignment = {
  /** «bp1=o1, bp2=o2»; пустая строка = развилок нет (единственный лист). */
  label: string;
  /** branchPointId → выбранный outcomeId. */
  assignment: Record<string, string>;
};

/**
 * Все комбинации исходов развилок (декартово произведение). Перечисляются
 * только структурно валидные развилки (2-3 исхода); без развилок — один
 * лист с пустым assignment. Реюз: feasibility validateSpine, dead-content
 * storyQA, критик листьев (D4).
 */
export function enumerateLeafAssignments(spine: SpinePlan): LeafAssignment[] {
  const bps = spine.beats.filter(b => {
    const n = b.outcomes?.length ?? 0;
    return b.kind === 'branchPoint' && n >= 2 && n <= 3;
  });
  let acc: Record<string, string>[] = [{}];
  for (const bp of bps) {
    acc = acc.flatMap(a => (bp.outcomes ?? []).map(o => ({ ...a, [bp.id]: o.id })));
  }
  return acc.map(assignment => ({
    label: bps.map(bp => `${bp.id}=${assignment[bp.id]}`).join(', '),
    assignment,
  }));
}

/**
 * Симуляция установления флагов на одном листе (фикспойнт): флаг доступен
 * со слота установителя (бит — в назначенный assignBeatSlots слот); флаги
 * НЕвыбранных исходов недоступны никогда; бит играется, если каждый его
 * guard-флаг доступен не позже конца окна бита.
 */
export function playableBeatsForLeaf(
  spine: SpinePlan,
  calendar: Calendar,
  assignment: Record<string, string>,
): { played: Set<string>; earliest: Map<string, number> } {
  const beatSlots = assignBeatSlots(spine, calendar);
  const slotOfBeat = (b: SpineBeat): number => beatSlots[b.id] ?? Math.max(0, b.window.fromSlot);

  const earliest = new Map<string, number>();
  const played = new Set<string>();
  const note = (f: string, s: number) => {
    const prev = earliest.get(f);
    if (prev == null || s < prev) earliest.set(f, s);
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of spine.beats) {
      if (played.has(b.id)) continue;
      const ok = guardFlags(b.guard).every(f => {
        const e = earliest.get(f);
        return e != null && e <= b.window.toSlot;
      });
      if (!ok) continue;
      played.add(b.id);
      changed = true;
      const s = slotOfBeat(b);
      for (const f of b.establishes) note(f, s);
      const chosen = assignment[b.id];
      for (const o of b.outcomes ?? []) {
        // У перечисляемой развилки доступен ТОЛЬКО выбранный исход.
        if (chosen == null || o.id === chosen) note(o.setsFlag, s);
      }
    }
  }
  return { played, earliest };
}

export function validateSpine(
  spine: SpinePlan,
  calendar: Calendar,
  brief: Brief,
  worldModel: WorldModel | null,
): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const beats = spine.beats;

  // Дубли id.
  const seen = new Set<string>();
  for (const b of beats) {
    if (seen.has(b.id)) {
      issues.push({ severity: 'error', scope: 'ids', message: `дублирующийся id бита "${b.id}"` });
    }
    seen.add(b.id);
  }

  // Ровно один finale.
  const finales = beats.filter(b => b.kind === 'finale');
  if (finales.length !== 1) {
    issues.push({
      severity: 'error',
      scope: 'structure/finale',
      message: `битов типа finale: ${finales.length}, должен быть ровно один`,
    });
  }

  // Развилки: бюджет и структура исходов.
  const branchPoints = beats.filter(b => b.kind === 'branchPoint');
  const budget = brief.scale.branchPointBudget ?? 0;
  if (branchPoints.length > budget) {
    issues.push({
      severity: 'error',
      scope: 'structure/branchPoints',
      message: `развилок ${branchPoints.length}, бюджет brief.scale.branchPointBudget = ${budget}`,
    });
  }
  for (const bp of branchPoints) {
    const n = bp.outcomes?.length ?? 0;
    if (n < 2 || n > 3) {
      issues.push({
        severity: 'error',
        scope: `beats/${bp.id}/outcomes`,
        message: `развилка "${bp.id}" должна иметь 2-3 исхода, сейчас ${n}`,
      });
    }
  }
  for (const b of beats) {
    if (b.kind !== 'branchPoint' && b.outcomes && b.outcomes.length > 0) {
      issues.push({
        severity: 'error',
        scope: `beats/${b.id}/outcomes`,
        message: `outcomes допустимы только у kind=branchPoint, у "${b.id}" kind=${b.kind}`,
      });
    }
  }

  // Окна: границы, соответствие акту.
  const lastSlot = calendar.slotCount - 1;
  for (const b of beats) {
    if (b.window.fromSlot > b.window.toSlot) {
      issues.push({
        severity: 'error',
        scope: `beats/${b.id}/window`,
        message: `окно бита "${b.id}" пустое: fromSlot ${b.window.fromSlot} > toSlot ${b.window.toSlot}`,
      });
      continue;
    }
    if (b.window.fromSlot < 0 || b.window.toSlot > lastSlot) {
      issues.push({
        severity: 'error',
        scope: `beats/${b.id}/window`,
        message: `окно бита "${b.id}" [${b.window.fromSlot}, ${b.window.toSlot}] выходит за календарь [0, ${lastSlot}]`,
      });
      continue;
    }
    if (b.act < 1 || b.act > brief.scale.acts) {
      issues.push({
        severity: 'error',
        scope: `beats/${b.id}/act`,
        message: `бит "${b.id}" в акте ${b.act}, актов в брифе ${brief.scale.acts}`,
      });
      continue;
    }
    if (b.act <= calendar.actBoundaries.length) {
      const actWin = actSlotWindow(b.act, calendar);
      if (b.window.fromSlot < actWin.fromSlot || b.window.toSlot > actWin.toSlot) {
        issues.push({
          severity: 'error',
          scope: `beats/${b.id}/window`,
          message: `окно бита "${b.id}" [${b.window.fromSlot}, ${b.window.toSlot}] выходит за слоты акта ${b.act} [${actWin.fromSlot}, ${actWin.toSlot}]`,
        });
      }
    }
  }

  // Финал — в последнем акте и его окно накрывает конец календаря.
  const finale = finales[0];
  if (finale && finale.act !== brief.scale.acts) {
    issues.push({
      severity: 'error',
      scope: `beats/${finale.id}/act`,
      message: `finale "${finale.id}" в акте ${finale.act}, должен быть в последнем (${brief.scale.acts})`,
    });
  }

  // Локации существуют в модели мира.
  if (worldModel) {
    const locIds = new Set(worldModel.locations.map(l => l.id));
    for (const b of beats) {
      if (!locIds.has(b.locationId)) {
        issues.push({
          severity: 'error',
          scope: `beats/${b.id}/location`,
          message: `бит "${b.id}" ссылается на несуществующую локацию "${b.locationId}"`,
        });
      }
    }
  }

  // Участники — id LI из брифа или role-плейсхолдеры "$...".
  const liIds = new Set(brief.loveInterests.map(li => li.id));
  for (const b of beats) {
    for (const p of b.participants) {
      if (!p.startsWith('$') && !liIds.has(p)) {
        issues.push({
          severity: 'error',
          scope: `beats/${b.id}/participants`,
          message: `бит "${b.id}": участник "${p}" не найден среди LI брифа (или используйте плейсхолдер "$role")`,
        });
      }
    }
  }

  // Флаговые зависимости: каждый требуемый флаг кем-то устанавливается,
  // граф «устанавливает → требует» ацикличен, требующий бит может идти
  // после устанавливающего (окна позволяют порядок).
  const establishedBy = new Map<string, SpineBeat[]>();
  for (const b of beats) {
    for (const f of b.establishes) {
      const list = establishedBy.get(f) ?? [];
      list.push(b);
      establishedBy.set(f, list);
    }
    for (const o of b.outcomes ?? []) {
      const list = establishedBy.get(o.setsFlag) ?? [];
      list.push(b);
      establishedBy.set(o.setsFlag, list);
    }
  }

  const beatById = new Map(beats.map(b => [b.id, b]));
  const deps = new Map<string, Set<string>>(); // beatId → beatIds, от которых зависит
  for (const b of beats) {
    const flags = guardFlags(b.guard);
    const depSet = new Set<string>();
    for (const f of flags) {
      const sources = establishedBy.get(f);
      if (!sources || sources.length === 0) {
        issues.push({
          severity: 'error',
          scope: `beats/${b.id}/requires`,
          message: `бит "${b.id}" требует флаг "${f}", который не устанавливает ни один бит`,
        });
        continue;
      }
      for (const src of sources) {
        if (src.id !== b.id) depSet.add(src.id);
        // Требующий бит должен успевать ПОСЛЕ устанавливающего.
        if (src.window.fromSlot > b.window.toSlot) {
          issues.push({
            severity: 'error',
            scope: `beats/${b.id}/requires`,
            message: `бит "${b.id}" (окно до ${b.window.toSlot}) требует флаг "${f}" от бита "${src.id}", который начинается позже (${src.window.fromSlot})`,
          });
        }
      }
    }
    deps.set(b.id, depSet);
  }

  // Ацикличность графа флаговых зависимостей (DFS с трёхцветной раскраской).
  const color = new Map<string, 0 | 1 | 2>();
  const hasCycle = (id: string): boolean => {
    const c = color.get(id) ?? 0;
    if (c === 1) return true;
    if (c === 2) return false;
    color.set(id, 1);
    for (const dep of deps.get(id) ?? []) {
      if (beatById.has(dep) && hasCycle(dep)) return true;
    }
    color.set(id, 2);
    return false;
  };
  for (const b of beats) {
    if ((color.get(b.id) ?? 0) === 0 && hasCycle(b.id)) {
      issues.push({
        severity: 'error',
        scope: `beats/${b.id}/requires`,
        message: `циклическая флаговая зависимость через бит "${b.id}"`,
      });
      break;
    }
  }

  // Назначаемость: каждому обязательному биту — свой слот внутри окна.
  // Жадный алгоритм по дедлайну оптимален для интервального матчинга
  // единичных задач, так что «не назначилось» = реальная коллизия окон.
  const mandatory = [...beats].sort(
    (a, b) => a.window.toSlot - b.window.toSlot || a.window.fromSlot - b.window.fromSlot,
  );
  const taken = new Set<number>();
  for (const b of mandatory) {
    let placed = -1;
    for (let s = b.window.fromSlot; s <= b.window.toSlot; s++) {
      if (!taken.has(s)) {
        placed = s;
        break;
      }
    }
    if (placed === -1) {
      issues.push({
        severity: 'error',
        scope: `beats/${b.id}/window`,
        message: `биту "${b.id}" не хватает свободного слота в окне [${b.window.fromSlot}, ${b.window.toSlot}] — окна битов пережаты`,
      });
    } else {
      taken.add(placed);
    }
  }

  // Концовки: покрытие профиля брифа, валидность good→liId, известные флаги.
  if (spine.endings.length === 0) {
    issues.push({ severity: 'error', scope: 'endings', message: 'нет ни одной концовки' });
  }
  for (const e of spine.endings) {
    if (!VALID_ENDING_KINDS.has(e.kind)) {
      issues.push({ severity: 'error', scope: `endings/${e.id}`, message: `неизвестный kind "${e.kind}"` });
    }
    if (e.kind === 'good' && (!e.liId || !liIds.has(e.liId))) {
      issues.push({
        severity: 'error',
        scope: `endings/${e.id}`,
        message: `good-концовка "${e.id}" должна ссылаться на существующего LI, получено "${e.liId}"`,
      });
    }
    for (const f of guardFlags(e.guard)) {
      if (!establishedBy.has(f)) {
        issues.push({
          severity: 'error',
          scope: `endings/${e.id}`,
          message: `концовка "${e.id}" требует флаг "${f}", который не устанавливает ни один бит`,
        });
      }
    }
  }
  for (const kind of brief.endingsProfile) {
    if (!spine.endings.some(e => e.kind === kind)) {
      issues.push({
        severity: 'warning',
        scope: 'endings',
        message: `в профиле брифа есть концовка "${kind}", но хребет её не предлагает`,
      });
    }
  }

  // ── Feasibility листьев веток (фаза 5) ─────────────────────────────────
  // Перебор всех комбинаций исходов развилок (лист = по одному исходу на
  // развилку; ≤3 × ≤3 = ≤27). Симуляция установления флагов: флаг доступен
  // со слота установителя (бит — в назначенный assignBeatSlots слот); флаги
  // НЕвыбранных исходов недоступны никогда; бит играется, если каждый его
  // guard-флаг доступен не позже конца окна бита; итерация до фикспойнта.
  const enumerableBps = branchPoints.filter(bp => {
    const n = bp.outcomes?.length ?? 0;
    return n >= 2 && n <= 3;
  });
  if (finale && enumerableBps.length > 0 && enumerableBps.length <= 3) {
    const outcomeFlags = new Set<string>();
    for (const bp of enumerableBps) for (const o of bp.outcomes ?? []) outcomeFlags.add(o.setsFlag);
    const playedUnion = new Set<string>();

    for (const { label: leafLabel, assignment } of enumerateLeafAssignments(spine)) {
      const { played, earliest } = playableBeatsForLeaf(spine, calendar, assignment);
      for (const id of played) playedUnion.add(id);

      if (!played.has(finale.id)) {
        issues.push({
          severity: 'error',
          scope: `beats/${finale.id}/reachability`,
          message: `лист [${leafLabel}] не достигает финала "${finale.id}" — его requires невыполнимы на этой ветке`,
        });
      }

      const satisfiable = spine.endings.some(e => guardFlags(e.guard).every(f => earliest.has(f)));
      if (spine.endings.length > 0 && !satisfiable) {
        const detail = spine.endings
          .map(
            e =>
              `"${e.id}" требует [${guardFlags(e.guard)
                .filter(f => !earliest.has(f))
                .join(', ')}]`,
          )
          .join('; ');
        issues.push({
          severity: 'error',
          scope: 'endings',
          message: `лист [${leafLabel}] не имеет достижимой концовки: ${detail}`,
        });
      }
    }

    // Мёртвый контент: ветвовой бит (guard требует флаг исхода), не сыгранный
    // ни при одной комбинации исходов.
    for (const b of beats) {
      if (playedUnion.has(b.id)) continue;
      if (!guardFlags(b.guard).some(f => outcomeFlags.has(f))) continue;
      issues.push({
        severity: 'warning',
        scope: `beats/${b.id}/reachability`,
        message: `ветвовой бит "${b.id}" недостижим ни при одной комбинации исходов развилок — мёртвый контент`,
      });
    }
  }

  // Каждый LI участвует хотя бы в паре битов (арки завершимы — грубая проверка).
  for (const li of brief.loveInterests) {
    const count = beats.filter(b => b.participants.includes(li.id)).length;
    if (count < 2) {
      issues.push({
        severity: 'warning',
        scope: `coverage/${li.id}`,
        message: `LI "${li.id}" участвует лишь в ${count} битах — арка может не читаться`,
      });
    }
  }

  return issues;
}
