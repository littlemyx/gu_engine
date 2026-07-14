import type {
  AnchorEdge,
  Brief,
  OutlineAct,
  StoryAnchor,
  StoryAnchorType,
  StoryOutlinePlan,
  WorldModel,
} from './types';
import type { Calendar, CharacterSchedule, SpineBeat, SpinePlan } from './calendarTypes';
import { slotLabel } from './calendarTypes';
import { assignBeatSlots } from './beatSchedule';
import { guardFlags } from './validateSpine';

/**
 * Legacy-адаптер календарной модели (фаза 1 плана calendar-branching).
 *
 * Новый источник истины — SpinePlan + Calendar + CharacterSchedule, но
 * компилятор игры (compileWorldGameProject) по-прежнему ест легаси
 * StoryOutlinePlan (DAG якорей) + WorldModel.anchorLocations. Адаптер
 * детерминированно выводит валидный легаси-outline из новой модели, чтобы
 * экспорт работал до нового компилятора фазы 2.
 *
 * Контракт: для валидного хребта (validateSpine без ошибок) производный
 * outline проходит validateStoryOutline без ошибок (warnings допустимы —
 * бюджеты outline к календарной модели неприменимы).
 */

/** Флаги, которые бит делает истинными: establishes + setsFlag исходов развилки. */
function establishedFlags(beat: SpineBeat): string[] {
  return [...beat.establishes, ...(beat.outcomes ?? []).map(o => o.setsFlag)];
}

export function deriveLegacyOutline(
  spine: SpinePlan,
  calendar: Calendar,
  schedule: CharacterSchedule | null,
  brief: Brief,
  worldModel: WorldModel | null,
): { outline: StoryOutlinePlan; anchorLocations: Record<string, string> } {
  // Биты в порядке назначенных слотов; без слота — пропускаем (validateSpine
  // репортит пережатые окна как error ещё до адаптера).
  const assigned = assignBeatSlots(spine, calendar);
  const ordered = spine.beats.filter(b => assigned[b.id] != null).sort((a, b) => assigned[a.id] - assigned[b.id]);

  // ── Роли якорей ──────────────────────────────────────────────────────────
  // setup — бит с минимальным слотом (старт игры, без входящих рёбер).
  const setupId = ordered.length > 0 ? ordered[0].id : null;

  // resolution — finale (последний по слоту, если их аномально несколько),
  // иначе последний бит. Если финал совпал с первым битом, хребет сломан —
  // возвращаем как есть, setup побеждает, validateStoryOutline отрепортит.
  const finales = ordered.filter(b => b.kind === 'finale');
  const resolutionCandidate = finales.length > 0 ? finales[finales.length - 1] : ordered[ordered.length - 1];
  const resolutionId = resolutionCandidate && resolutionCandidate.id !== setupId ? resolutionCandidate.id : null;

  // climax — бит с максимальным слотом в предпоследнем-или-позже акте, не
  // setup/resolution. actGate-биты уже заявлены под location_enter, поэтому
  // предпочитаем обычные биты и берём actGate только если других нет.
  const isFixed = (id: string) => id === setupId || id === resolutionId;
  const lateCandidates = ordered.filter(b => b.act >= brief.scale.acts - 1 && !isFixed(b.id) && b.kind !== 'finale');
  const nonGateCandidates = lateCandidates.filter(b => b.kind !== 'actGate');
  const climaxPool = nonGateCandidates.length > 0 ? nonGateCandidates : lateCandidates;
  let climaxId: string | null = climaxPool.length > 0 ? climaxPool[climaxPool.length - 1].id : null;
  if (climaxId === null && ordered.length > 2 && resolutionId !== null) {
    // Fallback: продвигаем бит прямо перед финалом. При двух битах (только
    // setup + finale) кандидата нет — пусть validateStoryOutline репортит.
    const resIndex = ordered.findIndex(b => b.id === resolutionId);
    const prev = resIndex > 0 ? ordered[resIndex - 1] : null;
    if (prev && !isFixed(prev.id)) climaxId = prev.id;
  }

  const typeOf = (b: SpineBeat): StoryAnchorType => {
    if (b.id === setupId) return 'setup';
    if (b.id === resolutionId) return 'resolution';
    if (b.id === climaxId) return 'climax';
    if (b.kind === 'actGate') return 'location_enter';
    return 'story_beat';
  };

  // ── Якоря ────────────────────────────────────────────────────────────────
  const locationNameById = new Map((worldModel?.locations ?? []).map(l => [l.id, l.name]));
  const liIds = new Set(brief.loveInterests.map(li => li.id));

  const anchors: StoryAnchor[] = ordered.map(b => {
    const slot = assigned[b.id];
    // availableLIs = участники бита (только реальные id LI, $-плейсхолдеры
    // ролей резолвятся позже) ∪ LI, стоящие по расписанию в локации бита.
    const lis = new Set<string>();
    for (const p of b.participants) {
      if (!p.startsWith('$') && liIds.has(p)) lis.add(p);
    }
    if (schedule) {
      for (const li of brief.loveInterests) {
        if (schedule[li.id]?.[slot] === b.locationId) lis.add(li.id);
      }
    }
    return {
      id: b.id,
      type: typeOf(b),
      act: b.act,
      location: locationNameById.get(b.locationId) ?? b.locationId,
      timeMarker: slotLabel(slot, calendar),
      summary: b.summary,
      establishes: b.establishes,
      availableLIs: [...lis],
    };
  });

  // ── Рёбра ────────────────────────────────────────────────────────────────
  // Только вперёд по слотам и без петель — DAG по построению; монотонность
  // актов следует из соответствия окон битов слотам актов (validateSpine).
  const anchorEdges: AnchorEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (from: string, to: string): void => {
    if (from === to) return;
    const key = `${from}->${to}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    anchorEdges.push({ from, to });
  };

  // (a) Цепочка последовательных битов в порядке слотов.
  for (let i = 1; i < ordered.length; i++) {
    addEdge(ordered[i - 1].id, ordered[i].id);
  }

  // (b) Флаговые зависимости: требующий флаг F бит получает ребро от каждого
  // устанавливающего F бита с меньшим слотом.
  const establishedBy = new Map<string, SpineBeat[]>();
  for (const b of ordered) {
    for (const f of establishedFlags(b)) {
      const list = establishedBy.get(f) ?? [];
      list.push(b);
      establishedBy.set(f, list);
    }
  }
  for (const b of ordered) {
    for (const f of guardFlags(b.guard)) {
      for (const src of establishedBy.get(f) ?? []) {
        if (assigned[src.id] < assigned[b.id]) addEdge(src.id, b.id);
      }
    }
  }

  // ── Акты и привязка локаций ──────────────────────────────────────────────
  const acts: OutlineAct[] = Array.from({ length: brief.scale.acts }, (_, i) => ({
    act: i + 1,
    purpose: '',
    tone: '',
  }));

  // anchorLocations хранит ID локации (пространственный контракт компилятора),
  // тогда как anchor.location — человекочитаемое имя.
  const anchorLocations: Record<string, string> = {};
  for (const b of ordered) anchorLocations[b.id] = b.locationId;

  return {
    outline: {
      title: spine.title,
      logline: spine.logline,
      acts,
      anchors,
      anchorEdges,
    },
    anchorLocations,
  };
}
