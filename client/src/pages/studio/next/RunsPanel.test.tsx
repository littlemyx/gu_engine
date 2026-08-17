/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { emitPipelineEvent, setEventSink, useEventBus } from '@/processes/eventBus';
import { memorySink } from '@/processes/eventSink';
import { IDLE } from '@/processes/runMachine';

import RunsPanel from './RunsPanel';

afterEach(cleanup);

beforeEach(() => {
  setEventSink(memorySink());
  useEventBus.setState({ recent: [], run: IDLE });
});

const flush = () => act(async () => {});

describe('RunsPanel', () => {
  it('без прогонов честно говорит, что их не было', async () => {
    render(<RunsPanel />);
    await flush();

    expect(screen.getByText('Прогонов ещё не было.')).toBeTruthy();
  });

  it('показывает сводку прогона: статус, счётчики, деньги', async () => {
    act(() => {
      emitPipelineEvent({ runId: 'r1', phase: 'plan', stage: 'bundle', message: 'старт прогона' });
      emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine', artifactKey: 'spine/' });
      emitPipelineEvent({ runId: 'r1', phase: 'skip', stage: 'cast', artifactKey: 'cast/' });
      emitPipelineEvent({ runId: 'r1', phase: 'commit', stage: 'bundle', cost: 2.4 });
    });
    render(<RunsPanel />);
    await flush();

    expect(screen.getByText('записан')).toBeTruthy();
    expect(screen.getByText('готово 1 · пропущено 1')).toBeTruthy();
    expect(screen.getByText('≈$2.40')).toBeTruthy();
  });

  it('сбойный прогон показывает причину', async () => {
    act(() => {
      emitPipelineEvent({ runId: 'r2', phase: 'fail', stage: 'spine', reason: 'сервер недоступен' });
    });
    render(<RunsPanel />);
    await flush();

    expect(screen.getByText('сбой')).toBeTruthy();
    expect(screen.getByText('сервер недоступен')).toBeTruthy();
  });
});
