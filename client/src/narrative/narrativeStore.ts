import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AnchorBeat,
  BeatPlan,
  EndingVariant,
  WorldModel,
  WorldLocation,
  GeneratedSegment,
  OutlinePlan,
  StoryOutlinePlan,
  NarrationWeb,
  DialogueVariant,
} from './types';
import { DEFAULT_LOCATION_MOOD, isLocationMood, isSpecialAmbientKind } from './types';

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

/**
 * Стейт генерации одного аудио-трека (Suno всегда отдаёт 2 варианта;
 * selected — индекс выбранного). filenames — имена на audio_server.
 */
export type AudioTrackState =
  | { status: 'pending' }
  | { status: 'generating'; batchId: string }
  | { status: 'done'; filenames: string[]; selected: number }
  | { status: 'failed'; error: string };

export type AudioVariationTone = 'positive' | 'negative';

export type LiAudioState = Partial<Record<AudioVariationTone, AudioTrackState>>;

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
  /** Эпилоги. Ключ: good:<liId> | normal | bad (см. endingKey). */
  endings: Record<string, EndingVariant>;
  /** Модель мира: реестр локаций со связностью + маппинг якорей. */
  worldModel: WorldModel | null;

  /** Базовая/фолбэк-подложка проекта (neutral_calm, инструментал). */
  audioBase: AudioTrackState | null;
  /**
   * Банк эмбиент-бедов по настроению локации (LocationMood → трек). neutral_calm
   * живёт в audioBase; здесь — остальные реально используемые настроения.
   */
  audioMoodBeds: Record<string, AudioTrackState>;
  /** Диегетические беды особых локаций (SpecialAmbientKind → трек). */
  audioSpecialBeds: Record<string, AudioTrackState>;
  /** Вариации per-LI, раздельно по тонам. Ключ — id LI из брифа. */
  audioByLi: Record<string, LiAudioState>;
  /** SFX по каноническим эмоциям: emotion → filename на audio_server. */
  audioSfx: Record<string, string>;
  /** Стейт генерации SFX-набора (результаты пишутся в audioSfx). */
  audioSfxState: AudioTrackState | null;

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
  setEnding: (key: string, ending: EndingVariant) => void;
  clearEndings: () => void;
  setWorldModel: (world: WorldModel | null) => void;
  /** Гранулярная правка настроения/спец-типа локации (авторский оверрайд). */
  patchLocation: (id: string, patch: Partial<Pick<WorldLocation, 'mood' | 'specialKind'>>) => void;

  setAudioBase: (state: AudioTrackState | null) => void;
  selectAudioBase: (index: number) => void;
  setAudioMoodBed: (mood: string, state: AudioTrackState) => void;
  selectAudioMoodBed: (mood: string, index: number) => void;
  setAudioSpecialBed: (kind: string, state: AudioTrackState) => void;
  selectAudioSpecialBed: (kind: string, index: number) => void;
  setAudioVariation: (liId: string, tone: AudioVariationTone, state: AudioTrackState) => void;
  selectAudioVariation: (liId: string, tone: AudioVariationTone, index: number) => void;
  setAudioSfx: (emotion: string, filename: string) => void;
  setAudioSfxState: (state: AudioTrackState | null) => void;
  clearAudio: () => void;

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
  | 'endings'
  | 'worldModel'
  | 'audioBase'
  | 'audioMoodBeds'
  | 'audioSpecialBeds'
  | 'audioByLi'
  | 'audioSfx'
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
      endings: {},
      worldModel: null,
      audioBase: null,
      audioMoodBeds: {},
      audioSpecialBeds: {},
      audioByLi: {},
      audioSfx: {},
      audioSfxState: null,

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
        set({
          storyOutline,
          narrationWebs: {},
          dialogueVariants: {},
          anchorBeats: {},
          beatPlan: null,
          endings: {},
          worldModel: null,
        });
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

      setEnding: (key, ending) => {
        set(s => ({ endings: { ...s.endings, [key]: ending } }));
      },

      clearEndings: () => set({ endings: {} }),

      setWorldModel: worldModel => set({ worldModel }),

      patchLocation: (id, patch) => {
        set(s => {
          if (!s.worldModel) return s;
          return {
            worldModel: {
              ...s.worldModel,
              locations: s.worldModel.locations.map(l => (l.id === id ? { ...l, ...patch } : l)),
            },
          };
        });
      },

      setAudioBase: state => set({ audioBase: state }),

      selectAudioBase: index => {
        set(s => {
          if (s.audioBase?.status !== 'done') return s;
          return { audioBase: { ...s.audioBase, selected: index } };
        });
      },

      setAudioMoodBed: (mood, state) => {
        set(s => ({ audioMoodBeds: { ...s.audioMoodBeds, [mood]: state } }));
      },

      selectAudioMoodBed: (mood, index) => {
        set(s => {
          const track = s.audioMoodBeds[mood];
          if (track?.status !== 'done') return s;
          return { audioMoodBeds: { ...s.audioMoodBeds, [mood]: { ...track, selected: index } } };
        });
      },

      setAudioSpecialBed: (kind, state) => {
        set(s => ({ audioSpecialBeds: { ...s.audioSpecialBeds, [kind]: state } }));
      },

      selectAudioSpecialBed: (kind, index) => {
        set(s => {
          const track = s.audioSpecialBeds[kind];
          if (track?.status !== 'done') return s;
          return { audioSpecialBeds: { ...s.audioSpecialBeds, [kind]: { ...track, selected: index } } };
        });
      },

      setAudioVariation: (liId, tone, state) => {
        set(s => ({
          audioByLi: { ...s.audioByLi, [liId]: { ...s.audioByLi[liId], [tone]: state } },
        }));
      },

      selectAudioVariation: (liId, tone, index) => {
        set(s => {
          const track = s.audioByLi[liId]?.[tone];
          if (track?.status !== 'done') return s;
          return {
            audioByLi: {
              ...s.audioByLi,
              [liId]: { ...s.audioByLi[liId], [tone]: { ...track, selected: index } },
            },
          };
        });
      },

      setAudioSfx: (emotion, filename) => {
        set(s => ({ audioSfx: { ...s.audioSfx, [emotion]: filename } }));
      },

      setAudioSfxState: state => set({ audioSfxState: state }),

      clearAudio: () =>
        set({
          audioBase: null,
          audioMoodBeds: {},
          audioSpecialBeds: {},
          audioByLi: {},
          audioSfx: {},
          audioSfxState: null,
        }),

      getSegment: (fromId, toId) => get().segments[segmentKey(fromId, toId)],

      getNarrationWeb: (fromId, toId) => get().narrationWebs[segmentKey(fromId, toId)],

      getDialogueVariants: (anchorId, liId) => get().dialogueVariants[encounterKey(anchorId, liId)],

      getAnchorBeat: anchorId => get().anchorBeats[anchorId],
    }),
    {
      name: 'gu-narrative-state',
      // v8: у локаций появились mood/specialKind (банк эмбиентов) + audioMoodBeds.
      version: 8,
      // Персистим только данные, не действия. audioSfxState — транзиентный
      // прогресс, не персистится (batchId протухает при рестарте audio_gen).
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
        endings: state.endings,
        worldModel: state.worldModel,
        audioBase: state.audioBase,
        audioMoodBeds: state.audioMoodBeds,
        audioSpecialBeds: state.audioSpecialBeds,
        audioByLi: state.audioByLi,
        audioSfx: state.audioSfx,
      }),
      // Без migrate zustand выбрасывает состояние при несовпадении версии —
      // дорогие кэши генерации должны переживать апгрейд схемы.
      migrate: persisted => {
        // Старые версии не имели части полей — дозаполняем дефолтами,
        // не трогая накопленные кэши генерации.
        const prev = (persisted ?? {}) as Partial<PersistedNarrativeState>;
        // v7→v8: у persisted-локаций нет mood/specialKind. Инжектим дефолты, иначе
        // required-поле mood окажется undefined в рантайме (тип бы соврал).
        const worldModel = prev.worldModel
          ? {
              ...prev.worldModel,
              locations: prev.worldModel.locations.map(l => ({
                ...l,
                mood: isLocationMood(l.mood) ? l.mood : DEFAULT_LOCATION_MOOD,
                specialKind: isSpecialAmbientKind(l.specialKind) ? l.specialKind : null,
              })),
            }
          : null;
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
          endings: prev.endings ?? {},
          worldModel,
          audioBase: prev.audioBase ?? null,
          audioMoodBeds: prev.audioMoodBeds ?? {},
          audioSpecialBeds: prev.audioSpecialBeds ?? {},
          audioByLi: prev.audioByLi ?? {},
          audioSfx: prev.audioSfx ?? {},
        };
      },
    },
  ),
);
