import { describe, expect, it } from 'vitest';

import { acceptsKind, deriveCasting } from './castingModel';

import type { Brief } from '@/narrative/types';
import type { CastRef } from '../studioProjectStore';

const brief = {
  // У протагониста имени нет: есть плейсхолдер, куда игрок впишет своё.
  protagonist: { namePlaceholder: '{player_name}' },
  loveInterests: [
    { id: 'kira', name: 'Кира' },
    { id: 'yuki', name: '' },
  ],
  world: { setting: { place: 'университет', era: 'наши дни' } },
} as unknown as Brief;

const ref = (name: string, mode: CastRef['mode'] = 'linked'): CastRef => ({
  prefabId: 'p1',
  version: 2,
  mode,
  name,
  snapshot: {},
});

describe('кастинг-стол', () => {
  it('роли берутся из брифа: сколько LI задано, столько и слотов', () => {
    const { roles } = deriveCasting({ brief, castSlots: {} });

    expect(roles.map(r => r.slot)).toEqual(['Протагонист', 'LI-1', 'LI-2', 'Мир', 'Аудио · пакет оформления']);
  });

  it('имя из брифа без префаба — роль написана руками', () => {
    const { roles } = deriveCasting({ brief, castSlots: {} });

    expect(roles.find(r => r.slot === 'LI-1')?.cast).toBe('manual');
    expect(roles.find(r => r.slot === 'LI-1')?.name).toBe('Кира');
  });

  it('LI без имени остаётся незакрытой ролью, а не пустой строкой', () => {
    const { roles, unassigned } = deriveCasting({ brief, castSlots: {} });

    expect(roles.find(r => r.slot === 'LI-2')?.cast).toBe('unassigned');
    expect(unassigned.map(r => r.slot)).toContain('LI-2');
  });

  it('назначенный префаб перебивает имя из брифа и называет версию', () => {
    const { roles } = deriveCasting({ brief, castSlots: { 'li:kira': ref('Кира-из-библиотеки') } });
    const li = roles.find(r => r.slot === 'LI-1');

    expect(li?.cast).toBe('linked');
    expect(li?.name).toBe('Кира-из-библиотеки');
    expect(li?.castLabel).toContain('v2');
  });

  it('форк видно на карточке, не открывая инспектор', () => {
    const { roles } = deriveCasting({ brief, castSlots: { 'li:kira': ref('Кира', 'forked') } });

    expect(roles.find(r => r.slot === 'LI-1')?.castLabel).toContain('правлен');
  });

  it('считает закрытые роли', () => {
    const empty = deriveCasting({ brief, castSlots: {} });
    expect(empty.assigned).toBe(3); // протагонист, LI-1, мир

    const cast = deriveCasting({ brief, castSlots: { 'li:yuki': ref('Юки'), audio: ref('Лето FM') } });
    expect(cast.assigned).toBe(5);
    expect(cast.unassigned).toEqual([]);
  });

  it('на пустом брифе все роли не назначены и ничего не падает', () => {
    const { roles, assigned } = deriveCasting({ brief: {} as Brief, castSlots: {} });

    expect(assigned).toBe(0);
    expect(roles.every(r => r.cast === 'unassigned')).toBe(true);
  });
});

describe('что чем закрывается', () => {
  it('мир — миром, аудио — набором, остальное — персонажем', () => {
    expect(acceptsKind('world')).toBe('world');
    expect(acceptsKind('audio')).toBe('audio_set');
    expect(acceptsKind('protagonist')).toBe('character');
    expect(acceptsKind('loveInterest')).toBe('character');
  });
});
