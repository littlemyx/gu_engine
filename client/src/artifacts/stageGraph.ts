import type { ArtifactStage } from './types';

/**
 * Граф зависимостей стадий: у кого что на входе.
 *
 * Это та же семантика, что таблица CASCADE в `narrative/calendarRunState.ts`,
 * только вывернутая наизнанку. Там перечислено, что стадия СНОСИТ; здесь — из
 * чего стадия СДЕЛАНА. Форма «из чего сделана» лучше тем, что протухание
 * считается обходом графа вверх и не требует, чтобы кто-то не забыл вписать
 * новую стадию в списки всех своих предков.
 *
 * Сверка с CASCADE:
 *   cast     сносит calendar, spine, schedule, event_pool, dialogue, beat, ending
 *   world    сносит spine и всё ниже
 *   spine    сносит schedule, event_pool, dialogue, beat, ending
 *   schedule сносит event_pool, dialogue
 * — ровно то, что даёт транзитивное замыкание таблицы ниже.
 */
export const STAGE_INPUTS: Record<ArtifactStage, ArtifactStage[]> = {
  brief: [],
  cast: ['brief'],
  // Модель мира не зависит от каста: каскад setCastPlan её не трогал.
  world: ['brief'],
  calendar: ['brief', 'cast', 'world'],
  spine: ['brief', 'cast', 'world', 'calendar'],
  schedule: ['spine'],
  beat_prose: ['spine'],
  // В старом каскаде нарации не сносил никто — это была дыра: они пересказывают
  // переходы хребта и обязаны протухать вместе с ним.
  anchor_transitions: ['spine'],
  event_pool: ['schedule'],
  dialogue_units: ['schedule'],
  ending_prose: ['spine'],
  image: ['brief', 'cast'],
  audio: ['brief'],
  qa: ['beat_prose', 'dialogue_units', 'event_pool', 'ending_prose', 'anchor_transitions'],
  bundle: ['qa', 'image', 'audio'],
  release: ['bundle'],
};

/**
 * Версия промпта стадии. Поднимается руками, когда переписан промпт: артефакты,
 * рождённые старым промптом, обязаны протухнуть, иначе история склеится из
 * несовместимых кусков.
 */
export const PROMPT_VERSIONS: Record<ArtifactStage, number> = {
  brief: 1,
  cast: 1,
  world: 1,
  calendar: 1,
  spine: 1,
  schedule: 1,
  beat_prose: 1,
  anchor_transitions: 1,
  event_pool: 1,
  dialogue_units: 1,
  ending_prose: 1,
  image: 1,
  audio: 1,
  qa: 1,
  bundle: 1,
  release: 1,
};

export const ALL_STAGES = Object.keys(STAGE_INPUTS) as ArtifactStage[];

/** Все стадии, от которых зависит указанная, включая косвенные. */
export function upstreamOf(stage: ArtifactStage): ArtifactStage[] {
  const seen = new Set<ArtifactStage>();
  const walk = (s: ArtifactStage) => {
    for (const input of STAGE_INPUTS[s]) {
      if (seen.has(input)) continue;
      seen.add(input);
      walk(input);
    }
  };
  walk(stage);
  return [...seen];
}

/** Все стадии, которые протухнут, если пересобрать указанную. */
export function downstreamOf(stage: ArtifactStage): ArtifactStage[] {
  return ALL_STAGES.filter(s => s !== stage && upstreamOf(s).includes(stage));
}

/**
 * Стадии в порядке, в котором их можно считать: каждая идёт после всех своих
 * входов. Заодно доказывает, что в графе нет циклов — иначе вернуть такой
 * порядок было бы невозможно, и функция бросает.
 */
export function topoOrder(): ArtifactStage[] {
  const order: ArtifactStage[] = [];
  const placed = new Set<ArtifactStage>();

  while (order.length < ALL_STAGES.length) {
    const ready = ALL_STAGES.filter(s => !placed.has(s) && STAGE_INPUTS[s].every(i => placed.has(i)));
    if (ready.length === 0) {
      const stuck = ALL_STAGES.filter(s => !placed.has(s));
      throw new Error(`В графе стадий цикл: ${stuck.join(', ')}`);
    }
    for (const s of ready) {
      order.push(s);
      placed.add(s);
    }
  }

  return order;
}
