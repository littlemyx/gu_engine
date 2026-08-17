import { describe, expect, it } from 'vitest';

import { computeBriefGaps } from '@/narrative/briefGaps';
import { blankBrief } from '@/narrative/briefStore';
import { newLoveInterest } from '@/narrative/loveInterestCard';

import { deriveBriefZone } from './briefZoneModel';

import type { Brief } from '@/narrative/types';
import type { BriefCardId, BriefZoneModel } from './briefZoneModel';

const card = (model: BriefZoneModel, id: BriefCardId) => {
  const found = model.cards.find(c => c.id === id);
  if (!found) throw new Error(`карточки ${id} нет в модели`);
  return found;
};

/** Бриф с заполненным сеттингом — остальное как у пустого. */
function withSetting(): Brief {
  const brief = blankBrief();
  return {
    ...brief,
    world: { ...brief.world, setting: { era: 'modern_day', place: 'university', specifics: 'осень, дожди' } },
  };
}

describe('deriveBriefZone: состояния карточек', () => {
  it('пустой бриф: текстовые группы пустые, «авто»-габариты — авто', () => {
    const model = deriveBriefZone({ brief: blankBrief(), generating: false });

    expect(card(model, 'setting').state).toBe('empty');
    expect(card(model, 'artstyle').state).toBe('empty');
    expect(card(model, 'cast').state).toBe('empty');
    // Всё в этих группах допускает null = «решит генератор».
    expect(card(model, 'format').state).toBe('auto');
    expect(card(model, 'branching').state).toBe('auto');
    expect(card(model, 'protagonist').state).toBe('auto');
  });

  it('заполненная группа — «готово», значения собраны в сводку', () => {
    const model = deriveBriefZone({ brief: withSetting(), generating: false });

    const setting = card(model, 'setting');
    expect(setting.state).toBe('done');
    expect(setting.value).toContain('modern_day');
    expect(setting.value).toContain('осень, дожди');
  });

  it('во время генерации пробельные карточки «заполняются», готовые — нет', () => {
    const model = deriveBriefZone({ brief: withSetting(), generating: true });

    expect(card(model, 'tone').state).toBe('filling');
    expect(card(model, 'cast').state).toBe('filling');
    // Сеттинг заполнен целиком — генератор в него не пишет.
    expect(card(model, 'setting').state).toBe('done');
  });

  it('каст с недозаполненной карточкой при генерации тоже «заполняется»', () => {
    const brief: Brief = { ...blankBrief(), loveInterests: [newLoveInterest()] };
    const model = deriveBriefZone({ brief, generating: true });

    expect(card(model, 'cast').state).toBe('filling');
  });
});

describe('deriveBriefZone: чек-лист и готовность', () => {
  it('пустой бриф не готов: пустой каст — проблема валидации', () => {
    const model = deriveBriefZone({ brief: blankBrief(), generating: false });

    expect(model.briefReady).toBe(false);
    expect(model.readiness.some(r => r.state === 'problem')).toBe(true);
  });

  it('валидный каст закрывает готовность брифа', () => {
    const brief: Brief = { ...blankBrief(), loveInterests: [newLoveInterest()] };
    const model = deriveBriefZone({ brief, generating: false });

    expect(model.briefReady).toBe(true);
    expect(model.readiness.every(r => r.state !== 'problem')).toBe(true);
  });

  it('строка заполненной группы закрыта и несёт сводку', () => {
    const model = deriveBriefZone({ brief: withSetting(), generating: false });

    const row = model.readiness.find(r => r.text.startsWith('сеттинг'));
    expect(row?.state).toBe('done');
    expect(row?.text).toContain('modern_day');
  });

  it('«авто»-группа в чек-листе ожидает и говорит, кто решит', () => {
    const model = deriveBriefZone({ brief: blankBrief(), generating: false });

    const row = model.readiness.find(r => r.text.startsWith('формат'));
    expect(row?.state).toBe('waiting');
    expect(row?.text).toContain('авто');
  });
});

describe('deriveBriefZone: счётчик пробелов', () => {
  it('та же цифра, что видит генератор брифа', () => {
    const brief = withSetting();
    const model = deriveBriefZone({ brief, generating: false });

    expect(model.gapCount).toBe(computeBriefGaps(brief).length);
  });
});
