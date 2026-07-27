import { describe, expect, it } from 'vitest';

import { isBlankBrief, useBriefStore } from './briefStore';
import { SAMPLE_BRIEF } from './sampleBrief';

/**
 * Гейт кнопки «Подставить образец» на экране пустого проекта: образец
 * заменяет бриф целиком, поэтому предлагать его можно только там, где терять
 * нечего.
 */
describe('isBlankBrief', () => {
  const blank = () => {
    useBriefStore.getState().resetToBlank();
    return useBriefStore.getState().brief;
  };

  it('пустой бриф после «Новый проект» — образец предлагать можно', () => {
    expect(isBlankBrief(blank())).toBe(true);
  });

  it('образцовый бриф — уже не пустой', () => {
    expect(isBlankBrief(SAMPLE_BRIEF)).toBe(false);
  });

  it('каст из одного персонажа запирает подстановку', () => {
    const brief = { ...blank(), loveInterests: [SAMPLE_BRIEF.loveInterests[0]] };
    expect(isBlankBrief(brief)).toBe(false);
  });

  it('начатый мир запирает подстановку — даже без каста', () => {
    const base = blank();
    const withPlace = { ...base, world: { ...base.world, setting: { ...base.world.setting, place: 'порт' } } };
    expect(isBlankBrief(withPlace)).toBe(false);

    const withMood = { ...base, world: { ...base.world, tone: { ...base.world.tone, mood: 'bittersweet' } } };
    expect(isBlankBrief(withMood)).toBe(false);

    const withThemes = { ...base, world: { ...base.world, tone: { ...base.world.tone, themes: ['first_love'] } } };
    expect(isBlankBrief(withThemes)).toBe(false);
  });

  it('заданный арт-стиль запирает подстановку', () => {
    const base = blank();
    expect(isBlankBrief({ ...base, artStyle: { ...base.artStyle, referenceDescriptor: 'акварель' } })).toBe(false);
  });
});
