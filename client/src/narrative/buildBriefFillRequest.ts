import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import {
  LI_CARD_FIELDS,
  briefFieldSpec,
  liCardFieldSpec,
  parseLiPath,
  type BriefDirective,
  type TrimmedArchetypeProfile,
} from './briefFields';
import { scaledTarget } from './briefVerbosity';
import type { ArchetypeId, Brief } from './types';

/**
 * Payload для /generate/briefFill. Пути пустых полей обогащаются описанием и
 * целевым объёмом — модель должна знать не только «что пусто», но и что это за
 * поле и насколько развёрнуто его писать.
 *
 * Профили архетипов уходят обрезанными (описание + схема специфики) и всегда
 * все: новая карточка вольна выбрать любой архетип, а движковые поля профиля
 * (траектории, requiredBeats, веса концовок) в этой стадии не используются.
 */
export function buildBriefFillRequestPayload(
  brief: Brief,
  gaps: string[],
  directives: BriefDirective[] | null,
  verbosity: number,
): {
  brief: Brief;
  gaps: { path: string; description: string; target: number }[];
  cardFields: { field: string; description: string; target: number }[];
  directives: BriefDirective[] | null;
  archetypeProfiles: Record<string, TrimmedArchetypeProfile>;
} {
  const archetypeProfiles: Record<string, TrimmedArchetypeProfile> = {};
  for (const id of ARCHETYPE_IDS) {
    archetypeProfiles[id] = trimArchetype(id);
  }

  return {
    brief,
    gaps: gaps
      .map(path => describeGap(path, verbosity))
      .filter((g): g is { path: string; description: string; target: number } => g !== null),
    cardFields: LI_CARD_FIELDS.map(spec => ({
      field: spec.path,
      description: spec.description,
      target: scaledTarget(spec, verbosity),
    })),
    directives: directives && directives.length > 0 ? directives : null,
    archetypeProfiles,
  };
}

function describeGap(path: string, verbosity: number): { path: string; description: string; target: number } | null {
  const li = parseLiPath(path);
  const spec = li ? liCardFieldSpec(li.field) : briefFieldSpec(path);
  if (!spec) return null;
  return { path, description: spec.description, target: scaledTarget(spec, verbosity) };
}

function trimArchetype(id: ArchetypeId): TrimmedArchetypeProfile {
  const profile = ARCHETYPES[id];
  return {
    id: profile.id,
    description: profile.description,
    archetypeSpecificsSchema: profile.archetypeSpecificsSchema,
  };
}
