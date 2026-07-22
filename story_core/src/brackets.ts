/**
 * Пороги тона отношений — единственная точка истины.
 *
 * Ими же собираются аудио-профили сцен: музыкальный bracket совпадает с
 * диалоговым по построению, а не по совпадению литералов.
 */

export type AffectionBracket = 'warm' | 'neutral' | 'cold';

export const BRACKET_POSITIVE_GTE = 0.3;
export const BRACKET_NEGATIVE_LTE = 0;

/** Пороги тона: абсолютные (легаси) либо относительные старту архетипа. */
export type BracketThresholds = { positiveGte: number; negativeLte: number };

export const LEGACY_BRACKET_THRESHOLDS: BracketThresholds = {
  positiveGte: BRACKET_POSITIVE_GTE,
  negativeLte: BRACKET_NEGATIVE_LTE,
};

/** Отступ тона от старта архетипа: ровно легаси-случай при A0 = 0.15. */
export const BRACKET_OFFSET = 0.15;

/**
 * Пороги тона ОТНОСИТЕЛЬНО старта архетипа (A0 = середина initialState.affection,
 * она же дефолт stateSchema).
 *
 * Зачем: пороги были абсолютными (warm ≥ 0.3), а старт — архетипным. У
 * forbidden (A0=0.5) и mutual_pining (A0=0.6) игра открывалась УЖЕ за тёплым
 * порогом: персонаж читался влюблённым в слот 0, до единого выбора игрока.
 * Условия концовок при этом всегда были относительными (mid±offset) — тон и
 * прогресс жили в разных шкалах. Относительный порог их мирит: на старте любой
 * архетип нейтрален, а «теплее/холоднее» означает «сдвинулся от своей точки».
 */
export function bracketThresholdsFor(a0: number): BracketThresholds {
  return { positiveGte: a0 + BRACKET_OFFSET, negativeLte: a0 - BRACKET_OFFSET };
}

/**
 * Бакет тона по affection.
 *
 * Пороги параметризованы: рантайм подставляет запечённые в бандл пороги
 * конкретного персонажа (bracketThresholdsFor(a0)), а generation-time
 * потребители, которым архетип недоступен, работают на легаси-порогах.
 */
export function bracketOfAffection(
  affection: number,
  thresholds: BracketThresholds = LEGACY_BRACKET_THRESHOLDS,
): AffectionBracket {
  if (affection >= thresholds.positiveGte) return 'warm';
  if (affection <= thresholds.negativeLte) return 'cold';
  return 'neutral';
}
