import { ARCHETYPES } from './archetypes';
import { BRIEF_FIELDS, LI_CARD_FIELDS, liFieldPath, parseLiPath } from './briefFields';
import type { Brief, LoveInterestCard } from './types';

/**
 * Пустые места брифа — что именно разрешено дозаполнить генератору.
 *
 * Правило намеренно узкое: gap — только по-настоящему пустая строка, пустой
 * список или отсутствующее значение. Числа и селекты (acts, длительность,
 * intensity, пол протагониста, архетип карточки) в брифе всегда имеют
 * осмысленный дефолт, и отличить «автор согласился с дефолтом» от «автор его
 * не видел» невозможно — поэтому генератор их не трогает вовсе.
 */

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  // Числа и булевы заполнены всегда: пустого числа не бывает.
  return false;
}

function readDotted(root: unknown, path: string): unknown {
  let cur = root;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Читает значение по пути брифа, включая `loveInterests[<id>].<поле>`. */
export function readBriefPath(brief: Brief, path: string): unknown {
  const li = parseLiPath(path);
  if (!li) return readDotted(brief, path);
  const card = brief.loveInterests.find(c => c.id === li.id);
  return card ? readDotted(card, li.field) : undefined;
}

/**
 * archetypeSpecifics пустой не тогда, когда он null, а когда архетип требует
 * полей, которых в нём нет: у slow_burn схемы нет вовсе, и null там — верное
 * значение, а не пробел.
 */
function specificsGap(card: LoveInterestCard): boolean {
  const schema = ARCHETYPES[card.archetype]?.archetypeSpecificsSchema;
  if (!schema) return false;
  const specifics = card.archetypeSpecifics ?? {};
  return Object.entries(schema).some(([field, decl]) => decl.required && isEmptyValue(specifics[field]));
}

/** Пусто ли поле сейчас — та же проверка, что и при сборе gaps. */
export function isGapStillEmpty(brief: Brief, path: string): boolean {
  const li = parseLiPath(path);
  if (li?.field === 'archetypeSpecifics') {
    const card = brief.loveInterests.find(c => c.id === li.id);
    return card ? specificsGap(card) : false;
  }
  return isEmptyValue(readBriefPath(brief, path));
}

/**
 * Пути пустых полей брифа. Пустой каст даёт один путь `loveInterests`
 * (генерировать карточки целиком), непустой — по пути на каждое пустое поле
 * каждой карточки.
 */
export function computeBriefGaps(brief: Brief): string[] {
  const gaps: string[] = [];

  for (const spec of BRIEF_FIELDS) {
    if (spec.path === 'loveInterests') continue;
    if (isEmptyValue(readBriefPath(brief, spec.path))) gaps.push(spec.path);
  }

  if (brief.loveInterests.length === 0) {
    gaps.push('loveInterests');
    return gaps;
  }

  for (const card of brief.loveInterests) {
    for (const spec of LI_CARD_FIELDS) {
      // Архетип — авторский выбор из списка, пустым не бывает.
      if (spec.path === 'archetype') continue;
      // null в preExistingRelationship — не пробел, а значение «незнакомы»:
      // пустое поле формы означает именно это. Новым карточкам знакомство
      // придумывается вместе со всей карточкой, а в существующую генератор
      // его не дописывает — иначе он переписывал бы авторское «незнакомы».
      if (spec.path === 'preExistingRelationship') continue;
      if (spec.path === 'archetypeSpecifics') {
        if (specificsGap(card)) gaps.push(liFieldPath(card.id, spec.path));
        continue;
      }
      if (isEmptyValue(readDotted(card, spec.path))) gaps.push(liFieldPath(card.id, spec.path));
    }
  }

  return gaps;
}
