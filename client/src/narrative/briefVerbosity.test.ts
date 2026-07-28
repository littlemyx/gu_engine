import { describe, expect, it } from 'vitest';

import { briefFieldSpec, liCardFieldSpec } from './briefFields';
import { buildBriefFillRequestPayload } from './buildBriefFillRequest';
import { clampVerbosity, scaledTarget, VERBOSITY_DEFAULT } from './briefVerbosity';
import { SAMPLE_BRIEF } from './sampleBrief';

const specifics = briefFieldSpec('world.setting.specifics')!;
const era = briefFieldSpec('world.setting.era')!;
const cast = briefFieldSpec('loveInterests')!;

describe('clampVerbosity', () => {
  it('держит значение в шкале и отбивает мусор', () => {
    expect(clampVerbosity(0)).toBe(1);
    expect(clampVerbosity(9)).toBe(5);
    expect(clampVerbosity(3.4)).toBe(3);
    expect(clampVerbosity(Number.NaN)).toBe(VERBOSITY_DEFAULT);
  });
});

describe('scaledTarget', () => {
  it('на середине шкалы равен базовому размеру поля', () => {
    expect(scaledTarget(specifics, VERBOSITY_DEFAULT)).toBe(specifics.baseSize);
  });

  it('растёт монотонно с подробностью', () => {
    const targets = [1, 2, 3, 4, 5].map(v => scaledTarget(specifics, v));
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(targets[0]).toBeLessThan(targets[4]);
  });

  it('никогда не опускается ниже одного слова', () => {
    expect(scaledTarget(liCardFieldSpec('personality.fears')!, 1)).toBeGreaterThanOrEqual(1);
  });

  it('поля-структуры от ползунка не зависят: размер каста, палитра, токены', () => {
    expect(scaledTarget(cast, 1)).toBe(cast.baseSize);
    expect(scaledTarget(cast, 5)).toBe(cast.baseSize);
    expect(scaledTarget(era, 5)).toBe(era.baseSize);
  });
});

describe('buildBriefFillRequestPayload', () => {
  it('обогащает каждый пробел описанием и объёмом', () => {
    const payload = buildBriefFillRequestPayload(SAMPLE_BRIEF, ['world.setting.specifics'], null, 5);

    expect(payload.gaps).toEqual([
      {
        path: 'world.setting.specifics',
        description: specifics.description,
        target: scaledTarget(specifics, 5),
      },
    ]);
  });

  it('понимает пути полей карточки', () => {
    const payload = buildBriefFillRequestPayload(SAMPLE_BRIEF, ['loveInterests[kira].speechPattern'], null, 3);

    expect(payload.gaps[0].path).toBe('loveInterests[kira].speechPattern');
    expect(payload.gaps[0].description).toBe(liCardFieldSpec('speechPattern')!.description);
  });

  it('выбрасывает пути, которых нет в каталоге', () => {
    expect(buildBriefFillRequestPayload(SAMPLE_BRIEF, ['world.выдумка'], null, 3).gaps).toEqual([]);
  });

  it('пустой список директив шлёт как null — стадии разбора не было', () => {
    expect(buildBriefFillRequestPayload(SAMPLE_BRIEF, [], [], 3).directives).toBeNull();
    expect(
      buildBriefFillRequestPayload(SAMPLE_BRIEF, [], [{ target: 'general', instruction: 'нуар' }], 3).directives,
    ).toHaveLength(1);
  });

  it('архетипы отдаёт обрезанными и все — новая карточка вольна выбрать любой', () => {
    const payload = buildBriefFillRequestPayload(SAMPLE_BRIEF, [], null, 3);

    expect(Object.keys(payload.archetypeProfiles)).toEqual([
      'slow_burn',
      'enemies_to_lovers',
      'forbidden',
      'mutual_pining',
    ]);
    expect(Object.keys(payload.archetypeProfiles.forbidden)).toEqual(['id', 'description', 'archetypeSpecificsSchema']);
  });
});
