/**
 * Оценка среза: generation-time исполнитель модели событий.
 *
 * Рантайм играет тот же пул через режиссёра (director.ts) — покадрово, с
 * салиенс-выбором. Здесь же срез фиксируется целиком и детерминированно:
 * это нужно достижимости (reachability), цепочке битов и валидации, где
 * «что вообще может случиться» важнее, чем «что покажем игроку».
 */

import { applyEffect, type Effect } from './effects';
import { evalGuard, type Guard } from './guards';
import {
  DEFAULT_RELATIONSHIP,
  type CharacterId,
  type EventContext,
  type EventHistory,
  type LocationId,
  type PhaseWindow,
  type SliceState,
  type SlotWindow,
  type TimeSlice,
} from './state';

export type EventKind = 'dialogue' | 'move_out' | 'move_in' | 'ambient' | 'state_change';

/** Ссылка на сцену события в существующем пайплайне. null = триггер без сцены. */
export type SceneRef = { kind: 'dialogue'; anchorId: string; liId: string } | { kind: 'beat'; anchorId: string };

export type EventDef = {
  id: string;
  kind: EventKind;
  /**
   * Маска привязки к y/z: событие рассматривается только в подходящем срезе.
   * `phase` — окно восприимчивости внутри части дня (нет → фаза любая).
   */
  at: { anchorId?: string; locationId?: LocationId; slot?: SlotWindow; phase?: PhaseWindow };
  participants: CharacterId[];
  /** «Если» — чистый предикат над EventContext. */
  guard: Guard;
  /** «Эффект» — атомарные патчи состояния. */
  effects: Effect[];
  scene?: SceneRef | null;
  /** Порядок оценки внутри среза; меньше = раньше. */
  priority: number;
  /** Заблокировано до unlock-эффекта другого события. */
  locked?: boolean;
};

/** Событие попадает в срез, если его at-маска совпадает с z (и локацией среза). */
export function matchesSlice(def: EventDef, slice: TimeSlice, sliceLocationId?: string | null): boolean {
  if (def.at.anchorId && def.at.anchorId !== slice.anchorId) return false;
  if (def.at.slot) {
    const current = slice.slot ?? slice.z;
    if (current < def.at.slot.fromSlot || current > def.at.slot.toSlot) return false;
  }
  // Малая стрелка: окна фаз нет → событие фаза-агностично (биты хребта).
  if (def.at.phase) {
    const phase = slice.phase ?? 0;
    if (phase < def.at.phase.fromPhase || phase > def.at.phase.toPhase) return false;
  }
  if (def.at.locationId && !def.at.anchorId && def.at.locationId !== sliceLocationId) return false;
  return true;
}

export type SliceEvaluation = {
  /** Сработавшие в этом срезе события в порядке срабатывания. */
  fired: EventDef[];
  /** Очередь сцен сработавших событий. */
  scenes: SceneRef[];
  /** Состояние после фиксации среза (тот же объект state — мутируется). */
  state: SliceState;
  /** Проходов потрачено (диагностика лимита каскадов). */
  passes: number;
};

const MAX_PASSES = 3;

/**
 * Оценка среза z по спеке §3: события сортируются по (priority, id),
 * оцениваются до 3 проходов; каждое срабатывание атомарно применяет effects
 * и пишется в H.fired, так что последующие guard-ы того же среза видят
 * кумулятив («Кира уходит, если героиня выбрала Юки»).
 *
 * События, уже присутствующие в state.fired (из прошлых срезов), повторно
 * не срабатывают: событие одноразово по построению лога.
 */
export function evaluateSlice(
  defs: EventDef[],
  slice: TimeSlice,
  state: SliceState,
  sliceLocationId?: string | null,
): SliceEvaluation {
  const candidates = defs
    .filter(d => matchesSlice(d, slice, sliceLocationId))
    .sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const firedIds = new Set(state.fired.map(f => f.eventId));
  const fired: EventDef[] = [];
  const scenes: SceneRef[] = [];

  const history: EventHistory = { flags: state.flags, fired: state.fired };
  const contextFor = (def: EventDef): EventContext => {
    const x = def.participants[0] ?? '';
    return {
      x,
      y: state.positions[x] ?? def.at.locationId ?? '',
      z: slice,
      R: state.relationships[x] ?? DEFAULT_RELATIONSHIP,
      H: history,
    };
  };

  let passes = 0;
  for (; passes < MAX_PASSES; passes++) {
    let firedThisPass = false;
    for (const def of candidates) {
      if (firedIds.has(def.id)) continue;
      if (def.locked && !state.unlocked.has(def.id)) continue;
      if (!evalGuard(def.guard, contextFor(def), state)) continue;
      for (const effect of def.effects) applyEffect(effect, state);
      state.fired.push({ eventId: def.id, z: slice.z });
      firedIds.add(def.id);
      fired.push(def);
      if (def.scene) scenes.push(def.scene);
      firedThisPass = true;
    }
    if (!firedThisPass) break;
  }

  return { fired, scenes, state, passes };
}
