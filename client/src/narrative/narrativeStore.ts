import { create } from 'zustand';
import type { GeneratedSegment, OutlinePlan } from './types';

/**
 * Стор для procedural-narrative-пилота.
 *
 * Хранит:
 *   - текущий сгенерированный outline (если есть)
 *   - кэш сгенерированных сегментов (key = `${fromId}->${toId}`)
 *   - кэш сгенерированных background-картинок (key = anchorId)
 *
 * Ничего не персистируется между сессиями — outline-id может меняться при
 * перегенерации, кэш быстро устаревает. Persist можно добавить позже, по
 * outline-fingerprint.
 */

const segmentKey = (fromId: string, toId: string) => `${fromId}->${toId}`;

export type ImageGenState =
  | { status: 'pending' }
  | { status: 'generating'; batchId: string }
  | { status: 'done'; filename: string }
  | { status: 'failed'; error: string };

type NarrativeState = {
  outline: OutlinePlan | null;
  segments: Record<string, GeneratedSegment>;
  /**
   * Картинки фонов, сгенерированные image_gen-сервисом.
   * Ключ — anchorId. Значение содержит filename (без URL-префикса);
   * convertToGameProject строит полный URL под IMAGE_SERVER_BASE.
   */
  images: Record<string, ImageGenState>;

  setOutline: (outline: OutlinePlan | null) => void;
  setSegment: (fromId: string, toId: string, segment: GeneratedSegment) => void;
  clearSegments: () => void;
  setImage: (anchorId: string, state: ImageGenState) => void;
  clearImages: () => void;

  getSegment: (fromId: string, toId: string) => GeneratedSegment | undefined;
};

export const useNarrativeStore = create<NarrativeState>((set, get) => ({
  outline: null,
  segments: {},
  images: {},

  setOutline: outline => {
    // При установке нового outline сбрасываем все downstream-кэши — id-якорей
    // могли поменяться при перегенерации.
    set({ outline, segments: {}, images: {} });
  },

  setSegment: (fromId, toId, segment) => {
    set(s => ({ segments: { ...s.segments, [segmentKey(fromId, toId)]: segment } }));
  },

  clearSegments: () => set({ segments: {} }),

  setImage: (anchorId, state) => {
    set(s => ({ images: { ...s.images, [anchorId]: state } }));
  },

  clearImages: () => set({ images: {} }),

  getSegment: (fromId, toId) => get().segments[segmentKey(fromId, toId)],
}));
