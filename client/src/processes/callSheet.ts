import { coveredByDraft } from '@/artifacts/draftPresence';
import { deriveAllFreshness } from '@/artifacts/freshness';
import { topoOrder } from '@/artifacts/stageGraph';
import { needsDecision } from '@/artifacts/types';

import type { ArtifactIndex, ArtifactKey, ArtifactStage, Freshness } from '@/artifacts/types';
import type { RunPlan } from '@/narrative/calendarRunState';
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
  /** Оценка в долларах. У `cached`, `locked-skip` и черновика — ноль. */
  estCost: number;
  /**
   * Уже посчитано в черновике прошлого прогона: продолжение возьмёт из кэша,
   * платить не придётся. Позиция остаётся в плане (исполняет её прогон), но в
   * итог сметы не входит.
   */
  inDraft?: boolean;
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
  /**
   * Стадии, которые прогон произведёт, даже если в учёте их ещё нет. Индекс
   * знает только то, что уже случилось, — без этого списка смета пустого
   * проекта обещала бы «пересчитать бриф» и молчала про всю историю впереди.
   * Нетронутая стадия попадает в смету одной позицией `stage/` — сколько в ней
   * будет элементов, до генерации не знает никто, поэтому цена стадийная.
   */
  expectMissing?: ArtifactStage[];
  /**
   * Ключи, уже посчитанные в черновике незакоммиченного прогона (см.
   * `draftKeys`). Такие позиции планируются, но не стоят денег: продолжение
   * возьмёт их из кэша.
   */
  draft?: ArtifactKey[];
}

export function buildCallSheet({
  index,
  owns = {},
  cost,
  force = false,
  expectMissing = [],
  draft = [],
}: CallSheetInput): CallSheet {
  const freshness = deriveAllFreshness(index, topoOrder(), owns);
  const drafted = new Set<string>(draft);

  // Черновик обнуляет цену, но не действие: позицию всё равно исполняет
  // прогон — просто из кэша. Невалидный кэш прогон вправе пересобрать, так
  // что это оценка, как и вся смета.
  const withDraft = (position: CallSheetPosition): CallSheetPosition =>
    position.action === 'generate' && coveredByDraft(position.key, drafted)
      ? { ...position, inDraft: true, estCost: 0 }
      : position;

  const listed = Object.keys(index).map((key): CallSheetPosition => {
    const meta = index[key];
    const { stage } = parseArtifactKey(key as ArtifactKey);
    const state = freshness[key];
    const action = decide(state, meta.ownership === 'locked', needsDecision(meta, state), force);

    return withDraft({
      key: key as ArtifactKey,
      stage,
      action,
      freshness: state,
      estCost: action === 'generate' ? cost[stage] ?? 0 : 0,
    });
  });

  const started = new Set(listed.map(p => p.stage));
  const ahead = expectMissing
    .filter(stage => !started.has(stage))
    .map(
      (stage): CallSheetPosition =>
        withDraft({
          key: `${stage}/` as ArtifactKey,
          stage,
          action: 'generate',
          freshness: 'missing',
          estCost: cost[stage] ?? 0,
        }),
    );

  // Смета читается как план работ: сверху вниз в порядке исполнения, а не в
  // порядке появления ключей в индексе.
  const rank = new Map(topoOrder().map((stage, i) => [stage, i]));
  const positions = [...listed, ...ahead].sort(
    (a, b) => (rank.get(a.stage) ?? 0) - (rank.get(b.stage) ?? 0) || a.key.localeCompare(b.key),
  );

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

/** Что автор решил по конфликту: оставить свою строку или заказать дубль. */
export type DecisionPick = 'моё' | 'дубль';

/**
 * Подписанная смета → план прогона.
 *
 * Это и есть весь смысл подписи: до неё колл-щит был расчётом, после — набором
 * обязательств. Запертое и оставленное автором уезжают одним списком `skip` —
 * прогон обходит их одинаково; разница только в учёте, поэтому «моё» едет ещё
 * и в `keepFresh` (отпечаток освежить, дубль не заводить).
 */
export function runPlanOf(sheet: CallSheet, decided: Partial<Record<ArtifactKey, DecisionPick>>): RunPlan {
  const keep = sheet.decisions.filter(d => decided[d.key] === 'моё').map(d => d.key);
  const redo = sheet.decisions.filter(d => decided[d.key] === 'дубль').map(d => d.key);
  const locked = sheet.positions.filter(p => p.action === 'locked-skip').map(p => p.key);

  return { skip: [...locked, ...keep], force: redo, keepFresh: keep };
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
