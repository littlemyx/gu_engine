import type { BriefFieldSpec } from './briefFields';

/**
 * Ползунок «подробность» — одна ручка на весь бриф. Пользователь двигает её
 * один раз, а каждое поле получает свой объём: базовый размер поля,
 * домноженный на подробность. Поэтому «подробнее» удлиняет описание мира на
 * десяток слов, а не превращает имя персонажа в абзац.
 */

export const VERBOSITY_MIN = 1;
export const VERBOSITY_MAX = 5;
/** Середина шкалы: на ней объёмы равны базовым размерам полей. */
export const VERBOSITY_DEFAULT = 3;

export const VERBOSITY_LABELS: Record<number, string> = {
  1: 'телеграфно',
  2: 'коротко',
  3: 'обычно',
  4: 'подробно',
  5: 'развёрнуто',
};

export function clampVerbosity(value: number): number {
  if (!Number.isFinite(value)) return VERBOSITY_DEFAULT;
  return Math.min(VERBOSITY_MAX, Math.max(VERBOSITY_MIN, Math.round(value)));
}

/**
 * Целевой объём поля: слов для текста, элементов для списка. Поля со
 * `scales: false` (токены, размер каста, палитра) от ползунка не зависят —
 * там объём это структура, а не многословие.
 */
export function scaledTarget(spec: BriefFieldSpec, verbosity: number): number {
  if (spec.scales === false) return spec.baseSize;
  const factor = clampVerbosity(verbosity) / VERBOSITY_DEFAULT;
  return Math.max(1, Math.round(spec.baseSize * factor));
}
