import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GeneratedSegment, OutlinePlan } from './types';

/**
 * Стор для procedural-narrative-пилота.
 *
 * Хранит:
 *   - текущий сгенерированный outline (если есть)
 *   - кэш сгенерированных сегментов (key = `${fromId}->${toId}`)
 *   - кэш сгенерированных background-картинок (key = anchorId)
 *   - кэш сгенерированных character-спрайтов (key = liId)
 *
 * Персистится в localStorage: outline стоит ~1 LLM-вызов и десятки секунд,
 * сегменты — десятки LLM-вызовов и до 10 минут, картинки — 3-5 минут на
 * полный outline. Терять при reload контрпродуктивно.
 *
 * Invalidation: setOutline сбрасывает segments и images, потому что id
 * якорей могут не совпадать с прежними. Чтобы переиспользовать кэш при
 * незначительных правках брифа, в будущем можно ввести persist по
 * outline-fingerprint и сравнивать новые/старые id.
 *
 * Размер: ~28 якорей × ~5 KB сегмента + ~70 байт URL фона ≈ 150 KB.
 * localStorage спокойно вмещает.
 */

const segmentKey = (fromId: string, toId: string) => `${fromId}->${toId}`;

export type ImageGenState =
  | { status: 'pending' }
  | { status: 'generating'; batchId: string }
  | { status: 'done'; filename: string }
  | { status: 'failed'; error: string };

/**
 * Стейт генерации одного персонажа. В MVP — только idle-поза.
 * filename содержит имя файла на image_server (без URL-префикса).
 */
export type CharacterGenState =
  | { status: 'pending' }
  | { status: 'generating'; batchId: string }
  | { status: 'done'; idleFilename: string; poseFilenames?: Record<string, string> }
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
  /**
   * Спрайты персонажей. Ключ — id LI из брифа. Не сбрасывается при
   * setOutline (LI не меняются), но сбрасывается явно если пользователь
   * меняет каст в брифе. Простая стратегия инвалидации: clearCharacters.
   */
  characters: Record<string, CharacterGenState>;

  setOutline: (outline: OutlinePlan | null) => void;
  setSegment: (fromId: string, toId: string, segment: GeneratedSegment) => void;
  clearSegments: () => void;
  setImage: (anchorId: string, state: ImageGenState) => void;
  clearImages: () => void;
  setCharacter: (liId: string, state: CharacterGenState) => void;
  updateCharacterPose: (liId: string, pose: string, filename: string) => void;
  clearCharacters: () => void;

  getSegment: (fromId: string, toId: string) => GeneratedSegment | undefined;
};

export const useNarrativeStore = create<NarrativeState>()(
  persist(
    (set, get) => ({
      outline: null,
      segments: {},
      images: {},
      characters: {},

      setOutline: outline => {
        // При установке нового outline сбрасываем outline-зависимые кэши:
        // segments и backgrounds. characters не трогаем — LI принадлежат
        // брифу, а бриф не меняется при regenerate-outline.
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

      setCharacter: (liId, state) => {
        set(s => ({ characters: { ...s.characters, [liId]: state } }));
      },

      updateCharacterPose: (liId, pose, filename) => {
        set(s => {
          const prev = s.characters[liId];
          if (prev?.status !== 'done') return s;
          return {
            characters: {
              ...s.characters,
              [liId]: { ...prev, poseFilenames: { ...prev.poseFilenames, [pose]: filename } },
            },
          };
        });
      },

      clearCharacters: () => set({ characters: {} }),

      getSegment: (fromId, toId) => get().segments[segmentKey(fromId, toId)],
    }),
    {
      name: 'gu-narrative-state',
      version: 2,
      // Персистим только данные, не действия.
      partialize: state => ({
        outline: state.outline,
        segments: state.segments,
        images: state.images,
        characters: state.characters,
      }),
    },
  ),
);
