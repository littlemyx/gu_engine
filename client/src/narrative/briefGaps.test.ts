import { describe, expect, it } from 'vitest';

import { blankBrief as blank } from './briefStore';
import { computeBriefGaps, isGapStillEmpty, isEmptyValue } from './briefGaps';
import { newLoveInterest } from './loveInterestCard';
import { SAMPLE_BRIEF } from './sampleBrief';

describe('isEmptyValue', () => {
  it('пустыми считает только строки, списки и отсутствующие значения', () => {
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue('   ')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue('x')).toBe(false);
    expect(isEmptyValue(['x'])).toBe(false);
    // Число всегда заполнено: отличить дефолт от выбора автора нельзя.
    expect(isEmptyValue(0)).toBe(false);
  });
});

describe('computeBriefGaps', () => {
  it('«Пусто» действительно очищает всё: габариты и протагонист тоже пробелы', () => {
    expect(computeBriefGaps(blank())).toEqual([
      'format',
      'scale.acts',
      'scale.targetDurationMinutes',
      'scale.branchingDensity',
      'scale.commonRouteShare',
      'scale.branchPointBudget',
      'endingsProfile',
      'protagonist.gender',
      'protagonist.voiceStyle',
      'world.setting.era',
      'world.setting.place',
      'world.setting.specifics',
      'world.tone.mood',
      'world.tone.themes',
      'world.tone.intensity',
      'artStyle.referenceDescriptor',
      'artStyle.modelPromptTemplate',
      'artStyle.colorPalette',
      'loveInterests',
    ]);
  });

  it('на образце пробелов нет', () => {
    expect(computeBriefGaps(SAMPLE_BRIEF)).toEqual([]);
  });

  it('заполненные автором поля в пробелы не попадают', () => {
    const brief = { ...blank() };
    brief.world = { setting: { era: 'modern_day', place: '', specifics: '' }, tone: brief.world.tone };
    const gaps = computeBriefGaps(brief);
    expect(gaps).not.toContain('world.setting.era');
    expect(gaps).toContain('world.setting.place');
  });

  it('у пустой карточки перечисляет её поля по отдельности, а не весь каст', () => {
    const card = newLoveInterest('slow_burn');
    const brief = { ...blank(), loveInterests: [card] };
    const gaps = computeBriefGaps(brief);

    expect(gaps).not.toContain('loveInterests');
    expect(gaps).toContain(`loveInterests[${card.id}].name`);
    expect(gaps).toContain(`loveInterests[${card.id}].speechPattern`);
    expect(gaps).toContain(`loveInterests[${card.id}].personality.traits`);
    // Возраст, архетип и «незнакомы» — осмысленные значения, а не пробелы.
    expect(gaps).not.toContain(`loveInterests[${card.id}].age`);
    expect(gaps).not.toContain(`loveInterests[${card.id}].archetype`);
    expect(gaps).not.toContain(`loveInterests[${card.id}].preExistingRelationship`);
  });

  it('null в archetypeSpecifics — пробел только если архетип требует полей', () => {
    const withoutSchema = { ...newLoveInterest('slow_burn'), archetypeSpecifics: null };
    const withSchema = { ...newLoveInterest('forbidden'), archetypeSpecifics: null };
    const brief = { ...blank(), loveInterests: [withoutSchema, withSchema] };
    const gaps = computeBriefGaps(brief);

    expect(gaps).not.toContain(`loveInterests[${withoutSchema.id}].archetypeSpecifics`);
    expect(gaps).toContain(`loveInterests[${withSchema.id}].archetypeSpecifics`);
  });
});

describe('isGapStillEmpty', () => {
  it('видит, что поле заполнили после сбора пробелов', () => {
    const brief = blank();
    expect(isGapStillEmpty(brief, 'world.tone.mood')).toBe(true);

    const edited = { ...brief, world: { ...brief.world, tone: { ...brief.world.tone, mood: 'noir' } } };
    expect(isGapStillEmpty(edited, 'world.tone.mood')).toBe(false);
  });

  it('на исчезнувшей карточке не падает', () => {
    expect(isGapStillEmpty(blank(), 'loveInterests[ghost].name')).toBe(true);
  });
});
