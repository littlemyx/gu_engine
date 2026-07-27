import { useEffect, useState } from 'react';

/**
 * Режим шелла по ширине окна. Канон дизайна — 1440; ниже панели сужаются,
 * потом рейл сворачивается в иконки, а совсем узкий экран становится
 * режимом чтения: генерация там не запускается не из-за вёрстки, а потому
 * что следить за прогоном на таком экране нечем.
 */

export type Breakpoint = 'canon' | 'compact' | 'narrow' | 'readonly';

export const BREAKPOINTS = {
  canon: 1440,
  compact: 1280,
  narrow: 1024,
} as const;

export function breakpointOf(width: number): Breakpoint {
  if (width >= BREAKPOINTS.canon) return 'canon';
  if (width >= BREAKPOINTS.compact) return 'compact';
  if (width >= BREAKPOINTS.narrow) return 'narrow';
  return 'readonly';
}

/** Рейл свёрнут в иконки, инспектор — оверлеем. */
export const isNarrow = (bp: Breakpoint): boolean => bp === 'narrow' || bp === 'readonly';

/** Всё, что тратит деньги или меняет историю, заперто. */
export const isReadonly = (bp: Breakpoint): boolean => bp === 'readonly';

export const READONLY_REASON = 'экран уже 1024 — режим чтения';

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    breakpointOf(typeof window === 'undefined' ? BREAKPOINTS.canon : window.innerWidth),
  );

  useEffect(() => {
    // matchMedia вместо resize: браузер сам зовёт нас только на переходах
    // через границу, а не на каждый пиксель перетаскивания рамки.
    const queries = [
      `(min-width: ${BREAKPOINTS.canon}px)`,
      `(min-width: ${BREAKPOINTS.compact}px)`,
      `(min-width: ${BREAKPOINTS.narrow}px)`,
    ].map(query => window.matchMedia(query));

    const update = () => setBreakpoint(breakpointOf(window.innerWidth));
    update();
    for (const query of queries) query.addEventListener('change', update);
    return () => {
      for (const query of queries) query.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}
