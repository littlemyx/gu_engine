/**
 * Effect — атомарный патч состояния. Единственный способ что-либо изменить:
 * ни guard, ни рендер, ни LLM состояние не трогают (железное правило
 * нейросимволической схемы — структуру держит символическое ядро).
 */

import { DEFAULT_RELATIONSHIP, type CharacterId, type FlagId, type LocationId, type RelationshipState, type SliceState } from './state';

export type Effect =
  | { rel: { char: CharacterId; var: string; delta: number; clamp?: [number, number] } }
  | { setFlag: FlagId }
  | { move: { char: CharacterId; to: LocationId } }
  | { unlock: { eventId: string } };

export function applyEffect(effect: Effect, state: SliceState): void {
  if ('rel' in effect) {
    const { char, var: varName, delta, clamp } = effect.rel;
    const rel: RelationshipState = state.relationships[char] ?? { ...DEFAULT_RELATIONSHIP };
    const core = rel as unknown as Record<string, number>;
    if (varName === 'affection' || varName === 'trust' || varName === 'tension') {
      let next = (core[varName] ?? 0) + delta;
      if (clamp) next = Math.max(clamp[0], Math.min(clamp[1], next));
      core[varName] = next;
    } else {
      const vars = { ...(rel.vars ?? {}) };
      let next = (vars[varName] ?? 0) + delta;
      if (clamp) next = Math.max(clamp[0], Math.min(clamp[1], next));
      vars[varName] = next;
      rel.vars = vars;
    }
    state.relationships[char] = rel;
    return;
  }
  if ('setFlag' in effect) {
    state.flags.add(effect.setFlag);
    return;
  }
  if ('move' in effect) {
    state.positions[effect.move.char] = effect.move.to;
    return;
  }
  if ('unlock' in effect) {
    state.unlocked.add(effect.unlock.eventId);
  }
}

export function formatEffect(effect: Effect): string {
  if ('rel' in effect) {
    const sign = effect.rel.delta >= 0 ? '+' : '−';
    return `rel(${effect.rel.char}, ${effect.rel.var}, ${sign}${Math.abs(effect.rel.delta)})`;
  }
  if ('setFlag' in effect) return `setFlag(${effect.setFlag})`;
  if ('move' in effect) return `move(${effect.move.char} → ${effect.move.to})`;
  if ('unlock' in effect) return `unlock(${effect.unlock.eventId})`;
  return '?';
}
