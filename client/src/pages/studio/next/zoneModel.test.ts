import { describe, expect, it } from 'vitest';

import { ALL_STAGES } from '@/artifacts/stageGraph';

import { DEFAULT_ZONE, ZONES, nextZone, zoneById, zoneLabel, zoneOfStage } from './zoneModel';

describe('зоны', () => {
  it('пронумерованы подряд от нуля', () => {
    expect(ZONES.map(z => z.n)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('каждая стадия конвейера принадлежит ровно одной зоне', () => {
    for (const stage of ALL_STAGES) {
      const owners = ZONES.filter(z => z.stages.includes(stage));
      expect(owners, `стадия ${stage}`).toHaveLength(1);
    }
  });

  it('превью артефактов не производит: это взгляд, а не шаг сборки', () => {
    expect(zoneById('preview').stages).toEqual([]);
  });

  it('подпись переключателя — номер и имя', () => {
    expect(zoneLabel(zoneById('idea'))).toBe('0 · Замысел');
  });

  it('умолчание — первая зона', () => {
    expect(DEFAULT_ZONE).toBe(ZONES[0].id);
  });
});

describe('переходы', () => {
  it('следующая зона идёт по номеру', () => {
    expect(nextZone('idea')?.id).toBe('structure');
  });

  it('за последней зоной ничего нет', () => {
    expect(nextZone('release')).toBeUndefined();
  });

  it('стадия находит свою зону', () => {
    expect(zoneOfStage('spine')?.id).toBe('structure');
    expect(zoneOfStage('image')?.id).toBe('media');
  });
});
