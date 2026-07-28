import { describe, expect, it } from 'vitest';

import { BRIEF_DEFAULTS, resolveBrief, resolveScale } from './briefDefaults';
import { blankBrief } from './briefStore';
import { SAMPLE_BRIEF } from './sampleBrief';

describe('resolveScale', () => {
  it('«авто» превращается в дефолты — арифметика пайплайна null не увидит', () => {
    expect(resolveScale(blankBrief().scale)).toEqual({
      acts: BRIEF_DEFAULTS.acts,
      targetDurationMinutes: BRIEF_DEFAULTS.targetDurationMinutes,
      branchingDensity: BRIEF_DEFAULTS.branchingDensity,
      commonRouteShare: BRIEF_DEFAULTS.commonRouteShare,
      branchPointBudget: BRIEF_DEFAULTS.branchPointBudget,
    });
  });

  it('заданное автором проходит насквозь', () => {
    expect(resolveScale({ ...blankBrief().scale, acts: 7, commonRouteShare: 0.15 })).toMatchObject({
      acts: 7,
      commonRouteShare: 0.15,
      // Незаданное рядом всё равно берёт дефолт.
      targetDurationMinutes: BRIEF_DEFAULTS.targetDurationMinutes,
    });
  });

  it('дефолты совпадают с образцом — поведение старых проектов не поехало', () => {
    expect(resolveScale(blankBrief().scale)).toEqual(SAMPLE_BRIEF.scale);
  });
});

describe('resolveBrief', () => {
  it('разрешает формат, тон и протагониста', () => {
    const resolved = resolveBrief(blankBrief());

    expect(resolved.format).toBe(BRIEF_DEFAULTS.format);
    expect(resolved.world.tone.intensity).toBe(BRIEF_DEFAULTS.intensity);
    expect(resolved.protagonist.gender).toBe(BRIEF_DEFAULTS.gender);
    expect(resolved.protagonist.voiceStyle).toBe(BRIEF_DEFAULTS.voiceStyle);
  });

  it('пустой список концовок — тоже «авто»: без концовок история недоигрываема', () => {
    expect(resolveBrief(blankBrief()).endingsProfile).toEqual(BRIEF_DEFAULTS.endingsProfile);
  });

  it('заполненный бриф не меняется', () => {
    const resolved = resolveBrief(SAMPLE_BRIEF);

    expect(resolved.format).toBe(SAMPLE_BRIEF.format);
    expect(resolved.scale).toEqual(SAMPLE_BRIEF.scale);
    expect(resolved.endingsProfile).toEqual(SAMPLE_BRIEF.endingsProfile);
    expect(resolved.loveInterests).toBe(SAMPLE_BRIEF.loveInterests);
  });
});
