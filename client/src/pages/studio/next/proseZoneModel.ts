import { parseArtifactKey } from '@/artifacts/types';

import type { ArtifactStage } from '@/artifacts/types';
import type { PipelineEvent } from '@/processes/events';
import type { RunState } from '@/processes/runMachine';

/**
 * Модель зоны «Генерация»: сырые события шины конвейера, разложенные на то,
 * чем эта зона отличается от прогресс-бара — построчную ведомость по
 * артефактам, порции по стадиям и три вещи, которые автор видит прямо сейчас:
 * раш (черновик читают, не дожидаясь конца), чекпоинт (прогон встал на паузу
 * после порции) и вердикты критика над отвергнутыми попытками.
 *
 * Стадии зоны те же, что в `zoneModel.ts` (`ZONES.prose.stages`) — здесь они
 * не импортируются оттуда, чтобы модель ленты не тянула за собой описание
 * всего конвейера ради пяти строк.
 */
export const PROSE_STAGES: ArtifactStage[] = [
  'beat_prose',
  'anchor_transitions',
  'event_pool',
  'dialogue_units',
  'ending_prose',
];

const PROSE_STAGE_SET = new Set<ArtifactStage>(PROSE_STAGES);

export type LedgerLineState = 'готово' | 'пишется' | 'очередь';

export interface LedgerLine {
  key: string;
  stage: ArtifactStage;
  /** «dialogue_units · unit_kira_s2» или просто стадия, если элемента нет. */
  artifact: string;
  state: LedgerLineState;
  /** Переопределяет подпись статуса — сейчас только для сбоя. */
  status?: string;
  take?: string;
  price?: string;
}

export interface BatchLine {
  stage: ArtifactStage;
  label: string;
  done: number;
  total: number;
  /** В стадии есть строка, которая пишется прямо сейчас. */
  active: boolean;
}

export interface ActiveRush {
  speaker: string;
  text: string;
}

export interface CriticNote {
  key: string;
  title: string;
  quote: string;
}

export interface CheckpointInfo {
  note: string;
}

export interface ProseZoneModel {
  ledger: LedgerLine[];
  batches: BatchLine[];
  /** Что стримится прямо сейчас — самая свежая пишущаяся строка с текстом. */
  rush: ActiveRush | null;
  critiques: CriticNote[];
  /** Прогон стоит на паузе — что показать в баннере. */
  checkpoint: CheckpointInfo | null;
}

interface Group {
  key: string;
  stage: ArtifactStage;
  item: string;
  events: PipelineEvent[];
}

export function deriveProseZone(events: PipelineEvent[], run: RunState): ProseZoneModel {
  const inZone = events.filter(e => PROSE_STAGE_SET.has(e.stage));

  // Map хранит порядок первого появления ключа — ведомость держится этого
  // порядка, а не пересортировывается при каждом новом событии.
  const groups = new Map<string, Group>();
  for (const event of inZone) {
    const key = event.artifactKey ?? event.stage;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        stage: event.stage,
        item: event.artifactKey ? parseArtifactKey(event.artifactKey).item : '',
        events: [],
      };
      groups.set(key, group);
    }
    group.events.push(event);
  }

  const ledger: LedgerLine[] = [];
  const critiques: CriticNote[] = [];
  const batchCounts = new Map<ArtifactStage, { done: number; total: number; active: boolean }>();
  let rush: ActiveRush | null = null;
  let rushTs = -Infinity;

  for (const group of groups.values()) {
    const last = group.events[group.events.length - 1];
    const spent = group.events.reduce((sum, e) => sum + (e.cost ?? 0), 0);

    let state: LedgerLineState;
    let status: string | undefined;
    switch (last.phase) {
      case 'done':
      case 'commit':
      case 'skip':
        state = 'готово';
        break;
      case 'start':
      case 'attempt':
        state = 'пишется';
        break;
      case 'fail':
        // Строку не прячем — автор должен увидеть, что позиция не закрылась.
        state = 'очередь';
        status = 'сбой';
        break;
      default:
        state = 'очередь';
    }

    ledger.push({
      key: group.key,
      stage: group.stage,
      artifact: group.item ? `${group.stage} · ${group.item}` : group.stage,
      state,
      status,
      take: last.attempt != null ? `№${last.attempt}` : undefined,
      price: spent > 0 ? `$${spent.toFixed(3)}` : undefined,
    });

    const counts = batchCounts.get(group.stage) ?? { done: 0, total: 0, active: false };
    counts.total += 1;
    if (state === 'готово') counts.done += 1;
    if (state === 'пишется') counts.active = true;
    batchCounts.set(group.stage, counts);

    // Раш — самая свежая пишущаяся строка с человеческим текстом: остальные
    // «пишется» без текста ничего не стримят, показывать в панели нечего.
    if (state === 'пишется' && last.message && last.ts > rushTs) {
      rush = { speaker: group.item || group.stage, text: last.message };
      rushTs = last.ts;
    }

    // Вердикт критика — это провал попытки с причиной, а не пропуск: пропуск
    // объясняется кэшем или замком, критика там нет.
    for (const event of group.events) {
      if (event.phase === 'fail' && event.reason) {
        critiques.push({
          key: event.id,
          title: `${group.item || group.stage} · попытка ${event.attempt ?? 1}`,
          quote: event.reason,
        });
      }
    }
  }

  const batches: BatchLine[] = PROSE_STAGES.filter(stage => batchCounts.has(stage)).map(stage => {
    const counts = batchCounts.get(stage)!;
    return { stage, label: stage, done: counts.done, total: counts.total, active: counts.active };
  });

  const checkpoint: CheckpointInfo | null =
    run.phase === 'paused'
      ? { note: `сделано ${run.completed} из ${run.total} · потрачено ≈$${run.spent.toFixed(2)}` }
      : null;

  return { ledger, batches, rush, critiques, checkpoint };
}
