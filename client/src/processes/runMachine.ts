import type { PipelineEvent } from './events';

/**
 * Машина состояний прогона.
 *
 * Сегодня «идёт ли прогон» вычисляется по нескольким флагам сразу (фаза,
 * pendingBatch, наличие черновика), и каждый экран собирает свой ответ. Отсюда
 * расхождения: тулбар считает, что прогон идёт, а статус-бар — что нет.
 * Машина делает это одним значением с явными переходами.
 *
 *   idle ──старт──▶ callsheet ──подпись──▶ running ──▶ committing ──▶ done
 *                       │                    │  ▲             │
 *                    отмена              пауза│  │продолжить   └──▶ failed
 *                       ▼                     ▼  │
 *                     idle                   paused ──стоп──▶ stopped
 */

export type RunPhase = 'idle' | 'callsheet' | 'running' | 'paused' | 'committing' | 'done' | 'failed' | 'stopped';

export interface RunState {
  phase: RunPhase;
  runId: string | null;
  /** Позиций всего и сделано — прогресс-полоса читает отсюда. */
  total: number;
  completed: number;
  /** Потрачено за прогон, в долларах. */
  spent: number;
  /** Почему прогон встал. */
  reason?: string;
}

export const IDLE: RunState = { phase: 'idle', runId: null, total: 0, completed: 0, spent: 0 };

export type RunCommand =
  /**
   * runId необязателен: он рождается внутри раннера при старте, и шелл,
   * открывающий смету, его ещё не знает. Прогон назовёт себя сам — первым же
   * событием (см. applyEvent).
   */
  | { type: 'plan'; runId?: string | null; total: number }
  | { type: 'sign' }
  | { type: 'cancel' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'reset' };

/** Прогон занимает движок: второй запустить нельзя. */
export function isBusy(state: RunState): boolean {
  return state.phase === 'running' || state.phase === 'committing';
}

/** Прогон начат и ещё не закончен — включая паузу. */
export function isActive(state: RunState): boolean {
  return isBusy(state) || state.phase === 'paused' || state.phase === 'callsheet';
}

export function applyCommand(state: RunState, command: RunCommand): RunState {
  switch (command.type) {
    case 'plan':
      // Колл-щит показывают только из покоя: посреди прогона смету не пересобрать.
      if (isActive(state)) return state;
      return { phase: 'callsheet', runId: command.runId ?? null, total: command.total, completed: 0, spent: 0 };

    case 'sign':
      return state.phase === 'callsheet' ? { ...state, phase: 'running' } : state;

    case 'cancel':
      return state.phase === 'callsheet' ? IDLE : state;

    case 'pause':
      return state.phase === 'running' ? { ...state, phase: 'paused' } : state;

    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'running' } : state;

    case 'stop':
      // Остановить можно всё, что уже пошло, кроме записи: коммит атомарен и
      // прерывать его посреди — значит оставить историю полусобранной.
      if (state.phase === 'running' || state.phase === 'paused') {
        return { ...state, phase: 'stopped', reason: 'остановлен вами' };
      }
      return state;

    case 'reset':
      return isBusy(state) ? state : IDLE;
  }
}

export function applyEvent(state: RunState, event: PipelineEvent): RunState {
  // События двигают только начатый прогон. Иначе одинокое commit-событие
  // (например, от прогона, дожатого после перезагрузки мимо этого экрана)
  // перебрасывало бы машину из покоя сразу в «готово».
  if (state.phase !== 'running' && state.phase !== 'paused' && state.phase !== 'committing') return state;
  // События чужого прогона не наши: вторая вкладка не должна двигать наш счётчик.
  if (state.runId !== null && event.runId !== state.runId) return state;
  // Подпись ставится до старта раннера, поэтому имени прогона у машины ещё нет:
  // первое же его событие называет прогон, дальше работает проверка выше.
  const own: RunState = state.runId === null ? { ...state, runId: event.runId } : state;

  switch (event.phase) {
    case 'done':
    case 'skip': {
      const completed = own.completed + 1;
      // План растёт по факту, а не клампится. Смета считает только то, что уже
      // есть в учёте, а битов хребта и диалоговых юнитов до первого прогона не
      // существует вовсе — клампом полоса врала бы «9/9» на середине работы.
      return { ...own, completed, total: Math.max(own.total, completed), spent: own.spent + (event.cost ?? 0) };
    }

    case 'attempt':
      return { ...own, spent: own.spent + (event.cost ?? 0) };

    case 'fail':
      return {
        ...own,
        phase: 'failed',
        reason: event.reason ?? 'сбой генерации',
        spent: own.spent + (event.cost ?? 0),
      };

    case 'commit':
      return { ...own, phase: 'done', completed: own.total };

    default:
      return own;
  }
}

/** Подпись состояния для статус-бара. */
export function phaseLabel(phase: RunPhase): string {
  const LABELS: Record<RunPhase, string> = {
    idle: 'простой',
    callsheet: 'смета',
    running: 'прогон',
    paused: 'пауза',
    committing: 'запись',
    done: 'готово',
    failed: 'сбой',
    stopped: 'остановлен',
  };
  return LABELS[phase];
}
