import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Прогон рассказывает о себе типизированными событиями, а не только строками
 * консоли: из них живут «Лента», прогресс-полоса и машина прогона.
 *
 * Транспорт мокнут так, чтобы стадии прошли быстро и разными путями: первый
 * вызов доходит до батча (это даёт «попытку» со стоимостью), остальные падают
 * ещё на запуске — каст сползает в стаб («готово»), мир и календарь роняют
 * прогон («сбой»).
 */
const { transport, status, calls } = vi.hoisted(() => {
  const calls = { n: 0 };
  return {
    calls,
    transport: vi.fn(async () => {
      calls.n += 1;
      if (calls.n > 1) throw new Error('транспорт недоступен');
      return { data: { batchId: 'b1' }, error: undefined };
    }),
    status: vi.fn(async () => ({
      data: { done: true, failed: [{ error: 'нарочно' }], completed: [] },
      error: undefined,
      response: { status: 200 },
    })),
  };
});

vi.mock('@root/text_gen/generated_client', () => ({
  generateAnchorBeat: transport,
  generateAnchorTransition: transport,
  generateCastPlan: transport,
  generateDialogueQa: transport,
  generateDialogueUnit: transport,
  generateEnding: transport,
  generateEventPool: transport,
  generateSpine: transport,
  generateWorldCalendar: transport,
  getBatchStatus: status,
}));

import { useEventBus, runCommand, setEventSink } from '@/processes/eventBus';
import { memorySink } from '@/processes/eventSink';
import { IDLE } from '@/processes/runMachine';

import { startCalendarRun } from './calendarRunner';
import { useNarrativeStore } from './narrativeStore';
import { clearRunLog } from './runLog';

import type { EventPhase, PipelineEvent } from '@/processes/events';
import type { Brief } from './types';

const brief = {
  version: '0.1',
  seed: 1,
  genre: 'romance_vn',
  format: 'single_arc',
  scale: {
    acts: 3,
    targetDurationMinutes: 60,
    branchingDensity: 'low',
    commonRouteShare: 0.5,
    branchPointBudget: 1,
  },
  endingsProfile: ['good', 'normal', 'bad'],
  world: {
    setting: { era: 'наши дни', place: 'город', specifics: '' },
    tone: { mood: 'тёплый', themes: [], intensity: 0.5 },
  },
  artStyle: { referenceDescriptor: '', colorPalette: [], modelPromptTemplate: '' },
  protagonist: { gender: 'female', namePlaceholder: 'Я', voiceStyle: 'neutral_minimal' },
  loveInterests: [{ id: 'kira', name: 'Кира' }],
} as unknown as Brief;

const events = (): PipelineEvent[] => useEventBus.getState().recent;
const of = (phase: EventPhase) => events().filter(e => e.phase === phase);

describe('прогон рассказывает о себе событиями', () => {
  beforeEach(() => {
    clearRunLog();
    transport.mockClear();
    calls.n = 0;
    setEventSink(memorySink());
    useEventBus.setState({ recent: [], run: IDLE });
    useNarrativeStore.setState({ calendarRun: null, castPlan: null, worldModel: null, calendar: null });
  });

  it('старт называет прогон, стадии докладывают о себе, падение объясняется', async () => {
    await startCalendarRun(brief, { force: true });

    // Первое событие — план: им машина и узнаёт имя прогона.
    expect(events()[0]?.phase).toBe('plan');

    // Каст взят в работу и закрыт стабом; мир с календарём взяты и упали.
    expect(of('start').map(e => e.stage)).toEqual(expect.arrayContaining(['cast', 'calendar']));
    expect(of('done').map(e => e.stage)).toContain('cast');
    expect(of('fail').map(e => e.stage)).toContain('calendar');
    expect(of('fail')[0]?.reason).toBeTruthy();
  }, 15_000);

  it('попытка несёт стоимость — деньги видно по ходу, а не в конце', async () => {
    await startCalendarRun(brief, { force: true });

    const attempt = of('attempt')[0];
    expect(attempt?.stage).toBe('cast');
    expect(attempt?.attempt).toBe(1);
    expect(attempt?.cost).toBeGreaterThan(0);
  }, 15_000);

  it('машина прогона движется этими же событиями', async () => {
    runCommand({ type: 'plan', total: 2 });
    runCommand({ type: 'sign' });

    await startCalendarRun(brief, { force: true });

    const { run } = useEventBus.getState();
    // Прогон назвал себя сам, каст засчитан, сбой стадии остановил машину.
    expect(run.runId).not.toBeNull();
    expect(run.completed).toBeGreaterThan(0);
    expect(run.spent).toBeGreaterThan(0);
    expect(run.phase).toBe('failed');
  }, 15_000);
});
