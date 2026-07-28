import { ARCHETYPES } from './archetypes';
import {
  BRANCHING_DENSITIES,
  ENDING_KINDS,
  FORMATS,
  liFieldPath,
  PROTAGONIST_GENDERS,
  PROTAGONIST_VOICE_STYLES,
} from './briefFields';
import { isGapStillEmpty } from './briefGaps';
import { newLoveInterest } from './loveInterestCard';
import type { ArchetypeId, Brief, EndingKind, LoveInterestCard } from './types';

/**
 * Слияние сгенерированного patch-а в бриф. Единственный защитный рубеж между
 * моделью и авторской работой, поэтому правило здесь жёсткое: пишется только
 * то, что перечислено в gaps И на момент слияния всё ещё пусто. Модель,
 * вернувшая бриф целиком вместо patch-а, ничего не затрёт, а поле, которое
 * автор успел заполнить руками пока шла генерация, останется его.
 */

/** Больше карточек каст не выдержит, да и автор не разберёт. */
const MAX_GENERATED_CARDS = 8;
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readPath(root: unknown, path: string): unknown {
  let cur = root;
  for (const key of path.split('.')) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function takeString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

function takeStringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(takeString).filter((s): s is string => s !== null);
  return out.length > 0 ? out : null;
}

function takeColorList(v: unknown): string[] | null {
  const list = takeStringList(v);
  const out = list?.filter(c => HEX_COLOR.test(c)) ?? [];
  return out.length > 0 ? out : null;
}

function takeAge(v: unknown): number | null {
  return takeNumber(v, 16, 60, true);
}

/** Число из patch-а, зажатое в разрешённый диапазон поля. */
function takeNumber(v: unknown, min: number, max: number, integer: boolean): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(max, Math.max(min, n));
  return integer ? Math.round(clamped) : clamped;
}

/** Значение перечисления — только из списка допустимых, иначе поле не пишется. */
function takeEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = takeString(v);
  return s !== null && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

function takeEnumList<T extends string>(v: unknown, allowed: readonly T[]): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const item of v) {
    const value = takeEnum(item, allowed);
    if (value !== null && !out.includes(value)) out.push(value);
  }
  return out.length > 0 ? out : null;
}

/** Ключи специфики — только из схемы архетипа; остальное модель придумала зря. */
function takeSpecifics(archetype: ArchetypeId, raw: unknown): Record<string, string> | null {
  const schema = ARCHETYPES[archetype]?.archetypeSpecificsSchema;
  if (!schema || !isRecord(raw)) return null;
  const out: Record<string, string> = {};
  for (const field of Object.keys(schema)) {
    const value = takeString(raw[field]);
    if (value) out[field] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function mergeGeneratedBrief(current: Brief, patch: unknown, gaps: string[]): Brief {
  const allowed = new Set(gaps);
  const p: unknown = isRecord(patch) ? patch : {};

  const canWrite = (path: string) => allowed.has(path) && isGapStillEmpty(current, path);
  const str = (path: string, fallback: string) =>
    canWrite(path) ? takeString(readPath(p, path)) ?? fallback : fallback;
  const list = (path: string, fallback: string[]) =>
    canWrite(path) ? takeStringList(readPath(p, path)) ?? fallback : fallback;
  const num = (path: string, min: number, max: number, integer: boolean, fallback: number | null) =>
    canWrite(path) ? takeNumber(readPath(p, path), min, max, integer) ?? fallback : fallback;
  const pick = <T extends string>(path: string, allowedValues: readonly T[], fallback: T | null) =>
    canWrite(path) ? takeEnum(readPath(p, path), allowedValues) ?? fallback : fallback;

  return {
    ...current,
    format: pick('format', FORMATS, current.format),
    scale: {
      acts: num('scale.acts', 1, 10, true, current.scale.acts),
      targetDurationMinutes: num('scale.targetDurationMinutes', 10, 180, true, current.scale.targetDurationMinutes),
      branchingDensity: pick('scale.branchingDensity', BRANCHING_DENSITIES, current.scale.branchingDensity),
      commonRouteShare: num('scale.commonRouteShare', 0.1, 0.9, false, current.scale.commonRouteShare),
      branchPointBudget: num('scale.branchPointBudget', 0, 3, true, current.scale.branchPointBudget),
    },
    endingsProfile: canWrite('endingsProfile')
      ? takeEnumList<EndingKind>(readPath(p, 'endingsProfile'), ENDING_KINDS) ?? current.endingsProfile
      : current.endingsProfile,
    world: {
      setting: {
        era: str('world.setting.era', current.world.setting.era),
        place: str('world.setting.place', current.world.setting.place),
        specifics: str('world.setting.specifics', current.world.setting.specifics),
      },
      tone: {
        mood: str('world.tone.mood', current.world.tone.mood),
        themes: list('world.tone.themes', current.world.tone.themes),
        intensity: num('world.tone.intensity', 0, 1, false, current.world.tone.intensity),
      },
    },
    protagonist: {
      ...current.protagonist,
      gender: pick('protagonist.gender', PROTAGONIST_GENDERS, current.protagonist.gender),
      voiceStyle: pick('protagonist.voiceStyle', PROTAGONIST_VOICE_STYLES, current.protagonist.voiceStyle),
    },
    artStyle: {
      referenceDescriptor: str('artStyle.referenceDescriptor', current.artStyle.referenceDescriptor),
      modelPromptTemplate: str('artStyle.modelPromptTemplate', current.artStyle.modelPromptTemplate),
      colorPalette: canWrite('artStyle.colorPalette')
        ? takeColorList(readPath(p, 'artStyle.colorPalette')) ?? current.artStyle.colorPalette
        : current.artStyle.colorPalette,
    },
    loveInterests: mergeLoveInterests(current, readPath(p, 'loveInterests'), allowed),
  };
}

function mergeLoveInterests(current: Brief, raw: unknown, allowed: Set<string>): LoveInterestCard[] {
  if (!Array.isArray(raw)) return current.loveInterests;

  // Каст пуст — карточки собираются с нуля, id выдаёт редактор, а не модель.
  if (allowed.has('loveInterests') && current.loveInterests.length === 0) {
    const built = raw
      .slice(0, MAX_GENERATED_CARDS)
      .map(buildCard)
      .filter((c): c is LoveInterestCard => c !== null);
    return built.length > 0 ? built : current.loveInterests;
  }

  return current.loveInterests.map(card => {
    const generated = raw.find(r => isRecord(r) && r.id === card.id);
    return isRecord(generated) ? fillCard(current, card, generated, allowed) : card;
  });
}

/** Новая карточка: дефолты те же, что у кнопки «+ добавить», поверх — генерация. */
function buildCard(raw: unknown): LoveInterestCard | null {
  if (!isRecord(raw)) return null;
  const archetype = raw.archetype;
  // Неизвестный архетип — карточка не собирается: подменить его тихо значит
  // выдать автору не того персонажа, а validateBrief поймает недобор каста.
  if (typeof archetype !== 'string' || !(archetype in ARCHETYPES)) return null;
  const base = newLoveInterest(archetype as ArchetypeId);

  return {
    ...base,
    name: takeString(raw.name) ?? base.name,
    age: takeAge(raw.age) ?? base.age,
    roleInWorld: takeString(raw.roleInWorld) ?? base.roleInWorld,
    appearance: {
      hair: takeString(readPath(raw, 'appearance.hair')) ?? '',
      build: takeString(readPath(raw, 'appearance.build')) ?? '',
      signatureItem: takeString(readPath(raw, 'appearance.signatureItem')) ?? '',
    },
    speechPattern: takeString(raw.speechPattern) ?? base.speechPattern,
    personality: {
      traits: takeStringList(readPath(raw, 'personality.traits')) ?? [],
      values: takeStringList(readPath(raw, 'personality.values')) ?? [],
      fears: takeStringList(readPath(raw, 'personality.fears')) ?? [],
      desires: takeStringList(readPath(raw, 'personality.desires')) ?? [],
    },
    archetypeSpecifics: takeSpecifics(archetype as ArchetypeId, raw.archetypeSpecifics) ?? base.archetypeSpecifics,
    preExistingRelationship: takeString(raw.preExistingRelationship),
  };
}

/** Существующая карточка: дозаполняются только пустые поля из gaps. */
function fillCard(
  current: Brief,
  card: LoveInterestCard,
  gen: Record<string, unknown>,
  allowed: Set<string>,
): LoveInterestCard {
  const can = (field: string) => {
    const path = liFieldPath(card.id, field);
    return allowed.has(path) && isGapStillEmpty(current, path);
  };
  const str = (field: string, fallback: string) =>
    can(field) ? takeString(readPath(gen, field)) ?? fallback : fallback;
  const list = (field: string, fallback: string[]) =>
    can(field) ? takeStringList(readPath(gen, field)) ?? fallback : fallback;

  return {
    ...card,
    name: str('name', card.name),
    age: can('age') ? takeAge(gen.age) ?? card.age : card.age,
    roleInWorld: str('roleInWorld', card.roleInWorld),
    appearance: {
      ...card.appearance,
      hair: str('appearance.hair', card.appearance.hair ?? ''),
      build: str('appearance.build', card.appearance.build ?? ''),
      signatureItem: str('appearance.signatureItem', card.appearance.signatureItem ?? ''),
    },
    speechPattern: str('speechPattern', card.speechPattern),
    personality: {
      traits: list('personality.traits', card.personality.traits),
      values: list('personality.values', card.personality.values),
      fears: list('personality.fears', card.personality.fears),
      desires: list('personality.desires', card.personality.desires),
    },
    archetypeSpecifics: can('archetypeSpecifics')
      ? takeSpecifics(card.archetype, gen.archetypeSpecifics) ?? card.archetypeSpecifics
      : card.archetypeSpecifics,
    preExistingRelationship: can('preExistingRelationship')
      ? takeString(gen.preExistingRelationship) ?? card.preExistingRelationship
      : card.preExistingRelationship,
  };
}
