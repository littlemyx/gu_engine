import { describe, expect, it } from 'vitest';

import { stampEvent } from './events';
import { IDLE, applyCommand, applyEvent, isActive, isBusy } from './runMachine';

import type { RunState } from './runMachine';

const planned = (total = 3): RunState => applyCommand(IDLE, { type: 'plan', runId: 'r1', total });
const running = (total = 3): RunState => applyCommand(planned(total), { type: 'sign' });

const ev = (phase: 'done' | 'fail' | 'skip' | 'attempt' | 'commit', extra: Record<string, unknown> = {}) =>
  stampEvent({ runId: 'r1', phase, stage: 'spine', ...extra } as never);

describe('путь прогона', () => {
  it('покой → смета → работа → запись', () => {
    expect(planned().phase).toBe('callsheet');
    expect(running().phase).toBe('running');
    expect(applyEvent(running(), ev('commit')).phase).toBe('done');
  });

  it('смету можно отменить, не начав', () => {
    expect(applyCommand(planned(), { type: 'cancel' })).toEqual(IDLE);
  });

  it('пауза и продолжение', () => {
    const paused = applyCommand(running(), { type: 'pause' });
    expect(paused.phase).toBe('paused');
    expect(applyCommand(paused, { type: 'resume' }).phase).toBe('running');
  });

  it('остановка объясняет причину', () => {
    const stopped = applyCommand(running(), { type: 'stop' });
    expect(stopped.phase).toBe('stopped');
    expect(stopped.reason).toBeTruthy();
  });
});

describe('чего машина не позволяет', () => {
  it('второй прогон поверх идущего не начинается', () => {
    const state = running();
    expect(applyCommand(state, { type: 'plan', runId: 'r2', total: 9 })).toBe(state);
  });

  it('подпись из покоя ничего не запускает', () => {
    expect(applyCommand(IDLE, { type: 'sign' })).toBe(IDLE);
  });

  it('запись не прерывается: полусобранной истории быть не должно', () => {
    const committing: RunState = { ...running(), phase: 'committing' };
    expect(applyCommand(committing, { type: 'stop' })).toBe(committing);
  });

  it('сброс посреди работы не проходит', () => {
    const state = running();
    expect(applyCommand(state, { type: 'reset' })).toBe(state);
  });

  it('после сбоя сброс возвращает в покой', () => {
    const failed = applyEvent(running(), ev('fail', { reason: 'таймаут' }));
    expect(applyCommand(failed, { type: 'reset' })).toEqual(IDLE);
  });
});

describe('счётчики', () => {
  it('готовые и пропущенные двигают прогресс одинаково', () => {
    let state = running();
    state = applyEvent(state, ev('done'));
    state = applyEvent(state, ev('skip'));

    expect(state.completed).toBe(2);
  });

  it('прогресс не переваливает за план', () => {
    let state = running(1);
    state = applyEvent(state, ev('done'));
    state = applyEvent(state, ev('done'));

    expect(state.completed).toBe(1);
  });

  it('потраченное копится по попыткам, а не по позициям', () => {
    let state = running();
    state = applyEvent(state, ev('attempt', { cost: 0.1 }));
    state = applyEvent(state, ev('attempt', { cost: 0.1 }));
    state = applyEvent(state, ev('done', { cost: 0 }));

    expect(state.spent).toBeCloseTo(0.2);
  });

  it('сбой переводит в failed и называет причину', () => {
    const failed = applyEvent(running(), ev('fail', { reason: 'таймаут' }));
    expect(failed.phase).toBe('failed');
    expect(failed.reason).toBe('таймаут');
  });

  it('событие чужого прогона не двигает наш счётчик', () => {
    const state = running();
    const alien = stampEvent({ runId: 'r2', phase: 'done', stage: 'spine' } as never);

    expect(applyEvent(state, alien)).toBe(state);
  });
});

describe('занятость', () => {
  it('прогон и запись занимают движок', () => {
    expect(isBusy(running())).toBe(true);
    expect(isBusy({ ...running(), phase: 'committing' })).toBe(true);
  });

  it('пауза движок не занимает, но прогон ещё жив', () => {
    const paused = applyCommand(running(), { type: 'pause' });
    expect(isBusy(paused)).toBe(false);
    expect(isActive(paused)).toBe(true);
  });

  it('покой не активен', () => {
    expect(isActive(IDLE)).toBe(false);
  });
});
