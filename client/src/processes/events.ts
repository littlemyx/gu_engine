import type { ArtifactKey, ArtifactStage } from '@/artifacts/types';

/**
 * Типизированное событие конвейера — то, чем «Лента» отличается от консоли.
 *
 * Сейчас прогон рассказывает о себе строками (`narrative/runLog.ts`). Строку
 * нельзя ни сгруппировать по артефакту, ни превратить в клик «показать, что
 * именно тут сломалось»: смысл в ней есть только для человека. Событие несёт
 * тот же смысл структурой, а строку для консоли из него всегда можно собрать.
 */

export type EventPhase =
  | 'plan'
  /** Позиция взята в работу. */
  | 'start'
  /** Одна попытка внутри best-of: attempt заполнен. */
  | 'attempt'
  | 'done'
  | 'fail'
  /** Позиция пропущена: кэш свеж, или артефакт заперт. */
  | 'skip'
  /** Черновик прогона слит в стор — точка невозврата. */
  | 'commit';

export interface PipelineEvent {
  id: string;
  ts: number;
  runId: string;
  phase: EventPhase;
  stage: ArtifactStage;
  /** Позиция, которой событие касается. Пусто у событий про прогон целиком. */
  artifactKey?: ArtifactKey;
  attempt?: number;
  /** Стоимость именно этого шага в долларах. */
  cost?: number;
  /** Человеческий текст: то, что уйдёт в консоль. */
  message?: string;
  /** Почему провал или пропуск. */
  reason?: string;
}

export type NewEvent = Omit<PipelineEvent, 'id' | 'ts'>;

let counter = 0;

/** Идентификатор события: время плюс счётчик — два события в одну мс различимы. */
export function nextEventId(ts: number): string {
  counter += 1;
  return `${ts.toString(36)}-${counter.toString(36)}`;
}

export function stampEvent(event: NewEvent, ts = Date.now()): PipelineEvent {
  return { ...event, id: nextEventId(ts), ts };
}

/** Строка для консоли: у события всегда есть человеческое прочтение. */
export function eventText(event: PipelineEvent): string {
  if (event.message) return event.message;

  const what = event.artifactKey ?? event.stage;
  const PHRASES: Record<EventPhase, string> = {
    plan: `в плане: ${what}`,
    start: `начато: ${what}`,
    attempt: `попытка ${event.attempt ?? 1}: ${what}`,
    done: `готово: ${what}`,
    fail: `сбой: ${what}${event.reason ? ` — ${event.reason}` : ''}`,
    skip: `пропущено: ${what}${event.reason ? ` — ${event.reason}` : ''}`,
    commit: `записано: ${event.stage}`,
  };
  return PHRASES[event.phase];
}

export type EventTone = 'info' | 'ok' | 'error' | 'run' | 'pending';

/** Тон для консоли — единственное место, где фаза превращается в цвет. */
export function eventTone(phase: EventPhase): EventTone {
  const TONES: Record<EventPhase, EventTone> = {
    plan: 'pending',
    start: 'run',
    attempt: 'run',
    done: 'ok',
    fail: 'error',
    skip: 'info',
    commit: 'ok',
  };
  return TONES[phase];
}
