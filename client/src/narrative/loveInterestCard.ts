import { ARCHETYPES } from './archetypes';
import type { Appearance, ArchetypeId, LoveInterestCard, Personality } from './types';

/**
 * Конструкторы пустой карточки персонажа. Вынесены из briefStore, потому что
 * ими пользуется не только стор: слияние сгенерированного брифа собирает новые
 * карточки теми же дефолтами, что и кнопка «+ добавить».
 */

export const newLiId = (): string => `li_${Math.random().toString(36).slice(2, 8)}`;

export function emptyAppearance(): Appearance {
  return { hair: '', build: '', signatureItem: '' };
}

export function emptyPersonality(): Personality {
  return { traits: [], values: [], fears: [], desires: [] };
}

export function defaultArchetypeSpecifics(archetype: ArchetypeId): Record<string, string> | null {
  const schema = ARCHETYPES[archetype].archetypeSpecificsSchema;
  if (!schema) return null;
  const out: Record<string, string> = {};
  for (const [field, decl] of Object.entries(schema)) {
    out[field] = decl.examples[0] ?? '';
  }
  return out;
}

export function newLoveInterest(archetype: ArchetypeId = 'slow_burn'): LoveInterestCard {
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
