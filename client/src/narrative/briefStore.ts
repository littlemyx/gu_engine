import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageKey } from '@/project/projectScope';
import type {
  Appearance,
  ArchetypeId,
  ArtStyle,
  Brief,
  BriefScale,
  EndingKind,
  Format,
  LoveInterestCard,
  Personality,
  Protagonist,
  WorldSetting,
  WorldTone,
} from './types';
import { SAMPLE_BRIEF } from './sampleBrief';
import { defaultArchetypeSpecifics, newLoveInterest } from './loveInterestCard';
import { DEFAULT_SELECTOR_CONFIG, type SelectorConfig, type SelectorWeights } from 'gu-engine-story-core';

/**
 * Стор брифа для канваса. В отличие от narrativeStore (сессионный кэш
 * downstream-артефактов), это стор пользовательского ввода — он персистится
 * в localStorage, чтобы черновик брифа не терялся.
 */

type BriefState = {
  brief: Brief;

  /**
   * Настройки салиенс-селектора — авторская ручка режиссуры, а не артефакт
   * генерации: правятся без перегенерации истории и едут в бандл как есть.
   */
  selector: SelectorConfig;
  patchSelector: (patch: Partial<SelectorConfig>) => void;
  patchSelectorWeight: (key: keyof SelectorWeights, value: number) => void;
  resetSelector: () => void;

  resetToSample: () => void;
  resetToBlank: () => void;

  // top-level
  /** null — «авто»: формат выберет генератор брифа. */
  setFormat: (format: Format | null) => void;
  /** Seed детерминированных шагов генерации (расписание персонажей). */
  setSeed: (seed: number) => void;

  // scale
  patchScale: (patch: Partial<BriefScale>) => void;

  // endings
  setEndingsProfile: (endings: EndingKind[]) => void;

  // world
  patchWorldSetting: (patch: Partial<WorldSetting>) => void;
  patchWorldTone: (patch: Partial<WorldTone>) => void;

  // art style
  patchArtStyle: (patch: Partial<ArtStyle>) => void;

  // protagonist
  patchProtagonist: (patch: Partial<Protagonist>) => void;

  // love interests
  addLoveInterest: () => void;
  /** Вставка готовой карточки: импорт брифа и применение префаба персонажа. */
  addLoveInterestCard: (card: LoveInterestCard) => void;
  /** Полная замена брифа (импорт файла). */
  setBrief: (brief: Brief) => void;
  removeLoveInterest: (id: string) => void;
  patchLoveInterest: (id: string, patch: Partial<LoveInterestCard>) => void;
  patchLoveInterestAppearance: (id: string, patch: Partial<Appearance>) => void;
  patchLoveInterestPersonality: (id: string, patch: Partial<Personality>) => void;
  setLoveInterestArchetype: (id: string, archetype: ArchetypeId) => void;
  patchLoveInterestSpecifics: (id: string, key: string, value: string) => void;
};

/**
 * Чистый лист. Габариты уходят в null («авто»), а не в дефолты образца:
 * пока они молча оставались заполненными, «Пусто» врало, а генератор брифа
 * считал их авторским выбором и не трогал — история всегда выходила на
 * 4 акта и 30 минут, что бы автор ни написал в заметках.
 */
export function blankBrief(): Brief {
  return {
    ...SAMPLE_BRIEF,
    format: null,
    scale: {
      acts: null,
      targetDurationMinutes: null,
      branchingDensity: null,
      commonRouteShare: null,
      branchPointBudget: null,
    },
    endingsProfile: [],
    world: {
      setting: { era: '', place: '', specifics: '' },
      tone: { mood: '', themes: [], intensity: null },
    },
    artStyle: {
      referenceDescriptor: '',
      colorPalette: [],
      modelPromptTemplate: '',
    },
    protagonist: { gender: null, namePlaceholder: '{player_name}', voiceStyle: null },
    loveInterests: [],
  };
}

/**
 * Бриф нетронут — автор ещё ничего не вложил. Отличает «новый проект» от
 * «начатого, но недозаполненного»: подставлять образец поверх второго нельзя,
 * это молча стёрло бы работу.
 */
export function isBlankBrief(brief: Brief): boolean {
  const { era, place, specifics } = brief.world.setting;
  return (
    brief.loveInterests.length === 0 &&
    !era &&
    !place &&
    !specifics &&
    !brief.world.tone.mood &&
    brief.world.tone.themes.length === 0 &&
    !brief.artStyle.referenceDescriptor
  );
}

export const useBriefStore = create<BriefState>()(
  persist(
    (set, get) => ({
      // Новый проект — чистый лист, а не чужая история про Киру: с
      // многопроектностью пустой неймспейс стал стартовым состоянием
      // продукта, и молча подсунутый образец легко сгенерировать за свой.
      // Образец достаётся явно — кнопкой «Подставить образец».
      brief: blankBrief(),

      resetToSample: () => set({ brief: SAMPLE_BRIEF }),
      resetToBlank: () => set({ brief: blankBrief() }),

      selector: DEFAULT_SELECTOR_CONFIG,
      patchSelector: patch => set(s => ({ selector: { ...s.selector, ...patch } })),
      patchSelectorWeight: (key, value) =>
        set(s => ({ selector: { ...s.selector, weights: { ...s.selector.weights, [key]: value } } })),
      resetSelector: () => set({ selector: DEFAULT_SELECTOR_CONFIG }),

      setFormat: format => set(s => ({ brief: { ...s.brief, format } })),

      setSeed: seed => set(s => ({ brief: { ...s.brief, seed: Math.trunc(seed) } })),

      patchScale: patch => set(s => ({ brief: { ...s.brief, scale: { ...s.brief.scale, ...patch } } })),

      setEndingsProfile: endings => set(s => ({ brief: { ...s.brief, endingsProfile: endings } })),

      patchWorldSetting: patch =>
        set(s => ({
          brief: { ...s.brief, world: { ...s.brief.world, setting: { ...s.brief.world.setting, ...patch } } },
        })),
      patchWorldTone: patch =>
        set(s => ({
          brief: { ...s.brief, world: { ...s.brief.world, tone: { ...s.brief.world.tone, ...patch } } },
        })),

      patchArtStyle: patch => set(s => ({ brief: { ...s.brief, artStyle: { ...s.brief.artStyle, ...patch } } })),

      patchProtagonist: patch =>
        set(s => ({ brief: { ...s.brief, protagonist: { ...s.brief.protagonist, ...patch } } })),

      addLoveInterest: () =>
        set(s => ({ brief: { ...s.brief, loveInterests: [...s.brief.loveInterests, newLoveInterest()] } })),

      addLoveInterestCard: card =>
        set(s => {
          // Тот же id уже в касте — обновляем карточку, а не заводим двойника.
          const exists = s.brief.loveInterests.some(li => li.id === card.id);
          return {
            brief: {
              ...s.brief,
              loveInterests: exists
                ? s.brief.loveInterests.map(li => (li.id === card.id ? card : li))
                : [...s.brief.loveInterests, card],
            },
          };
        }),

      setBrief: brief => set({ brief }),

      removeLoveInterest: id =>
        set(s => ({
          brief: { ...s.brief, loveInterests: s.brief.loveInterests.filter(li => li.id !== id) },
        })),

      patchLoveInterest: (id, patch) =>
        set(s => ({
          brief: {
            ...s.brief,
            loveInterests: s.brief.loveInterests.map(li => (li.id === id ? { ...li, ...patch } : li)),
          },
        })),

      patchLoveInterestAppearance: (id, patch) =>
        set(s => ({
          brief: {
            ...s.brief,
            loveInterests: s.brief.loveInterests.map(li =>
              li.id === id ? { ...li, appearance: { ...li.appearance, ...patch } } : li,
            ),
          },
        })),

      patchLoveInterestPersonality: (id, patch) =>
        set(s => ({
          brief: {
            ...s.brief,
            loveInterests: s.brief.loveInterests.map(li =>
              li.id === id ? { ...li, personality: { ...li.personality, ...patch } } : li,
            ),
          },
        })),

      setLoveInterestArchetype: (id, archetype) => {
        const current = get().brief.loveInterests.find(li => li.id === id);
        if (!current) return;
        set(s => ({
          brief: {
            ...s.brief,
            loveInterests: s.brief.loveInterests.map(li =>
              li.id === id
                ? {
                    ...li,
                    archetype,
                    // Сбросить specifics к дефолтам, если архетип реально сменился
                    archetypeSpecifics:
                      li.archetype === archetype ? li.archetypeSpecifics : defaultArchetypeSpecifics(archetype),
                  }
                : li,
            ),
          },
        }));
      },

      patchLoveInterestSpecifics: (id, key, value) =>
        set(s => ({
          brief: {
            ...s.brief,
            loveInterests: s.brief.loveInterests.map(li =>
              li.id === id
                ? {
                    ...li,
                    archetypeSpecifics: { ...(li.archetypeSpecifics ?? {}), [key]: value },
                  }
                : li,
            ),
          },
        })),
    }),
    {
      name: storageKey('gu-narrative-brief'),
      // v2: scale.branchPointBudget (бюджет глобальных развилок хребта).
      // v3: selector — настройки салиенс-селектора.
      version: 3,
      migrate: persisted => {
        const prev = (persisted ?? {}) as Partial<BriefState>;
        const brief = prev.brief ?? SAMPLE_BRIEF;
        return {
          ...prev,
          brief: {
            ...brief,
            scale: { ...brief.scale, branchPointBudget: brief.scale.branchPointBudget ?? 2 },
          },
          // Веса могли пополниться новым членом — дефолты снизу, сохранённое сверху.
          selector: {
            ...DEFAULT_SELECTOR_CONFIG,
            ...(prev.selector ?? {}),
            weights: { ...DEFAULT_SELECTOR_CONFIG.weights, ...(prev.selector?.weights ?? {}) },
          },
        };
      },
    },
  ),
);
