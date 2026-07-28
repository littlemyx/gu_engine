import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useRunLog } from '@/narrative/runLog';

import { bridgeEventsToConsole, eventsAfter, stopConsoleBridge } from './consoleBridge';
import { emitPipelineEvent, setEventSink, useEventBus } from './eventBus';
import { memorySink } from './eventSink';
import { stampEvent } from './events';
import { IDLE } from './runMachine';

beforeEach(() => {
  setEventSink(memorySink());
  useEventBus.setState({ recent: [], run: IDLE });
  useRunLog.getState().clear();
});

afterEach(stopConsoleBridge);

const event = (phase: 'done' | 'fail', message?: string) =>
  stampEvent({ runId: 'r1', phase, stage: 'spine', message } as never);

describe('какие события ещё не проговорены', () => {
  it('с пустой отметки — все', () => {
    const events = [event('done'), event('done')];
    expect(eventsAfter(events, null)).toHaveLength(2);
  });

  it('после известного — только новые', () => {
    const events = [event('done'), event('done'), event('done')];
    expect(eventsAfter(events, events[0].id)).toHaveLength(2);
  });

  it('ничего нового — пусто', () => {
    const events = [event('done')];
    expect(eventsAfter(events, events[0].id)).toEqual([]);
  });

  it('отметка вытеснена из кольца — проговариваем всё, что осталось', () => {
    const events = [event('done'), event('done')];
    expect(eventsAfter(events, 'давно-вытеснено')).toHaveLength(2);
  });
});

describe('мост', () => {
  it('превращает событие в строку консоли', () => {
    bridgeEventsToConsole();
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });

    const lines = useRunLog.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].tone).toBe('ok');
    expect(lines[0].text).toContain('spine');
  });

  it('сбой окрашивается ошибкой и называет причину', () => {
    bridgeEventsToConsole();
    emitPipelineEvent({ runId: 'r1', phase: 'fail', stage: 'spine', reason: 'таймаут' });

    const [line] = useRunLog.getState().lines;
    expect(line.tone).toBe('error');
    expect(line.text).toContain('таймаут');
  });

  it('своё сообщение события важнее автоматического', () => {
    bridgeEventsToConsole();
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine', message: 'хребет собран' });

    expect(useRunLog.getState().lines[0].text).toBe('хребет собран');
  });

  it('не повторяет уже проговорённое', () => {
    bridgeEventsToConsole();
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'cast' });

    expect(useRunLog.getState().lines).toHaveLength(2);
  });

  it('повторный запуск моста не удваивает строки', () => {
    bridgeEventsToConsole();
    bridgeEventsToConsole();
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });

    expect(useRunLog.getState().lines).toHaveLength(1);
  });

  it('события до подключения моста в консоль не попадают задним числом', () => {
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });
    bridgeEventsToConsole();

    expect(useRunLog.getState().lines).toEqual([]);
  });

  it('после отключения строки не пишутся', () => {
    bridgeEventsToConsole();
    stopConsoleBridge();
    emitPipelineEvent({ runId: 'r1', phase: 'done', stage: 'spine' });

    expect(useRunLog.getState().lines).toEqual([]);
  });
});
