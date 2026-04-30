import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
import { ARCHETYPES } from './archetypes';

/**
 * Стор брифа для канваса. В отличие от narrativeStore (сессионный кэш
 * downstream-артефактов), это стор пользовательского ввода — он персистится
 * в localStorage, чтобы черновик брифа не терялся.
 */

const newLiId = () => `li_${Math.random().toString(36).slice(2, 8)}`;

function emptyAppearance(): Appearance {
  return { hair: '', build: '', signatureItem: '' };
}
function emptyPersonality(): Personality {
  return { traits: [], values: [], fears: [], desires: [] };
}
function defaultArchetypeSpecifics(archetype: ArchetypeId): Record<string, string> | null {
  const schema = ARCHETYPES[archetype].archetypeSpecificsSchema;
  if (!schema) return null;
  const out: Record<string, string> = {};
  for (const [field, decl] of Object.entries(schema)) {
    out[field] = decl.examples[0] ?? '';
  }
  return out;
}

function newLoveInterest(archetype: ArchetypeId = 'slow_burn'): LoveInterestCard {
  return {
    id: newLiId(),
    name: '',
    age: 21,
    roleInWorld: '',
    appearance: emptyAppearance(),
    speechPattern: '',
    personality: emptyPersonality(),
    archetype,
    archetypeSpecifics: defaultArchetypeSpecifics(archetype),
    preExistingRelationship: null,
  };
}

type BriefState = {
  brief: Brief;

  resetToSample: () => void;
  resetToBlank: () => void;

  // top-level
  setFormat: (format: Format) => void;

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
  removeLoveInterest: (id: string) => void;
  patchLoveInterest: (id: string, patch: Partial<LoveInterestCard>) => void;
  patchLoveInterestAppearance: (id: string, patch: Partial<Appearance>) => void;
  patchLoveInterestPersonality: (id: string, patch: Partial<Personality>) => void;
  setLoveInterestArchetype: (id: string, archetype: ArchetypeId) => void;
  patchLoveInterestSpecifics: (id: string, key: string, value: string) => void;
};

function blankBrief(): Brief {
  return {
    ...SAMPLE_BRIEF,
    world: {
      setting: { era: '', place: '', specifics: '' },
      tone: { mood: '', themes: [], intensity: 0.4 },
    },
    artStyle: {
      referenceDescriptor: '',
      colorPalette: [],
      modelPromptTemplate: '',
    },
    protagonist: { gender: 'female', namePlaceholder: '{player_name}', voiceStyle: 'neutral_minimal' },
    loveInterests: [],
  };
}

export const useBriefStore = create<BriefState>()(
  persist(
    (set, get) => ({
      brief: SAMPLE_BRIEF,

      resetToSample: () => set({ brief: SAMPLE_BRIEF }),
      resetToBlank: () => set({ brief: blankBrief() }),

      setFormat: format => set(s => ({ brief: { ...s.brief, format } })),

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
      name: 'gu-narrative-brief',
      version: 1,
    },
  ),
);
