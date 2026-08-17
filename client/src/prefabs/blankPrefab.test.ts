import { describe, expect, it } from 'vitest';

import { blankPrefab } from './blankPrefab';

describe('префаб, заведённый вручную', () => {
  it('персонаж носит своё имя и пустое содержимое', () => {
    const prefab = blankPrefab('character', 'Ада', 'Лето', 1000);

    expect(prefab.kind).toBe('character');
    expect(prefab.name).toBe('Ада');
    if (prefab.kind !== 'character') throw new Error('ожидался персонаж');
    // Имя дублируется в карточку: она и есть содержимое префаба-персонажа.
    expect(prefab.payload.li.name).toBe('Ада');
    expect(prefab.payload.sprite).toBeNull();
  });

  it('мир заводится без локаций — их дорисуют позже', () => {
    const prefab = blankPrefab('world', 'Кампус', 'Лето', 1000);

    if (prefab.kind !== 'world') throw new Error('ожидался мир');
    expect(prefab.payload.worldModel.locations).toEqual([]);
    expect(prefab.payload.images).toEqual({});
  });

  it('аудио-набор заводится пустым', () => {
    const prefab = blankPrefab('audio_set', 'Лето FM', 'Лето', 1000);

    if (prefab.kind !== 'audio_set') throw new Error('ожидался аудио-набор');
    expect(prefab.payload.base).toBeNull();
    expect(prefab.payload.moodBeds).toEqual({});
  });

  it('версию и счётчик применений проставляет библиотека, а не конструктор', () => {
    const prefab = blankPrefab('character', 'Ада', 'Лето', 1000);

    expect(prefab.version).toBe(0);
    expect(prefab.usedIn).toBe(0);
    expect(prefab.forkOf).toBeNull();
  });
});
