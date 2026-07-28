import { ARCHETYPE_IDS } from './archetypes';
import { BRIEF_FIELDS } from './briefFields';

/**
 * Payload для /generate/briefHintParse: свободный текст автора + адреса, по
 * которым его можно разложить. Каталог отдаём целиком, а не только по пустым
 * полям: автор мог написать и про уже заполненное, и эту директиву лучше
 * получить и отбросить, чем потерять вместе с остальной фразой.
 */
export function buildBriefHintParseRequestPayload(rawText: string): {
  rawText: string;
  fieldCatalog: { path: string; description: string }[];
  archetypeIds: string[];
} {
  return {
    rawText: rawText.trim(),
    fieldCatalog: BRIEF_FIELDS.map(f => ({ path: f.path, description: f.description })),
    archetypeIds: [...ARCHETYPE_IDS],
  };
}
