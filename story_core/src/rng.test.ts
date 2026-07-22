import { describe, it, expect } from 'vitest';
import { SeededRng, hashSeed, mulberry32, bracketOfAffection, bracketThresholdsFor, guardLeafCount } from './index';

describe('SeededRng — воспроизводимость прохождения', () => {
  it('одинаковый seed даёт одинаковый поток', () => {
    const a = new SeededRng(12345);
    const b = new SeededRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('разные seed расходятся', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    expect(Array.from({ length: 10 }, () => a.next())).not.toEqual(Array.from({ length: 10 }, () => b.next()));
  });

  it('поток продолжается с сохранённого состояния — сейв не сбивает розыгрыш', () => {
    const live = new SeededRng(777);
    live.next();
    live.next();
    const saved = live.state;
    const tail = Array.from({ length: 5 }, () => live.next());

    const restored = new SeededRng(saved);
    expect(Array.from({ length: 5 }, () => restored.next())).toEqual(tail);
  });

  it('значения лежат в [0, 1)', () => {
    const rng = new SeededRng(hashSeed('история про кофейню'));
    for (let i = 0; i < 500; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) не выходит за границы и покрывает диапазон', () => {
    const rng = new SeededRng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const v = rng.int(4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });

  it('int(0) не делит на ноль', () => {
    expect(new SeededRng(1).int(0)).toBe(0);
  });

  it('mulberry32 — чистая функция: то же состояние даёт тот же результат', () => {
    expect(mulberry32(999)).toEqual(mulberry32(999));
  });

  it('hashSeed стабилен и различает строки', () => {
    expect(hashSeed('yuki')).toBe(hashSeed('yuki'));
    expect(hashSeed('yuki')).not.toBe(hashSeed('kira'));
  });
});

describe('пороги тона относительно архетипа', () => {
  it('на старте архетипа любой персонаж нейтрален', () => {
    for (const a0 of [0, 0.15, 0.5, 0.6]) {
      expect(bracketOfAffection(a0, bracketThresholdsFor(a0))).toBe('neutral');
    }
  });

  it('«теплее/холоднее» означает сдвиг от своей точки, а не абсолютную шкалу', () => {
    // forbidden (A0 = 0.5): на легаси-порогах читался бы влюблённым в слот 0.
    const th = bracketThresholdsFor(0.5);
    expect(bracketOfAffection(0.5, th)).toBe('neutral');
    expect(bracketOfAffection(0.66, th)).toBe('warm');
    expect(bracketOfAffection(0.34, th)).toBe('cold');
  });

  it('A0 = 0.15 воспроизводит легаси-пороги ровно', () => {
    const th = bracketThresholdsFor(0.15);
    expect(th).toEqual({ positiveGte: 0.3, negativeLte: 0 });
  });
});

describe('guardLeafCount — специфичность для селектора', () => {
  it('считает листья сквозь all/any/not', () => {
    expect(guardLeafCount({ all: [] })).toBe(0);
    expect(guardLeafCount({ flag: 'a' })).toBe(1);
    expect(guardLeafCount({ all: [{ flag: 'a' }, { fired: 'b' }] })).toBe(2);
    expect(guardLeafCount({ all: [{ flag: 'a' }, { not: { any: [{ flag: 'b' }, { flag: 'c' }] } }] })).toBe(3);
  });
});
