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
  | { type: 'plan'; runId: string; total: number }
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
      return { phase: 'callsheet', runId: command.runId, total: command.total, completed: 0, spent: 0 };

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
  // События чужого прогона не наши: вторая вкладка не должна двигать наш счётчик.
  if (state.runId !== null && event.runId !== state.runId) return state;

  switch (event.phase) {
    case 'done':
    case 'skip':
      return {
        ...state,
        completed: Math.min(state.completed + 1, state.total),
        spent: state.spent + (event.cost ?? 0),
      };

    case 'attempt':
      return { ...state, spent: state.spent + (event.cost ?? 0) };

    case 'fail':
      return {
        ...state,
        phase: 'failed',
        reason: event.reason ?? 'сбой генерации',
        spent: state.spent + (event.cost ?? 0),
      };

    case 'commit':
      return { ...state, phase: 'done', completed: state.total };

    default:
      return state;
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
