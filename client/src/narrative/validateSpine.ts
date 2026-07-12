import type { Brief, SegmentIssue, WorldModel } from './types';
import type { Calendar, SpineBeat, SpinePlan } from './calendarTypes';
import { actSlotWindow } from './calendarTypes';
import type { Guard } from './events';

/**
 * Структурная валидация хребта (SpinePlan) против календаря и мира.
 *
 * Фаза 1 — только структура: id, окна, акты, флаговые зависимости,
 * назначаемость обязательных битов на слоты. Семантическая feasibility
 * (достижимость листьев веток, выполнимость концовок по состоянию) —
 * этап story QA; ужесточается вместе с развилками в фазе 5.
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
