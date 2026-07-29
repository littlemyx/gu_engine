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

  // Смета считает только то, что уже есть в учёте: битов хребта и диалоговых
  // юнитов до первого прогона не существует вовсе. Клампом полоса врала бы
  // «1 из 1» на середине работы, поэтому план растёт по факту.
  it('план растёт, когда позиций оказалось больше, чем в смете', () => {
    let state = running(1);
    state = applyEvent(state, ev('done'));
    state = applyEvent(state, ev('done'));

    expect(state.completed).toBe(2);
    expect(state.total).toBe(2);
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

describe('имя прогона', () => {
  // Подпись под сметой ставится ДО старта раннера, а runId рождается внутри
  // него — назвать прогон заранее шелл не может.
  const anonymous = (): RunState => applyCommand(applyCommand(IDLE, { type: 'plan', total: 2 }), { type: 'sign' });

  it('первое событие называет безымянный прогон', () => {
    const state = applyEvent(anonymous(), ev('done'));

    expect(state.runId).toBe('r1');
    expect(state.completed).toBe(1);
  });

  it('назвавшись, прогон перестаёт слушать чужие события', () => {
    const named = applyEvent(anonymous(), ev('done'));
    const alien = stampEvent({ runId: 'r2', phase: 'done', stage: 'spine' } as never);

    expect(applyEvent(named, alien)).toBe(named);
  });
});

describe('события вне прогона', () => {
  // Прогон переживает перезагрузку и дожимается мимо этого экрана: его
  // терминальное событие не имеет права выдать «готово» машине, которая
  // ничего не запускала.
  it('покой не двигается ничем', () => {
    expect(applyEvent(IDLE, ev('commit'))).toBe(IDLE);
    expect(applyEvent(IDLE, ev('done'))).toBe(IDLE);
  });

  it('смета не двигается ничем', () => {
    const state = planned();
    expect(applyEvent(state, ev('done'))).toBe(state);
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
