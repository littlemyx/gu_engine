import { create } from 'zustand';
import type { GeneratedSegment, OutlinePlan } from './types';

/**
 * Стор для procedural-narrative-пилота.
 *
 * Хранит:
 *   - текущий сгенерированный outline (если есть)
 *   - кэш сгенерированных сегментов (key = `${fromId}->${toId}`)
 *
 * Сегменты намеренно не персистируются между сессиями — outline-id может
 * меняться при перегенерации, и кэш быстро устаревает. По мере доработки
 * можно добавить persist+migration, если будет нужно.
 */

const segmentKey = (fromId: string, toId: string) => `${fromId}->${toId}`;

type NarrativeState = {
  outline: OutlinePlan | null;
  segments: Record<string, GeneratedSegment>;

  setOutline: (outline: OutlinePlan | null) => void;
  setSegment: (fromId: string, toId: string, segment: GeneratedSegment) => void;
  clearSegments: () => void;

  getSegment: (fromId: string, toId: string) => GeneratedSegment | undefined;
};

export const useNarrativeStore = create<NarrativeState>((set, get) => ({
  outline: null,
  segments: {},

  setOutline: outline => {
    // При установке нового outline сбрасываем сегменты — id-якорей могут
    // больше не совпадать с тем, что мы накэшировали раньше.
    set({ outline, segments: {} });
  },

  setSegment: (fromId, toId, segment) => {
    set(s => ({ segments: { ...s.segments, [segmentKey(fromId, toId)]: segment } }));
  },

  clearSegments: () => set({ segments: {} }),

  getSegment: (fromId, toId) => get().segments[segmentKey(fromId, toId)],
}));
