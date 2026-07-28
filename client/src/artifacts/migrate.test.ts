import { describe, expect, it } from 'vitest';

import { deriveAllFreshness } from './freshness';
import { migrateExisting, orphans, reconcile } from './migrate';
import { topoOrder } from './stageGraph';
import { onLock, onUserEdit } from './transitions';

import type { PresentItems } from './migrate';

const STORY: PresentItems = {
  brief: [''],
  cast: [''],
  world: [''],
  calendar: [''],
  spine: [''],
  schedule: [''],
  dialogue_units: ['u1', 'u2'],
};

const OWNS = { 'brief/': { logline: 'лето' } };

describe('миграция существующей истории', () => {
  it('заводит артефакт на каждый элемент, что лежит в сторах', () => {
    const index = migrateExisting(STORY, OWNS);

    expect(Object.keys(index).sort()).toEqual(
      [
        'brief/',
        'calendar/',
        'cast/',
        'dialogue_units/u1',
        'dialogue_units/u2',
        'schedule/',
        'spine/',
        'world/',
      ].sort(),
    );
  });

  it('оплаченное не протухает от миграции — всё свежее сразу', () => {
    const index = migrateExisting(STORY, OWNS);
    const freshness = deriveAllFreshness(index, topoOrder(), OWNS);

    expect(Object.values(freshness).every(f => f === 'fresh')).toBe(true);
  });

  it('готовая история считается принятой автором, а не предложенной машиной', () => {
    const index = migrateExisting(STORY, OWNS);

    expect(Object.values(index).every(m => m.ownership === 'approved')).toBe(true);
  });

  it('первый дубль помечен восстановленным: его никто в этой сессии не генерировал', () => {
    const index = migrateExisting(STORY, OWNS);

    expect(index['spine/'].takes).toEqual([expect.objectContaining({ n: 1, origin: 'restored' })]);
  });

  it('после миграции правка брифа протухает всю историю', () => {
    const index = migrateExisting(STORY, OWNS);
    const after = deriveAllFreshness(index, topoOrder(), { 'brief/': { logline: 'зима' } });

    expect(after['dialogue_units/u1']).toBe('stale');
  });
});

describe('дозаведение', () => {
  it('добавляет то, чего в учёте не было', () => {
    const index = migrateExisting({ brief: [''] }, OWNS);
    const next = reconcile(index, { brief: [''], cast: [''] }, OWNS);

    expect(next['cast/']).toBeTruthy();
  });

  it('не трогает уже учтённое: владение и дубли переживают дозаведение', () => {
    const index = migrateExisting(STORY, OWNS);
    index['spine/'] = onLock(onUserEdit(index['spine/'], 'fp-manual'));

    const next = reconcile(index, { ...STORY, ending_prose: ['e1'] }, OWNS);

    expect(next['spine/'].ownership).toBe('locked');
    expect(next['spine/'].fingerprint).toBe('fp-manual');
    expect(next['ending_prose/e1']).toBeTruthy();
  });

  it('ничего нового — тот же объект, без лишней перерисовки', () => {
    const index = migrateExisting(STORY, OWNS);
    expect(reconcile(index, STORY, OWNS)).toBe(index);
  });
});

describe('сироты', () => {
  it('находит учёт без данных', () => {
    const index = migrateExisting(STORY, OWNS);
    const alive = { ...STORY, dialogue_units: ['u1'] };

    expect(orphans(index, alive)).toEqual(['dialogue_units/u2']);
  });

  it('на полной истории сирот нет', () => {
    expect(orphans(migrateExisting(STORY, OWNS), STORY)).toEqual([]);
  });
});
