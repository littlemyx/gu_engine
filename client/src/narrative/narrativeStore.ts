import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnchorBeat, EndingVariant, WorldModel, WorldLocation } from './types';
import type { AnchorNarrations, Calendar, CastPlan, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import type { DialogueUnit } from './dialogueUnit';
import type {
  BulkCalendarPhase,
  CalendarDraft,
  CalendarRunState,
  CalendarCascadeStage,
  CalendarPendingBatch,
} from './calendarRunState';
import { buildCommitPatch } from './calendarRunState';
import { reconcileImagesForWorld } from './imageFingerprint';
import type { StoryQAStatus } from './storyQA';
import { migratePersistedNarrativeState, NARRATIVE_STORE_VERSION } from './narrativeMigrations';

/**
 * Стор для procedural-narrative-пилота (календарный пайплайн).
 *
 * Хранит артефакты стадий cast → world+calendar → spine → schedule →
 * eventUnits → unitProse/spineBeatProse → endings, плюс кэши генерации
 * медиа (фоны, спрайты, аудио). Персистится в localStorage: полный прогон
 * стоит десятки LLM-вызовов и минуты ожидания — терять при reload
 * контрпродуктивно.
 */

export type ImageGenState =
  | { status: 'pending' }
  | { status: 'generating'; batchId: string }
  /** locationHash — отпечаток локации, для которой нарисован фон (см. imageFingerprint). */
  | { status: 'done'; filename: string; locationHash?: string }
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
  /**
   * Картинки фонов, сгенерированные image_gen-сервисом.
   * Ключ — loc:<locationId>. Значение содержит filename (без URL-префикса);
   * компилятор строит полный URL под IMAGE_SERVER_BASE.
   */
  images: Record<string, ImageGenState>;
  /**
   * Спрайты персонажей. Ключ — id LI из брифа. Сбрасывается явно, если
   * пользователь меняет каст в брифе (clearCharacters).
   */
  characters: Record<string, CharacterGenState>;

  /** Эпилоги. Ключ: good:<liId> | normal | bad (см. endingKey). */
  endings: Record<string, EndingVariant>;
  /** Модель мира: реестр локаций со связностью + маппинг якорей. */
  worldModel: WorldModel | null;

  // ── Календарный пайплайн (docs/plans/calendar-branching.md) ──────────────
  // Каскад инвалидации: castPlan → (calendar, tagMap) → spine → schedule →
  // eventUnits → unitProse/spineBeatProse → endings.
  /** Проход A1: персоны + цели + weekly-паттерны по тегам локаций. */
  castPlan: CastPlan | null;
  /** Дискретный календарь истории (дни × части дня, границы актов). */
  calendar: Calendar | null;
  /** Маппинг агендных тегов на id локаций WorldModel. */
  tagMap: Record<string, string[]> | null;
  /** Подписи и нарации якорных переходов по индексу части дня. */
  anchorNarrations: AnchorNarrations | null;
  /** Хребет: биты с окнами слотов, развилки, guarded-концовки. */
  spine: SpinePlan | null;
  /** char × slot → locationId|null; детерминированно собирается из агенд. */
  schedule: CharacterSchedule | null;
  /** Пул событий-storylet-ов (шеллы guard+goal+effects). Ключ — unit id. */
  eventUnits: Record<string, EventUnit>;
  /** Проза encounter-юнитов по брекетам (DialogueUnit-графы). Ключ — unit id (enc_<liId>). */
  unitProse: Record<string, DialogueUnit[]>;
  /** Проза битов хребта. Ключ — beat id. */
  spineBeatProse: Record<string, AnchorBeat>;

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

  /**
   * Состояние календарного прогона: черновик нового стека + позиция + живой
   * батч. Пишется только calendarRunner-ом; committed-поля стека меняются
   * из прогона исключительно через commitCalendarRun — обрыв на любой стадии
   * оставляет автора со старой историей.
   */
  calendarRun: CalendarRunState | null;

  /**
   * Последний отчёт Story QA — переживает переходы и reload. Сбрасывается
   * коммитом календарного прогона (новая история → старый отчёт врёт);
   * зависший state='running' после reload санитизирует initNarrative.
   */
  storyQA: StoryQAStatus | null;

  setImage: (locKey: string, state: ImageGenState) => void;
  clearImages: () => void;
  setCharacter: (liId: string, state: CharacterGenState) => void;
  updateCharacterPose: (liId: string, pose: string, filename: string) => void;
  clearCharacters: () => void;

  setEnding: (key: string, ending: EndingVariant) => void;
  clearEndings: () => void;
  setWorldModel: (world: WorldModel | null) => void;
  /** Гранулярная правка настроения/спец-типа локации (авторский оверрайд). */
  patchLocation: (id: string, patch: Partial<Pick<WorldLocation, 'mood' | 'specialKind'>>) => void;

  setCastPlan: (castPlan: CastPlan | null) => void;
  /** Стадия worldCalendar: мир + календарь + маппинг тегов одним артефактом. */
  setWorldCalendar: (
    world: WorldModel | null,
    calendar: Calendar | null,
    tagMap: Record<string, string[]> | null,
  ) => void;
  setSpine: (spine: SpinePlan | null) => void;
  setSchedule: (schedule: CharacterSchedule | null) => void;
  setEventUnits: (units: EventUnit[]) => void;
  /** Полная замена пула событий (пере-генерация: старые id не должны выживать). */
  replaceEventUnits: (units: EventUnit[]) => void;
  setUnitProse: (unitId: string, units: DialogueUnit[]) => void;
  setSpineBeatProse: (beatId: string, beat: AnchorBeat) => void;

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

  /** Старт нового прогона (или продолжение прошлого — решает calendarRunner). */
  beginCalendarRun: (run: CalendarRunState) => void;
  patchCalendarRun: (
    patch: Partial<{
      phase: BulkCalendarPhase;
      progress: { completed: number; total: number };
      pendingBatch: CalendarPendingBatch | null;
      dirtyStages: CalendarCascadeStage[];
      softIssues: Record<string, string[]>;
    }>,
  ) => void;
  /** Инкрементальная запись артефактов стадии в черновик (переживает reload). */
  patchCalendarDraft: (patch: CalendarDraft) => void;
  failCalendarRun: (phase: BulkCalendarPhase, error: string, issues: string[]) => void;
  /** Единственная точка записи committed-стека из прогона (атомарный коммит). */
  commitCalendarRun: () => void;
  discardCalendarRun: () => void;

  setStoryQA: (status: StoryQAStatus | null) => void;
};

const isPlainRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Пустое состояние календарного пайплайна от стадии spine и ниже. */
const CLEARED_FROM_SPINE = {
  spine: null,
  schedule: null,
  eventUnits: {},
  unitProse: {},
  spineBeatProse: {},
} as const;

export const useNarrativeStore = create<NarrativeState>()(
  persist(
    set => ({
      images: {},
      characters: {},
      endings: {},
      worldModel: null,
      castPlan: null,
      calendar: null,
      tagMap: null,
      anchorNarrations: null,
      spine: null,
      schedule: null,
      eventUnits: {},
      unitProse: {},
      spineBeatProse: {},
      audioBase: null,
      audioMoodBeds: {},
      audioSpecialBeds: {},
      audioByLi: {},
      audioSfx: {},
      audioSfxState: null,
      calendarRun: null,
      storyQA: null,

      setImage: (locKey, state) => {
        set(s => ({ images: { ...s.images, [locKey]: state } }));
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

      setEnding: (key, ending) => {
        set(s => ({ endings: { ...s.endings, [key]: ending } }));
      },

      clearEndings: () => set({ endings: {} }),

      setWorldModel: worldModel => set({ worldModel }),

      setCastPlan: castPlan => {
        // Агенды определяют теги → календарь/маппинг и всё ниже устаревают.
        set({ castPlan, calendar: null, tagMap: null, endings: {}, ...CLEARED_FROM_SPINE });
      },

      setWorldCalendar: (worldModel, calendar, tagMap) => {
        set({ worldModel, calendar, tagMap, endings: {}, ...CLEARED_FROM_SPINE });
      },

      setSpine: spine => {
        set({ ...CLEARED_FROM_SPINE, spine, endings: {} });
      },

      setSchedule: schedule => {
        // Пул событий генерируется по выжимкам расписания — устаревает вместе с ним.
        set({ schedule, eventUnits: {}, unitProse: {} });
      },

      setEventUnits: units => {
        set(s => {
          const eventUnits: Record<string, EventUnit> = { ...s.eventUnits };
          for (const u of units) eventUnits[u.id] = u;
          return { eventUnits };
        });
      },

      replaceEventUnits: units => {
        set({ eventUnits: Object.fromEntries(units.map(u => [u.id, u])) });
      },

      setUnitProse: (unitId, units) => {
        set(s => ({ unitProse: { ...s.unitProse, [unitId]: units } }));
      },

      setSpineBeatProse: (beatId, beat) => {
        set(s => ({ spineBeatProse: { ...s.spineBeatProse, [beatId]: beat } }));
      },

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

      beginCalendarRun: run => set({ calendarRun: run }),

      patchCalendarRun: patch => {
        set(s => (s.calendarRun ? { calendarRun: { ...s.calendarRun, ...patch } } : s));
      },

      patchCalendarDraft: patch => {
        set(s => {
          if (!s.calendarRun) return s;
          const draft: Record<string, unknown> = { ...s.calendarRun.draft };
          for (const [key, value] of Object.entries(patch)) {
            const prev = draft[key];
            // Поэлементные поля (eventUnits/unitProse/spineBeatProse/endings)
            // накапливаются по ходу стадии — патч мержится, а не заменяет.
            draft[key] = isPlainRecord(prev) && isPlainRecord(value) ? { ...prev, ...value } : value;
          }
          return { calendarRun: { ...s.calendarRun, draft: draft as CalendarDraft } };
        });
      },

      failCalendarRun: (phase, error, issues) => {
        // draft/pendingBatch/dirtyStages сохраняются: следующий запуск
        // («Продолжить») переиспользует уже оплаченные стадии.
        set(s => (s.calendarRun ? { calendarRun: { ...s.calendarRun, status: 'error', phase, error, issues } } : s));
      },

      commitCalendarRun: () => {
        set(s => {
          if (!s.calendarRun) return s;
          const patch = buildCommitPatch(s.calendarRun);
          // Новый мир → фоны исчезнувших локаций выбрасываются, фоны
          // переписанных возвращаются в очередь (см. reconcileImagesForWorld).
          // Отчёт QA сбрасывается: он судил прежнюю историю.
          return { ...patch, images: reconcileImagesForWorld(s.images, patch.worldModel), storyQA: null };
        });
      },

      discardCalendarRun: () => set({ calendarRun: null }),

      setStoryQA: storyQA => set({ storyQA }),
    }),
    {
      name: 'gu-narrative-state',
      // v11: calendarRun (черновик прогона) + audioSfxState — их дожимает
      // init-система после reload. v10: снос легаси. v9: календарный пайплайн.
      version: NARRATIVE_STORE_VERSION,
      // Персистим только данные, не действия. batchId незавершённых генераций
      // персистится намеренно: initNarrative переподключается к живым батчам,
      // а мёртвые (сервис перезапущен → 404) помечает failed.
      partialize: state => ({
        images: state.images,
        characters: state.characters,
        endings: state.endings,
        worldModel: state.worldModel,
        castPlan: state.castPlan,
        calendar: state.calendar,
        tagMap: state.tagMap,
        anchorNarrations: state.anchorNarrations,
        spine: state.spine,
        schedule: state.schedule,
        eventUnits: state.eventUnits,
        unitProse: state.unitProse,
        spineBeatProse: state.spineBeatProse,
        audioBase: state.audioBase,
        audioMoodBeds: state.audioMoodBeds,
        audioSpecialBeds: state.audioSpecialBeds,
        audioByLi: state.audioByLi,
        audioSfx: state.audioSfx,
        audioSfxState: state.audioSfxState,
        calendarRun: state.calendarRun,
        storyQA: state.storyQA,
      }),
      // Без migrate zustand выбрасывает состояние при несовпадении версии —
      // дорогие кэши генерации должны переживать апгрейд схемы.
      migrate: migratePersistedNarrativeState,
    },
  ),
);
