import { describe, expect, it } from 'vitest';

import { recomputeAll, stableString } from './fingerprint';
import { deriveAllFreshness, deriveFreshness, summarize } from './freshness';
import { topoOrder } from './stageGraph';
import { onGenerated } from './transitions';

import type { ArtifactIndex } from './types';
import { artifactKey, emptyIndexEntry } from './testSupport';

/**
 * Собрать индекс так, как его собрал бы прогон: завести все артефакты, затем
 * записать каждому отпечаток, посчитанный по текущему состоянию мира.
 */
function generate(stages: string[], owns: Record<string, unknown> = {}): ArtifactIndex {
  const index: ArtifactIndex = {};
  for (const stage of stages) index[artifactKey(stage)] = emptyIndexEntry(artifactKey(stage));

  const current = recomputeAll(index, topoOrder(), owns);
  for (const key of Object.keys(index)) {
    index[key] = onGenerated(index[key], { fingerprint: current[key] });
  }
  return index;
}

describe('deriveFreshness', () => {
  it('несуществующий артефакт — missing', () => {
    expect(deriveFreshness(undefined, 'fp')).toBe('missing');
    expect(deriveFreshness(emptyIndexEntry('spine/'), 'fp')).toBe('missing');
  });

  it('совпал отпечаток — fresh, разошёлся — stale', () => {
    const meta = { ...emptyIndexEntry('spine/'), fingerprint: 'fp' };
    expect(deriveFreshness(meta, 'fp')).toBe('fresh');
    expect(deriveFreshness(meta, 'fp-other')).toBe('stale');
  });
});

describe('каскад протухания', () => {
  const CHAIN = ['brief', 'cast', 'world', 'calendar', 'spine', 'schedule', 'dialogue_units'];

  it('сразу после прогона всё свежее', () => {
    const index = generate(CHAIN, { 'brief/': { logline: 'лето' } });
    const fresh = deriveAllFreshness(index, topoOrder(), { 'brief/': { logline: 'лето' } });

    expect(Object.values(fresh).every(f => f === 'fresh')).toBe(true);
  });

  it('правка брифа протухает всю цепочку вниз', () => {
    const index = generate(CHAIN, { 'brief/': { logline: 'лето' } });
    const after = deriveAllFreshness(index, topoOrder(), { 'brief/': { logline: 'зима' } });

    for (const stage of CHAIN) expect(after[artifactKey(stage)]).toBe('stale');
  });

  it('протухание доезжает до самого низа, а не только до соседа', () => {
    const index = generate(CHAIN, { 'brief/': { logline: 'лето' } });
    const after = deriveAllFreshness(index, topoOrder(), { 'brief/': { logline: 'зима' } });

    expect(after['dialogue_units/']).toBe('stale');
  });

  it('пересборка брифа тем же содержимым ничего не протухает', () => {
    const own = { 'brief/': { logline: 'лето' } };
    const index = generate(CHAIN, own);
    const again = deriveAllFreshness(index, topoOrder(), own);

    expect(Object.values(again).every(f => f === 'fresh')).toBe(true);
  });
});

describe('stableString', () => {
  it('не зависит от порядка ключей', () => {
    expect(stableString({ a: 1, b: 2 })).toBe(stableString({ b: 2, a: 1 }));
  });

  it('различает разные значения', () => {
    expect(stableString({ a: 1 })).not.toBe(stableString({ a: 2 }));
  });

  it('пустоту и отсутствие пишет одинаково', () => {
    expect(stableString(null)).toBe(stableString(undefined));
  });
});

describe('summarize', () => {
  it('считает сводку зоны', () => {
    const freshness = { 'a/': 'fresh', 'b/': 'stale', 'c/': 'missing' } as const;
    expect(summarize(freshness, ['a/', 'b/', 'c/'])).toEqual({ fresh: 1, stale: 1, missing: 1, total: 3 });
  });

  it('неизвестный ключ считается несозданным', () => {
    expect(summarize({}, ['x/'])).toEqual({ fresh: 0, stale: 0, missing: 1, total: 1 });
  });
});
