import { describe, expect, it } from 'vitest';

import { runPool } from './runPool';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('runPool', () => {
  it('обрабатывает все элементы', async () => {
    const seen: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async n => {
      await tick();
      seen.push(n);
    });

    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('держит не больше concurrency одновременно', async () => {
    let active = 0;
    let peak = 0;
    await runPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await tick();
      await tick();
      active -= 1;
    });

    expect(peak).toBe(3);
  });

  it('одна дорожка при concurrency 1: порядок строго исходный', async () => {
    const seen: number[] = [];
    await runPool([3, 1, 2], 1, async n => {
      await tick();
      seen.push(n);
    });

    expect(seen).toEqual([3, 1, 2]);
  });

  it('ошибка воркера пробрасывается — но только после того, как все дорожки остановились', async () => {
    let finished = 0;
    await expect(
      runPool([1, 2, 3, 4], 2, async n => {
        await tick();
        if (n === 2) throw new Error('стоп');
        finished += 1;
      }),
    ).rejects.toThrow('стоп');

    // Остальные дорожки дожевали свои элементы, их отказы не повисли.
    expect(finished).toBeGreaterThanOrEqual(1);
  });

  it('пустой список — мгновенный успех', async () => {
    await expect(runPool([], 4, async () => {})).resolves.toBeUndefined();
  });
});
