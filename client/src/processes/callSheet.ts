import { deriveAllFreshness } from '@/artifacts/freshness';
import { topoOrder } from '@/artifacts/stageGraph';
import { needsDecision } from '@/artifacts/types';

import type { ArtifactIndex, ArtifactKey, ArtifactStage, Freshness } from '@/artifacts/types';
import { parseArtifactKey } from '@/artifacts/types';

/**
 * Колл-щит: что прогон собирается делать и во что это обойдётся — до того, как
 * деньги потрачены.
 *
 * Сегодня автор нажимает «Сгенерировать» и узнаёт объём работ по факту, из
 * бегущей консоли. Колл-щит переворачивает это: сначала список позиций с ценой
 * и подпись, потом работа. Он же — расчёт «превью последствий»: чтобы показать,
 * во что обойдётся правка входа, достаточно посчитать щит для мира, в котором
 * правка уже случилась.
 */

export type Action =
  /** Свежий артефакт — берём как есть, платить не за что. */
  | 'cached'
  | 'generate'
  /** Заперто автором: прогон обходит стороной. */
  | 'locked-skip'
  /** Протухло, но написано или заперто автором — молча переписывать нельзя. */
  | 'needs-decision';

export interface CallSheetPosition {
  key: ArtifactKey;
  stage: ArtifactStage;
  action: Action;
  freshness: Freshness;
  /** Оценка в долларах. У `cached` и `locked-skip` — ноль. */
  estCost: number;
}

export interface CallSheet {
  positions: CallSheetPosition[];
  /** Позиции, которые будут сгенерированы. */
  generate: CallSheetPosition[];
  /** Позиции, требующие решения автора: прогон их не тронет, пока не решат. */
  decisions: CallSheetPosition[];
  total: number;
}

/** Смета стадии за один артефакт. Пока — константы; позже придёт из costModel. */
export type StageCost = Partial<Record<ArtifactStage, number>>;

export interface CallSheetInput {
  index: ArtifactIndex;
  /** Собственная суть стадий (бриф), нужная для пересчёта отпечатков. */
  owns?: Record<string, unknown>;
  cost: StageCost;
  /** Пересобрать всё, игнорируя свежесть. Замки при этом всё равно держат. */
  force?: boolean;
}

export function buildCallSheet({ index, owns = {}, cost, force = false }: CallSheetInput): CallSheet {
  const freshness = deriveAllFreshness(index, topoOrder(), owns);

  const positions = Object.keys(index).map((key): CallSheetPosition => {
    const meta = index[key];
    const { stage } = parseArtifactKey(key as ArtifactKey);
    const state = freshness[key];
    const action = decide(state, meta.ownership === 'locked', needsDecision(meta, state), force);

    return {
      key: key as ArtifactKey,
      stage,
      action,
      freshness: state,
      estCost: action === 'generate' ? cost[stage] ?? 0 : 0,
    };
  });

  const generate = positions.filter(p => p.action === 'generate');
  const decisions = positions.filter(p => p.action === 'needs-decision');

  return {
    positions,
    generate,
    decisions,
    total: generate.reduce((sum, p) => sum + p.estCost, 0),
  };
}

function decide(freshness: Freshness, locked: boolean, decision: boolean, force: boolean): Action {
  // Замок сильнее всего, включая «пересобрать всё»: иначе кнопка полной
  // пересборки тихо стирала бы ровно то, что автор просил не трогать.
  if (locked) return freshness === 'stale' ? 'needs-decision' : 'locked-skip';
  if (decision) return 'needs-decision';
  if (force) return 'generate';
  return freshness === 'fresh' ? 'cached' : 'generate';
}

/**
 * Во что обойдётся правка входа: разница между тем, что уже оплачено, и тем,
 * что придётся пересобрать. Это и есть «превью последствий» перед применением
 * чужого мира или новой версии префаба.
 */
export function consequencesOf(
  before: CallSheetInput,
  after: CallSheetInput,
): {
  extra: CallSheetPosition[];
  decisions: CallSheetPosition[];
  cost: number;
} {
  const wasGenerating = new Set(buildCallSheet(before).generate.map(p => p.key));
  const next = buildCallSheet(after);

  const extra = next.generate.filter(p => !wasGenerating.has(p.key));
  return { extra, decisions: next.decisions, cost: extra.reduce((sum, p) => sum + p.estCost, 0) };
}
