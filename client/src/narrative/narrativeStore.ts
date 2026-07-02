import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AnchorBeat,
  BeatPlan,
  GeneratedSegment,
  OutlinePlan,
  StoryOutlinePlan,
  NarrationWeb,
  DialogueVariant,
} from './types';

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
const encounterKey = (anchorId: string, liId: string) => `${anchorId}:${liId}`;

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

  storyOutline: StoryOutlinePlan | null;
  narrationWebs: Record<string, NarrationWeb>;
  dialogueVariants: Record<string, DialogueVariant[]>;
  /** Beat-сцены якорей (событие на экране + подписи переходов). Ключ — anchorId. */
  anchorBeats: Record<string, AnchorBeat>;
  /** План битов отношений (какая встреча какой бит арки реализует). */
  beatPlan: BeatPlan | null;

  setOutline: (outline: OutlinePlan | null) => void;
  setSegment: (fromId: string, toId: string, segment: GeneratedSegment) => void;
  clearSegments: () => void;
  setImage: (anchorId: string, state: ImageGenState) => void;
  clearImages: () => void;
  setCharacter: (liId: string, state: CharacterGenState) => void;
  updateCharacterPose: (liId: string, pose: string, filename: string) => void;
  clearCharacters: () => void;

  setStoryOutline: (outline: StoryOutlinePlan | null) => void;
  setNarrationWeb: (fromId: string, toId: string, web: NarrationWeb) => void;
  clearNarrationWebs: () => void;
  setDialogueVariants: (anchorId: string, liId: string, variants: DialogueVariant[]) => void;
  clearDialogueVariants: () => void;
  setAnchorBeat: (anchorId: string, beat: AnchorBeat) => void;
  clearAnchorBeats: () => void;
  setBeatPlan: (plan: BeatPlan | null) => void;

  getSegment: (fromId: string, toId: string) => GeneratedSegment | undefined;
  getNarrationWeb: (fromId: string, toId: string) => NarrationWeb | undefined;
  getDialogueVariants: (anchorId: string, liId: string) => DialogueVariant[] | undefined;
  getAnchorBeat: (anchorId: string) => AnchorBeat | undefined;
};

type PersistedNarrativeState = Pick<
  NarrativeState,
  | 'outline'
  | 'segments'
  | 'images'
  | 'characters'
  | 'storyOutline'
  | 'narrationWebs'
  | 'dialogueVariants'
  | 'anchorBeats'
  | 'beatPlan'
>;

export const useNarrativeStore = create<NarrativeState>()(
  persist(
    (set, get) => ({
      outline: null,
      segments: {},
      images: {},
      characters: {},
      storyOutline: null,
      narrationWebs: {},
      dialogueVariants: {},
      anchorBeats: {},
      beatPlan: null,

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

      setStoryOutline: storyOutline => {
        set({ storyOutline, narrationWebs: {}, dialogueVariants: {}, anchorBeats: {}, beatPlan: null });
      },

      setNarrationWeb: (fromId, toId, web) => {
        set(s => ({ narrationWebs: { ...s.narrationWebs, [segmentKey(fromId, toId)]: web } }));
      },

      clearNarrationWebs: () => set({ narrationWebs: {}, dialogueVariants: {} }),

      setDialogueVariants: (anchorId, liId, variants) => {
        set(s => ({ dialogueVariants: { ...s.dialogueVariants, [encounterKey(anchorId, liId)]: variants } }));
      },

      clearDialogueVariants: () => set({ dialogueVariants: {} }),

      setAnchorBeat: (anchorId, beat) => {
        set(s => ({ anchorBeats: { ...s.anchorBeats, [anchorId]: beat } }));
      },

      clearAnchorBeats: () => set({ anchorBeats: {} }),

      setBeatPlan: beatPlan => set({ beatPlan }),

      getSegment: (fromId, toId) => get().segments[segmentKey(fromId, toId)],

      getNarrationWeb: (fromId, toId) => get().narrationWebs[segmentKey(fromId, toId)],

      getDialogueVariants: (anchorId, liId) => get().dialogueVariants[encounterKey(anchorId, liId)],

      getAnchorBeat: anchorId => get().anchorBeats[anchorId],
    }),
    {
      name: 'gu-narrative-state',
      version: 4,
      // Персистим только данные, не действия.
      partialize: state => ({
        outline: state.outline,
        segments: state.segments,
        images: state.images,
        characters: state.characters,
        storyOutline: state.storyOutline,
        narrationWebs: state.narrationWebs,
        dialogueVariants: state.dialogueVariants,
        anchorBeats: state.anchorBeats,
        beatPlan: state.beatPlan,
      }),
      // Без migrate zustand выбрасывает состояние при несовпадении версии —
      // дорогие кэши генерации должны переживать апгрейд схемы.
      migrate: persisted => {
        // Старые версии не имели полей anchorBeats/beatPlan — дозаполняем
        // дефолтами, не трогая накопленные кэши генерации.
        const prev = (persisted ?? {}) as Partial<PersistedNarrativeState>;
        return {
          outline: prev.outline ?? null,
          segments: prev.segments ?? {},
          images: prev.images ?? {},
          characters: prev.characters ?? {},
          storyOutline: prev.storyOutline ?? null,
          narrationWebs: prev.narrationWebs ?? {},
          dialogueVariants: prev.dialogueVariants ?? {},
          anchorBeats: prev.anchorBeats ?? {},
          beatPlan: prev.beatPlan ?? null,
        };
      },
    },
  ),
);
