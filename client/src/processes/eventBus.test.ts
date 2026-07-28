import { beforeEach, describe, expect, it } from 'vitest';

import { MIRROR_CAPACITY, useEventBus, emitPipelineEvent, runCommand, setEventSink } from './eventBus';
import { memorySink } from './eventSink';
import { IDLE } from './runMachine';

import type { EventSink } from './eventSink';

let sink: EventSink;

beforeEach(async () => {
  sink = memorySink();
  setEventSink(sink);
  useEventBus.setState({ recent: [], run: IDLE });
});

describe('шина событий', () => {
  it('издаёт событие в зеркало и в журнал', async () => {
    emitPipelineEvent({ runId: 'r1', phase: 'start', stage: 'spine' });

    expect(useEventBus.getState().recent).toHaveLength(1);
    expect(await sink.tail(10)).toHaveLength(1);
  });

  it('у событий разные идентификаторы даже в одну миллисекунду', () => {
    emitPipelineEvent({ runId: 'r1', phase: 'start', stage: 'spine' });
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });

    const [a, b] = useEventBus.getState().recent;
    expect(a.id).not.toBe(b.id);
  });

  it('зеркало не растёт бесконечно', () => {
    for (let i = 0; i < MIRROR_CAPACITY + 20; i++) {
      emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });
    }

    expect(useEventBus.getState().recent).toHaveLength(MIRROR_CAPACITY);
  });
});

describe('прогон двигается событиями', () => {
  it('счётчик растёт от готовых позиций', () => {
    runCommand({ type: 'plan', runId: 'r1', total: 2 });
    runCommand({ type: 'sign' });

    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine', cost: 0.5 });

    const { run } = useEventBus.getState();
    expect(run.completed).toBe(1);
    expect(run.spent).toBeCloseTo(0.5);
  });

  it('коммит закрывает прогон', () => {
    runCommand({ type: 'plan', runId: 'r1', total: 1 });
    runCommand({ type: 'sign' });
    emitPipelineEvent({ runId: 'r1', phase: 'commit', stage: 'spine' });

    expect(useEventBus.getState().run.phase).toBe('done');
  });
});

describe('подъём журнала', () => {
  it('возвращает то, что было записано до перезагрузки', async () => {
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });
    useEventBus.setState({ recent: [] });

    await useEventBus.getState().hydrate();

    expect(useEventBus.getState().recent).toHaveLength(1);
  });

  it('не затирает события, случившиеся пока читался журнал', async () => {
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });
    const live = useEventBus.getState().recent[0];

    await useEventBus.getState().hydrate();

    const ids = useEventBus.getState().recent.map(e => e.id);
    expect(ids.filter(id => id === live.id)).toHaveLength(1);
  });

  it('очистка сносит и зеркало, и журнал', async () => {
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });

    await useEventBus.getState().clear();

    expect(useEventBus.getState().recent).toEqual([]);
    expect(await sink.tail(10)).toEqual([]);
  });
});
