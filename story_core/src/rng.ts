/**
 * Детерминированный ГПСЧ для салиенс-селектора.
 *
 * Стохастика нужна, чтобы перепрохождения отличались (дух TTD-MDP: цель —
 * распределение траекторий, а не одна оптимальная колея). Но она обязана быть
 * воспроизводимой: seed лежит в состоянии прохождения, поэтому баг-репорт
 * «на seed 12345 сцена не открылась» реплеится точь-в-точь, а симуляция
 * политик в story QA гоняет ту же историю по фиксированному набору seed-ов.
 *
 * mulberry32 — 32-битный, без зависимостей, состояние — одно число, что и
 * позволяет положить его прямо в сейв.
 */

/** Следующее состояние + значение в [0, 1). Чистая функция. */
export function mulberry32(state: number): { next: number; value: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { next, value };
}

/** Строка → 32-битный seed (FNV-1a); для seed-а от названия истории. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Курсор ГПСЧ: состояние снаружи (в DirectorState), поэтому режиссёр остаётся
 * сериализуемым, а «продвинуть поток» — явное действие, а не побочный эффект.
 */
export class SeededRng {
  constructor(public state: number) {}

  /** [0, 1) */
  next(): number {
    const { next, value } = mulberry32(this.state);
    this.state = next;
    return value;
  }

  /** Целое в [0, n). */
  int(n: number): number {
    return n <= 0 ? 0 : Math.floor(this.next() * n) % n;
  }
}
