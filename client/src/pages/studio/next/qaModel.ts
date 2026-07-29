import type { Brief, SegmentIssue } from '@/narrative/types';
import type { SpineEnding, SpinePlan } from '@/narrative/calendarTypes';
import type { PolicyReport, StoryQAStatus } from '@/narrative/storyQA';
import type { ChecklistRowState } from '@/ui/kit/molecules/ChecklistRow';
import type { KpiBlockItem } from '@/ui/kit/molecules/KpiBlock';
import type { IssueRowKind } from '@/ui/kit/molecules/IssueRow';
import type { ReachabilityRow, ReachabilityRowTone } from '@/ui/kit/molecules/ReachabilityChart';

export interface QaModelInput {
  brief: Brief;
  spine: SpinePlan | null;
  storyQA: StoryQAStatus | null;
}

export interface QaIssueRow {
  id: string;
  kind: IssueRowKind;
  text: string;
  /** Короткая метка действия у строки — первый шаг маршрута, напр. «→ Структура». */
  actionLabel: string;
  quote: string;
  quoteNote: string;
  /** Полный маршрут для IssueRoute: одна строка с сегментами через «→». */
  routeLine: string;
}

export type QaPolicyKind = 'ошибка' | 'предупреждение' | 'ок';

export interface QaPolicyRow {
  id: string;
  kind: QaPolicyKind;
  title: string;
  meta: string;
}

export interface QaEndingRow {
  id: string;
  title: string;
  meta: string;
  state: ChecklistRowState;
}

export interface QaModel {
  /** QA хотя бы раз прогонялся до конца — иначе цифры и списки читать рано. */
  hasRun: boolean;
  kpi: KpiBlockItem[];
  issues: QaIssueRow[];
  policies: QaPolicyRow[];
  endings: QaEndingRow[];
  reachabilityTitle: string;
  reachabilityRows: ReachabilityRow[];
}

/** Куда идти чинить проблему по префиксу её scope (см. qaSeeds.ts — та же группировка). */
function routeForScope(scope: string): string {
  if (scope.startsWith('spine/') || scope.startsWith('leaf/') || scope === 'endings') {
    return 'Структура → Хребет → перегенерировать с фидбеком';
  }
  if (scope.startsWith('sim/')) {
    return 'Структура → Хребет → окна битов';
  }
  if (scope === 'qa/deadContent') {
    return 'Генерация → Пул событий → мёртвый юнит';
  }
  if (scope.startsWith('dialogue/')) {
    const unitId = scope.split('/')[1] ?? '';
    return `Генерация → Сценарий → юнит ${unitId}`;
  }
  if (scope === 'qa/inputs') {
    return 'Структура → собрать календарный стек';
  }
  if (scope.startsWith('calendar/')) {
    return 'Структура → Календарь → пересчитать';
  }
  if (scope.startsWith('schedule/')) {
    return 'Структура → Расписание → пересчитать';
  }
  if (scope.startsWith('units/')) {
    return 'Генерация → Пул событий → пересчитать';
  }
  return 'Проверка → перезапустить QA';
}

function actionLabel(routeLine: string): string {
  return `→ ${routeLine.split('→')[0].trim()}`;
}

function endingLabel(ending: SpineEnding, brief: Brief): string {
  if (ending.kind === 'good') {
    const li = brief.loveInterests.find(l => l.id === ending.liId);
    return `хорошая · ${li?.name ?? ending.liId ?? '?'}`;
  }
  return ending.kind === 'normal' ? 'нейтральная' : 'плохая';
}

function ratioTone(reached: number, percent: number, totalRuns: number): ReachabilityRowTone {
  if (totalRuns === 0) return 'quiet';
  if (reached === 0 || percent < 20) return 'warn';
  return 'default';
}

/**
 * Сводка зоны «Проверка»: KPI, проблемы из Story QA (D2/D4) с маршрутом
 * фидбека, отчёт симуляции политик (D3) и достижимость концовок хребта.
 * Всё выводится из `storyQA` (narrativeStore), `spine.endings` и брифа —
 * своего состояния модель не держит.
 */
export function deriveQa({ brief, spine, storyQA }: QaModelInput): QaModel {
  const hasRun = storyQA?.state === 'done';
  const rawIssues: SegmentIssue[] = storyQA?.issues ?? [];
  const policyReports: PolicyReport[] = storyQA?.policyReports ?? [];
  const endings = spine?.endings ?? [];
  const totalRuns = policyReports.length;

  const blockers = rawIssues.filter(i => i.severity === 'error').length;
  const warnings = rawIssues.filter(i => i.severity === 'warning').length;

  const endingsById = new Map(endings.map(e => [e.id, e]));

  const endingStats = endings.map(ending => {
    const reached = policyReports.filter(r => r.endingSatisfied === ending.id).length;
    const percent = totalRuns > 0 ? Math.round((reached / totalRuns) * 100) : 0;
    return { ending, reached, percent };
  });
  const reachedEndingsCount = endingStats.filter(s => s.reached > 0).length;

  const issues: QaIssueRow[] = rawIssues.map((issue, index) => {
    const routeLine = routeForScope(issue.scope);
    return {
      id: `${issue.scope}#${index}`,
      kind: issue.severity === 'error' ? 'blocker' : 'warning',
      text: issue.message,
      actionLabel: actionLabel(routeLine),
      quote: issue.message,
      quoteNote: `источник: ${issue.scope}`,
      routeLine,
    };
  });

  const policies: QaPolicyRow[] = policyReports.map(r => {
    const kind: QaPolicyKind = !r.reachedFinale ? 'ошибка' : r.endingSatisfied == null ? 'предупреждение' : 'ок';
    const satisfiedEnding = r.endingSatisfied ? endingsById.get(r.endingSatisfied) : undefined;
    const meta = !r.reachedFinale
      ? `финал не достигнут за ${r.slotCount} слотов`
      : satisfiedEnding
      ? `концовка «${endingLabel(satisfiedEnding, brief)}» · битов сыграно ${r.firedBeats.length}`
      : 'финал есть, но ни одна концовка не выполнима';
    return { id: `${r.policy}#${r.seed}`, kind, title: `${r.policy} · seed ${r.seed}`, meta };
  });

  const endingRows: QaEndingRow[] = endingStats.map(({ ending, reached, percent }) => {
    const state: ChecklistRowState =
      totalRuns === 0 ? 'pending' : reached === 0 ? 'problem' : percent < 20 ? 'warning' : 'ready';
    const meta = totalRuns > 0 ? `${reached}/${totalRuns} прогонов · ${percent}%` : 'нет прогонов симуляции';
    return { id: ending.id, title: endingLabel(ending, brief), meta, state };
  });

  const reachabilityRows: ReachabilityRow[] = endingStats.map(({ ending, reached, percent }) => ({
    label: endingLabel(ending, brief),
    percent,
    count: `${reached}/${totalRuns}`,
    tone: ratioTone(reached, percent, totalRuns),
  }));

  const kpi: KpiBlockItem[] = [
    { value: String(blockers), label: 'блокеров', tone: blockers > 0 ? 'accent' : 'quiet' },
    { value: String(warnings), label: 'предупреждений', tone: warnings > 0 ? 'normal' : 'quiet' },
    {
      value: `${reachedEndingsCount}/${endings.length}`,
      label: 'концовок достижимо',
      tone: endings.length > 0 && reachedEndingsCount < endings.length ? 'accent' : 'quiet',
    },
  ];

  return {
    hasRun,
    kpi,
    issues,
    policies,
    endings: endingRows,
    reachabilityTitle: `ДОСТИЖИМОСТЬ КОНЦОВОК · ${totalRuns} ПРОГОНОВ`,
    reachabilityRows,
  };
}
