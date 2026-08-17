import { describe, expect, it } from 'vitest';

import { deriveAllFreshness } from './freshness';
import { healIsolatedFingerprints, migrateExisting, orphans, reconcile, refreshFingerprints } from './migrate';
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

  // Регрессия E2E 2026-08-17: изолированный расчёт отпечатков новичков
  // сворачивал входы в «ø», и сгенерированные после прогона медиа рождались
  // протухшими навсегда — 11 stale-позиций при свежих предках.
  it('дозаведённое рождается свежим: входы берутся из полного индекса', () => {
    const index = migrateExisting(STORY, OWNS);
    const next = reconcile(index, { ...STORY, image: ['loc:library'] }, OWNS);

    const fresh = deriveAllFreshness(next, topoOrder(), OWNS);
    expect(fresh['image/loc:library']).toBe('fresh');
    // И протухает от настоящей правки предка, как все.
    const after = deriveAllFreshness(next, topoOrder(), { ...OWNS, 'brief/': { logline: 'зима' } });
    expect(after['image/loc:library']).toBe('stale');
  });
});

describe('лечение изолированных отпечатков', () => {
  it('рождённое старым reconcile лечится на честный отпечаток', () => {
    const index = migrateExisting(STORY, OWNS);
    // Эмулируем старый баг: картинка записана с отпечатком «без предков».
    const broken = { ...index, ...migrateExisting({ image: ['loc:library'] }, OWNS) };
    expect(deriveAllFreshness(broken, topoOrder(), OWNS)['image/loc:library']).toBe('stale');

    const healed = healIsolatedFingerprints(broken, OWNS);
    expect(deriveAllFreshness(healed, topoOrder(), OWNS)['image/loc:library']).toBe('fresh');
  });

  it('настоящее протухание не амнистируется', () => {
    const index = migrateExisting(STORY, { 'brief/': { logline: 'зима' } });
    const healed = healIsolatedFingerprints(index, OWNS);
    const after = deriveAllFreshness(healed, topoOrder(), OWNS);

    expect(after['brief/']).toBe('stale');
    expect(after['spine/']).toBe('stale');
  });

  it('здоровый индекс — тот же объект', () => {
    const index = migrateExisting(STORY, OWNS);
    expect(healIsolatedFingerprints(index, OWNS)).toBe(index);
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

describe('освежение отпечатков при смене формулы owns', () => {
  const OLD = OWNS;
  const NEW = { ...OWNS, 'world/': { locations: ['кампус'] } };

  it('свежее по старой формуле остаётся свежим по новой', () => {
    const index = migrateExisting(STORY, OLD);

    const refreshed = refreshFingerprints(index, OLD, NEW);
    const after = deriveAllFreshness(refreshed, topoOrder(), NEW);

    expect(Object.values(after).every(f => f === 'fresh')).toBe(true);
  });

  it('протухшее по старой формуле не амнистируется', () => {
    const index = migrateExisting(STORY, { 'brief/': { logline: 'зима' } });

    const refreshed = refreshFingerprints(index, OLD, NEW);
    const after = deriveAllFreshness(refreshed, topoOrder(), NEW);

    // Бриф правился до апдейта: он и его потомки протухли по-настоящему.
    expect(after['brief/']).toBe('stale');
    expect(after['spine/']).toBe('stale');
  });

  it('владение и дубли не трогает — это перезапись записи, а не работа', () => {
    const index = migrateExisting(STORY, OLD);
    index['spine/'] = onLock(index['spine/']);

    const refreshed = refreshFingerprints(index, OLD, NEW);

    expect(refreshed['spine/'].ownership).toBe('locked');
    expect(refreshed['spine/'].takes).toEqual(index['spine/'].takes);
    // Запертый тоже освежается: иначе замок превратился бы в конфликт на пустом месте.
    const after = deriveAllFreshness(refreshed, topoOrder(), NEW);
    expect(after['spine/']).toBe('fresh');
  });

  it('одинаковые формулы — тот же объект', () => {
    const index = migrateExisting(STORY, OLD);
    expect(refreshFingerprints(index, OLD, OLD)).toBe(index);
  });
});
