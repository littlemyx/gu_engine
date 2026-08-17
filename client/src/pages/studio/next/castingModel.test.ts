import { describe, expect, it } from 'vitest';

import { acceptsKind, deriveCasting, roleGapPrefix } from './castingModel';

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

describe('роль, отданная генератору', () => {
  it('пустая роль с пометкой ждёт генерации, но закрытой не считается', () => {
    const { roles, assigned, unassigned } = deriveCasting({
      brief,
      castSlots: {},
      castIntent: { 'li:yuki': 'generate' },
    });
    const li = roles.find(r => r.slot === 'LI-2');

    expect(li?.cast).toBe('generated');
    expect(li?.castLabel).toBe('ждёт генерации');
    expect(assigned).toBe(3);
    expect(unassigned.map(r => r.slot)).toContain('LI-2');
  });

  it('имя, пришедшее по пометке, подписано «сгенерировано», а не «руками»', () => {
    const { roles } = deriveCasting({ brief, castSlots: {}, castIntent: { 'li:kira': 'generate' } });
    const li = roles.find(r => r.slot === 'LI-1');

    expect(li?.cast).toBe('generated');
    expect(li?.castLabel).toBe('сгенерировано');
  });

  it('префаб перебивает пометку: закрытой роли генератор не нужен', () => {
    const { roles } = deriveCasting({
      brief,
      castSlots: { 'li:yuki': ref('Юки') },
      castIntent: { 'li:yuki': 'generate' },
    });

    expect(roles.find(r => r.slot === 'LI-2')?.cast).toBe('linked');
  });
});

describe('какие поля брифа генерировать под роль', () => {
  it('у каждой роли свой префикс, у аудио — ничего', () => {
    const { roles } = deriveCasting({ brief, castSlots: {} });
    const by = (slot: string) => roleGapPrefix(roles.find(r => r.slot === slot)!);

    expect(by('LI-1')).toBe('loveInterests[kira].');
    expect(by('Протагонист')).toBe('protagonist.');
    expect(by('Мир')).toBe('world.');
    // Аудио-набор в брифе не описан — генерировать под него нечего.
    expect(by('Аудио · пакет оформления')).toBeNull();
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
