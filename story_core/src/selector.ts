/**
 * Салиенс-селектор: «какую сцену из пула играть здесь и сейчас».
 *
 * Это тот самый слой, которого в графовой модели не было вовсе. Раньше выбор
 * между несколькими подходящими сценами делало правило «первое активное ребро»
 * — то есть порядок, в котором компилятор их провёл. Здесь выбор — функция от
 * состояния: сюжет вытесняет болтовню, следующая ступень арки вытесняет
 * пройденную, закрывающееся окно всплывает, а недавно виденный персонаж
 * уступает место тем, кого давно не было.
 *
 * Форма `score(unit, view) → number` выбрана ради будущего: сегодня веса
 * рукописные, но подменить их обученными (contextual bandit по логам
 * прохождений) можно, не трогая ни режиссёра, ни формат бандла.
 */

import type { SelectorWeights, StoryletUnit } from './bundle';
import { guardLeafCount } from './guards';
import { SeededRng } from './rng';

export type ScoreView = {
  slot: number;
  phase: number;
  /** Ступень, которую персонаж проходит следующей: max(сыгранные)+1. */
  nextStageByLi: Map<string, number>;
  /** Персонажи последних закрытых сцен, свежие первыми. */
  recentLis: string[];
  /** Ширина окна «недавности» из конфига бандла. */
  varietyWindow: number;
};

export type ScoreTerms = Record<keyof SelectorWeights, number>;

export type ScoredUnit = {
  unit: StoryletUnit;
  score: number;
  /** Слагаемые до умножения на веса — для трейса ?gudebug. */
  terms: ScoreTerms;
};

export type ScoreFn = (unit: StoryletUnit, view: ScoreView, weights: SelectorWeights) => ScoredUnit;

const SOURCE_RANK: Record<StoryletUnit['source'], number> = { spine: 1, agenda: 0.5, filler: 0 };

/**
 * Рукописная функция качества в духе декларативного drama management: автор
 * задаёт не ветки, а то, каким должен быть опыт, — и селектор оптимизирует.
 */
export const utilityScore: ScoreFn = (unit, view, weights) => {
  const window = unit.at.slot;

  // Специфичность: сцена под три условия написана для более узкой ситуации,
  // чем сцена под одно, и при прочих равных обязана её вытеснять — иначе
  // узкий контент не будет показан никогда (правило QBN).
  const specificity = Math.min(1, guardLeafCount(unit.guard) / 4);

  // Продвижение арки: ровно следующая ступень для этого персонажа.
  const stage = unit.arcStage ?? 0;
  const arcProgress = stage > 0 && (view.nextStageByLi.get(unit.li) ?? 1) === stage ? 1 : 0;

  // Срочность: окно закрывается — сцена всплывает. Без этого поздние сцены
  // широких окон вечно проигрывали бы свежим.
  const slotsLeft = Math.max(0, window.toSlot - view.slot);
  const urgency = 1 / (1 + slotsLeft);

  // Разнообразие: штраф тем сильнее, чем свежее последняя сцена с этим
  // персонажем. Это единственный отрицательный член.
  const recentIdx = view.recentLis.indexOf(unit.li);
  const variety = recentIdx === -1 ? 0 : -(1 - recentIdx / Math.max(1, view.varietyWindow));

  // Темп: сцена, чьё окно восприимчивости прицельно накрывает текущую фазу,
  // уместнее фаза-агностичной («подбодрить вымотанную к концу смены»).
  const pacing = unit.at.phase && unit.at.phase.fromPhase === view.phase ? 1 : 0;

  const source = SOURCE_RANK[unit.source] ?? 0;

  const terms: ScoreTerms = {
    base: unit.weight,
    specificity,
    arcProgress,
    urgency,
    variety,
    pacing,
    source,
  };

  let score = 0;
  for (const key of Object.keys(terms) as Array<keyof SelectorWeights>) {
    score += terms[key] * weights[key];
  }
  return { unit, score, terms };
};

export type SelectionTrace = {
  candidates: ScoredUnit[];
  picked: string | null;
  /** Жребий в [0,1); null — выбирать было не из чего либо topN = 1. */
  draw: number | null;
  /** Ярус, среди которого тянули жребий (см. tierOf). */
  tier: number;
};

/**
 * Ярус приоритета. Жребий тянется ТОЛЬКО внутри старшего непустого яруса.
 *
 * Зачем ярусы, а не просто большие веса: со взвешенным жребием у филлера
 * оставался шанс вытеснить ступень арки, и в прогоне демо это ровно и
 * случилось — «поболтать» выиграло у сцены третьей ступени, а к следующему
 * разу персонаж уже сменил локацию по расписанию, и вершина арки не сыграла
 * никогда (концовка вместо хорошей выпала обычная). Стохастика нужна для
 * разнообразия между РАВНОЦЕННЫМИ вариантами, а не для того, чтобы ронять
 * сюжет; ярус это и формализует.
 */
function tierOf(unit: StoryletUnit, view: ScoreView): number {
  const stage = unit.arcStage ?? 0;
  if (stage > 0 && (view.nextStageByLi.get(unit.li) ?? 1) === stage) return 2;
  if (unit.source === 'spine') return 1;
  return 0;
}

/**
 * Ранжирование + взвешенный жребий среди лучших N.
 *
 * Стохастика здесь ради разнообразия перепрохождений (дух TTD-MDP: цель —
 * распределение историй, а не одна оптимальная колея), но полностью
 * воспроизводима: поток ГПСЧ живёт в состоянии прохождения. topN = 1
 * вырождает выбор в argmax — аварийный конфиг, если баланс поплывёт.
 */
export function selectUnit(
  candidates: StoryletUnit[],
  view: ScoreView,
  weights: SelectorWeights,
  topN: number,
  rng: SeededRng,
  score: ScoreFn = utilityScore,
): { unit: StoryletUnit | null; trace: SelectionTrace } {
  if (candidates.length === 0) return { unit: null, trace: { candidates: [], picked: null, draw: null, tier: 0 } };

  const scored = candidates
    .map(u => score(u, view, weights))
    .sort((a, b) => b.score - a.score || (a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0));

  // Старший непустой ярус забирает жребий целиком.
  const tier = Math.max(...candidates.map(u => tierOf(u, view)));
  const eligible = scored.filter(s => tierOf(s.unit, view) === tier);

  const pool = eligible.slice(0, Math.max(1, topN));
  if (pool.length === 1) {
    return { unit: pool[0].unit, trace: { candidates: scored, picked: pool[0].unit.id, draw: null, tier } };
  }

  // Отрицательные и нулевые скоры всё равно обязаны иметь шанс: ноль веса
  // означал бы, что сцена не сыграет никогда, а её уже допустил guard.
  const EPS = 0.01;
  const shifted = pool.map(s => Math.max(EPS, s.score));
  const total = shifted.reduce((a, b) => a + b, 0);

  const draw = rng.next();
  let acc = 0;
  let chosen = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    acc += shifted[i] / total;
    if (draw < acc) {
      chosen = pool[i];
      break;
    }
  }

  return { unit: chosen.unit, trace: { candidates: scored, picked: chosen.unit.id, draw, tier } };
}
