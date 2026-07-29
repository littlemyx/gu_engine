/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useEventBus } from '@/processes/eventBus';
import { IDLE } from '@/processes/runMachine';

import ProseZone from './ProseZone';

import type { PipelineEvent } from '@/processes/events';
import type { RunState } from '@/processes/runMachine';

afterEach(cleanup);

beforeEach(() => {
  useEventBus.setState({ recent: [], run: IDLE });
});

// jest-dom в проекте нет — смотрим сами свойства DOM.
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

const evt = (
  partial: Partial<PipelineEvent> & Pick<PipelineEvent, 'id' | 'ts' | 'phase' | 'stage'>,
): PipelineEvent => ({
  runId: 'r1',
  ...partial,
});

describe('ProseZone, пустая лента', () => {
  it('честно называет, что прогона ещё не было, а не показывает пустое место', () => {
    render(<ProseZone />);

    expect(screen.getByText('Генерация')).toBeTruthy();
    expect(screen.getByText('Лента пуста — прогон ещё не запускали.')).toBeTruthy();
    expect(screen.getByText('прогон не запущен')).toBeTruthy();
  });

  it('без событий ни раша, ни вердиктов, ни чекпоинта нет', () => {
    render(<ProseZone />);

    expect(screen.queryByText(/Раш/)).toBeNull();
    expect(screen.queryByText('Вердикты критика')).toBeNull();
    expect(screen.queryByText(/Чекпоинт/)).toBeNull();
  });
});

describe('ProseZone, лента заполнена', () => {
  const events: PipelineEvent[] = [
    // Стадия в очереди — событие без artifactKey, элемента у строки нет.
    evt({ id: 'e1', ts: 1000, phase: 'plan', stage: 'ending_prose' }),
    // Юнит пишется: две попытки, раш должен взять текст самой свежей.
    evt({
      id: 'e2',
      ts: 1001,
      phase: 'start',
      stage: 'dialogue_units',
      artifactKey: 'dialogue_units/unit_kira',
      attempt: 1,
      message: 'Ты всё-таки пришёл.',
    }),
    evt({
      id: 'e3',
      ts: 1002,
      phase: 'attempt',
      stage: 'dialogue_units',
      artifactKey: 'dialogue_units/unit_kira',
      attempt: 2,
      cost: 0.01,
      message: 'Ты всё-таки пришёл. Шторм тебя не напугал?',
    }),
    // Юнит готов — с ценой.
    evt({
      id: 'e4',
      ts: 1003,
      phase: 'done',
      stage: 'event_pool',
      artifactKey: 'event_pool/ep1',
      cost: 0.02,
    }),
    // Попытка отвергнута критиком — с причиной.
    evt({
      id: 'e5',
      ts: 1004,
      phase: 'fail',
      stage: 'anchor_transitions',
      artifactKey: 'anchor_transitions/at1',
      attempt: 2,
      reason: 'обращение на вы',
    }),
  ];

  beforeEach(() => {
    useEventBus.setState({
      recent: events,
      run: { phase: 'running', runId: 'r1', total: 10, completed: 4, spent: 0.41 } as RunState,
    });
  });

  it('показывает раш самой свежей пишущейся строки', () => {
    render(<ProseZone />);

    expect(screen.getByText('«Ты всё-таки пришёл. Шторм тебя не напугал?»')).toBeTruthy();
  });

  it('ведомость держит три состояния строки: очередь, пишется, готово', () => {
    render(<ProseZone />);

    // «ending_prose» стоит и полосой порции, и строкой без элемента внутри —
    // отсюда два совпадения, а не одно.
    expect(screen.getAllByText('ending_prose')).toHaveLength(2);
    expect(screen.getByText('в очереди')).toBeTruthy();

    expect(screen.getByText('dialogue_units · unit_kira')).toBeTruthy();
    expect(screen.getByText('пишется')).toBeTruthy();

    expect(screen.getByText('event_pool · ep1')).toBeTruthy();
    expect(screen.getByText('готово')).toBeTruthy();
  });

  it('порции считают готовые и общие позиции стадии', () => {
    render(<ProseZone />);

    expect(screen.getByText('· 1/1')).toBeTruthy();
  });

  it('отвергнутая попытка становится вердиктом критика', () => {
    render(<ProseZone />);

    expect(screen.getByText('Вердикты критика')).toBeTruthy();
    expect(screen.getByText('at1 · попытка 2')).toBeTruthy();
    expect(screen.getByText('«обращение на вы»')).toBeTruthy();
  });

  it('лента событий печатает человеческую строку на каждое событие зоны', () => {
    render(<ProseZone />);

    expect(screen.getByText('в плане: ending_prose')).toBeTruthy();
    expect(screen.getByText('готово: event_pool/ep1')).toBeTruthy();
  });

  it('строка прогона читает счёт из шины, а не рисует голую полосу', () => {
    render(<ProseZone />);

    expect(screen.getByText('4 из 10 · ≈$0.41')).toBeTruthy();
  });
});

describe('ProseZone, чекпоинт после порции', () => {
  beforeEach(() => {
    useEventBus.setState({
      recent: [
        evt({ id: 'e1', ts: 1000, phase: 'done', stage: 'beat_prose', artifactKey: 'beat_prose/b1', cost: 0.1 }),
      ],
      run: { phase: 'paused', runId: 'r1', total: 10, completed: 3, spent: 0.3 } as RunState,
    });
  });

  it('баннер чекпоинта называет, сколько сделано и сколько потрачено', () => {
    render(<ProseZone />);

    expect(screen.getByText('Чекпоинт: прогон на паузе')).toBeTruthy();
    expect(screen.getByText('сделано 3 из 10 · потрачено ≈$0.30')).toBeTruthy();
  });

  it('«Продолжить» снимает паузу через ту же шину', () => {
    render(<ProseZone />);

    button('Продолжить').click();

    expect(useEventBus.getState().run.phase).toBe('running');
  });

  it('«Остановить» останавливает прогон, не дожидаясь коммита', () => {
    render(<ProseZone />);

    button('Остановить').click();

    expect(useEventBus.getState().run.phase).toBe('stopped');
  });
});
