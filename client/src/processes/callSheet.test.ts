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

describe('смета видит то, чего ещё нет', () => {
  const AHEAD: StageCost = { ...COST, schedule: 0.4 };

  it('нетронутая стадия попадает в смету позицией «вся стадия впереди»', () => {
    const sheet = buildCallSheet({
      index: migrateExisting(STORY, LETO),
      owns: LETO,
      cost: AHEAD,
      expectMissing: ['schedule'],
    });

    const schedule = sheet.generate.find(p => p.key === 'schedule/');
    expect(schedule).toMatchObject({ stage: 'schedule', freshness: 'missing', estCost: 0.4 });
    expect(sheet.total).toBeCloseTo(0.4);
  });

  it('начатая стадия заглушки не получает — её позиции уже в учёте', () => {
    const sheet = buildCallSheet({
      index: migrateExisting(STORY, LETO),
      owns: LETO,
      cost: AHEAD,
      expectMissing: ['spine', 'schedule'],
    });

    expect(sheet.positions.filter(p => p.stage === 'spine')).toHaveLength(1);
    expect(sheet.positions.find(p => p.key === 'spine/')?.action).toBe('cached');
  });

  it('пустой проект: смета обещает весь каскад, а не молчит', () => {
    const sheet = buildCallSheet({
      index: migrateExisting({ brief: [''] }, LETO),
      owns: LETO,
      cost: AHEAD,
      expectMissing: ['cast', 'world', 'calendar', 'spine', 'schedule'],
    });

    expect(sheet.generate.map(p => p.stage)).toEqual(['cast', 'world', 'calendar', 'spine', 'schedule']);
    expect(sheet.total).toBeCloseTo(0.2 + 0.3 + 0.5 + 1.2 + 0.4);
  });

  it('позиции отсортированы порядком исполнения, а не порядком индекса', () => {
    const sheet = buildCallSheet({ index: migrateExisting(STORY, ZIMA), owns: ZIMA, cost: COST });

    const stages = sheet.positions.map(p => p.stage);
    expect(stages.indexOf('brief')).toBeLessThan(stages.indexOf('cast'));
    expect(stages.indexOf('cast')).toBeLessThan(stages.indexOf('spine'));
  });
});

// Регрессия E2E 2026-08-17: после сбоя прогона смета обещала полные ≈$6.32 при
// живом кэше половины позиций — фактические «пропущено 4» выяснялись только
// после подписи и оплаты.
describe('смета видит черновик', () => {
  it('позиция из черновика планируется, но денег не стоит', () => {
    const sheet = buildCallSheet({
      index: migrateExisting(STORY, LETO),
      owns: ZIMA,
      cost: COST,
      draft: ['cast/', 'world/'],
    });

    const cast = sheet.positions.find(p => p.key === 'cast/');
    expect(cast?.action).toBe('generate');
    expect(cast?.inDraft).toBe(true);
    expect(cast?.estCost).toBe(0);
    // Итог — только за то, чего в черновике нет: calendar + spine (brief $0).
    expect(sheet.total).toBeCloseTo(1.7);
  });

  it('плейсхолдер нетронутой стадии покрывается элементами черновика', () => {
    const sheet = buildCallSheet({
      index: migrateExisting({ brief: [''] }, LETO),
      owns: LETO,
      cost: { ...COST, dialogue_units: 1.5 },
      expectMissing: ['cast', 'dialogue_units'],
      draft: ['dialogue_units/u1'],
    });

    expect(sheet.positions.find(p => p.key === 'dialogue_units/')?.inDraft).toBe(true);
    expect(sheet.positions.find(p => p.key === 'cast/')?.inDraft).toBeUndefined();
    expect(sheet.total).toBeCloseTo(0.2);
  });

  it('свежее черновиком не трогается: cached остаётся cached', () => {
    const sheet = buildCallSheet({
      index: migrateExisting(STORY, LETO),
      owns: LETO,
      cost: COST,
      draft: ['cast/'],
    });

    expect(sheet.positions.find(p => p.key === 'cast/')?.action).toBe('cached');
    expect(sheet.positions.find(p => p.key === 'cast/')?.inDraft).toBeUndefined();
  });
});

describe('смета с фидбеком: expectRedo пересобирает и свежее', () => {
  it('свежая позиция из redo-набора становится generate с ценой', () => {
    const sheet = buildCallSheet({
      index: migrateExisting(STORY, LETO),
      owns: LETO,
      cost: COST,
      expectRedo: ['spine/'],
    });

    const spine = sheet.positions.find(p => p.key === 'spine/');
    expect(spine?.action).toBe('generate');
    expect(spine?.estCost).toBeCloseTo(1.2);
    expect(sheet.total).toBeCloseTo(1.2);
  });

  it('redo побеждает черновик: затравка инвалидирует кэш, платить придётся', () => {
    const sheet = buildCallSheet({
      index: migrateExisting(STORY, ZIMA),
      owns: ZIMA,
      cost: COST,
      draft: ['spine/'],
      expectRedo: ['spine/'],
    });

    const spine = sheet.positions.find(p => p.key === 'spine/');
    expect(spine?.inDraft).toBeUndefined();
    expect(spine?.estCost).toBeCloseTo(1.2);
  });

  it('стадийный ключ redo покрывает все элементы стадии', () => {
    const sheet = buildCallSheet({
      index: migrateExisting({ ...STORY, dialogue_units: ['u1', 'u2'] }, LETO),
      owns: LETO,
      cost: { ...COST, dialogue_units: 1.5 },
      expectRedo: ['dialogue_units/'],
    });

    const units = sheet.positions.filter(p => p.stage === 'dialogue_units');
    expect(units).toHaveLength(2);
    expect(units.every(p => p.action === 'generate' && p.estCost === 1.5)).toBe(true);
    expect(sheet.total).toBeCloseTo(3.0);
  });

  it('замок сильнее фидбека: запертое redo не трогает', () => {
    const index = migrateExisting(STORY, LETO);
    index['spine/'] = onLock(index['spine/']);

    const sheet = buildCallSheet({ index, owns: LETO, cost: COST, expectRedo: ['spine/'] });
    expect(sheet.positions.find(p => p.key === 'spine/')?.action).toBe('locked-skip');
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
