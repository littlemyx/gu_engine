import { describe, expect, it } from 'vitest';

import { migrateExisting } from '@/artifacts/migrate';
import { onLock, onUserEdit } from '@/artifacts/transitions';

import { buildCallSheet, consequencesOf, runPlanOf } from './callSheet';

import type { StageCost } from './callSheet';
import type { PresentItems } from '@/artifacts/migrate';

const STORY: PresentItems = { brief: [''], cast: [''], world: [''], calendar: [''], spine: [''] };
const COST: StageCost = { brief: 0, cast: 0.2, world: 0.3, calendar: 0.5, spine: 1.2 };
const LETO = { 'brief/': { logline: 'лето' } };
const ZIMA = { 'brief/': { logline: 'зима' } };

describe('колл-щит', () => {
  it('на свежей истории платить не за что', () => {
    const sheet = buildCallSheet({ index: migrateExisting(STORY, LETO), owns: LETO, cost: COST });

    expect(sheet.generate).toEqual([]);
    expect(sheet.total).toBe(0);
    expect(sheet.positions.every(p => p.action === 'cached')).toBe(true);
  });

  it('правка брифа выставляет счёт за всё, что от него зависит', () => {
    const sheet = buildCallSheet({ index: migrateExisting(STORY, LETO), owns: ZIMA, cost: COST });

    expect(sheet.generate.map(p => p.stage).sort()).toEqual(['brief', 'calendar', 'cast', 'spine', 'world']);
    expect(sheet.total).toBeCloseTo(2.2);
  });

  it('force пересобирает даже свежее', () => {
    const sheet = buildCallSheet({ index: migrateExisting(STORY, LETO), owns: LETO, cost: COST, force: true });

    expect(sheet.generate).toHaveLength(5);
  });
});

describe('замок', () => {
  const locked = () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onLock(index['spine/']);
    return index;
  };

  it('свежий запертый обходится стороной', () => {
    const sheet = buildCallSheet({ index: locked(), owns: LETO, cost: COST });

    expect(sheet.positions.find(p => p.stage === 'spine')?.action).toBe('locked-skip');
  });

  it('замок держит и против force — иначе кнопка «пересобрать всё» стирала бы удачное', () => {
    const sheet = buildCallSheet({ index: locked(), owns: LETO, cost: COST, force: true });

    expect(sheet.generate.map(p => p.stage)).not.toContain('spine');
  });

  it('протухший запертый требует решения, а не переписывается молча', () => {
    const sheet = buildCallSheet({ index: locked(), owns: ZIMA, cost: COST });

    expect(sheet.decisions.map(p => p.key)).toContain('spine/');
    expect(sheet.generate.map(p => p.key)).not.toContain('spine/');
  });
});

describe('авторское', () => {
  it('протухшее авторское не переписывается, а выносится в решения', () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onUserEdit(index['spine/'], index['spine/'].fingerprint ?? '');

    const sheet = buildCallSheet({ index, owns: ZIMA, cost: COST });

    expect(sheet.decisions.map(p => p.key)).toContain('spine/');
  });

  it('свежее авторское просто берётся как есть', () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onUserEdit(index['spine/'], index['spine/'].fingerprint ?? '');

    const sheet = buildCallSheet({ index, owns: LETO, cost: COST });

    expect(sheet.positions.find(p => p.key === 'spine/')?.action).toBe('cached');
  });
});

describe('подписанная смета → план прогона', () => {
  /** Запертый хребет протух от правки брифа — прогон требует решения. */
  const conflicted = () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onLock(index['spine/']);
    return buildCallSheet({ index, owns: ZIMA, cost: COST });
  };

  it('«оставить моё» прогон обходит и запоминает как решённое', () => {
    const plan = runPlanOf(conflicted(), { 'spine/': 'моё' });

    expect(plan.skip).toContain('spine/');
    expect(plan.keepFresh).toEqual(['spine/']);
    expect(plan.force).toEqual([]);
  });

  it('«дубль» уходит на пересчёт — и только он', () => {
    const plan = runPlanOf(conflicted(), { 'spine/': 'дубль' });

    expect(plan.force).toEqual(['spine/']);
    expect(plan.skip).not.toContain('spine/');
    expect(plan.keepFresh).toEqual([]);
  });

  // Свежий запертый решения не требует: он обходится молча, тем же списком.
  it('запертое едет в план само, без решения автора', () => {
    const index = migrateExisting(STORY, LETO);
    index['cast/'] = onLock(index['cast/']);
    const plan = runPlanOf(buildCallSheet({ index, owns: LETO, cost: COST }), {});

    expect(plan.skip).toEqual(['cast/']);
    expect(plan.keepFresh).toEqual([]);
  });
});

describe('превью последствий', () => {
  it('показывает, во что обойдётся правка входа', () => {
    const index = migrateExisting(STORY, LETO);
    const before = { index, owns: LETO, cost: COST };
    const after = { index, owns: ZIMA, cost: COST };

    const { extra, cost } = consequencesOf(before, after);

    expect(extra.map(p => p.stage).sort()).toEqual(['brief', 'calendar', 'cast', 'spine', 'world']);
    expect(cost).toBeCloseTo(2.2);
  });

  it('правка, ничего не меняющая, ничего и не стоит', () => {
    const index = migrateExisting(STORY, LETO);
    const same = { index, owns: LETO, cost: COST };

    expect(consequencesOf(same, same)).toEqual({ extra: [], decisions: [], cost: 0 });
  });
});
