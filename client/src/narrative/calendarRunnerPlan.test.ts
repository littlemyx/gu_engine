import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Замок в смете — обещание: «эту позицию прогон не тронет». Раньше обещание
 * жило только в колл-щите, а раннер про замки не знал вовсе и переписывал
 * запертое. Здесь проверяется, что обещание исполняется — и данными, и деньгами.
 */
const { castTransport, otherTransport } = vi.hoisted(() => ({
  castTransport: vi.fn(async () => {
    throw new Error('каст заперт, а прогон полез его генерировать');
  }),
  otherTransport: vi.fn(async () => {
    throw new Error('транспорт недоступен');
  }),
}));

vi.mock('@root/text_gen/generated_client', () => ({
  generateAnchorBeat: otherTransport,
  generateAnchorTransition: otherTransport,
  generateCastPlan: castTransport,
  generateDialogueQa: otherTransport,
  generateDialogueUnit: otherTransport,
  generateEnding: otherTransport,
  generateEventPool: otherTransport,
  generateSpine: otherTransport,
  generateWorldCalendar: otherTransport,
  getBatchStatus: otherTransport,
}));

import { useEventBus, setEventSink } from '@/processes/eventBus';
import { memorySink } from '@/processes/eventSink';
import { IDLE } from '@/processes/runMachine';

import { startCalendarRun } from './calendarRunner';
import { useNarrativeStore } from './narrativeStore';
import { clearRunLog } from './runLog';

import type { CastPlan } from './calendarTypes';
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

/** Каст автора: нарочно «неправильный» — валидацию замок обязан обойти. */
const authoredCast = { members: [{ id: 'kira', agenda: 'написано автором' }] } as unknown as CastPlan;

const skipEvents = () => useEventBus.getState().recent.filter(e => e.phase === 'skip');

describe('прогон обходит запертое', () => {
  beforeEach(() => {
    clearRunLog();
    castTransport.mockClear();
    otherTransport.mockClear();
    setEventSink(memorySink());
    useEventBus.setState({ recent: [], run: IDLE });
    useNarrativeStore.setState({ calendarRun: null, castPlan: authoredCast, worldModel: null, calendar: null });
  });

  it('запертую стадию не генерируют и за неё не платят', async () => {
    await startCalendarRun(brief, { force: true, plan: { skip: ['cast/'], force: [], keepFresh: [] } });

    expect(castTransport).not.toHaveBeenCalled();
    expect(skipEvents().some(e => e.artifactKey === 'cast/' && e.reason === 'заперто автором')).toBe(true);
  });

  it('запертое доезжает до коммита нетронутым — черновик несёт версию автора', async () => {
    await startCalendarRun(brief, { force: true, plan: { skip: ['cast/'], force: [], keepFresh: [] } });

    expect(useNarrativeStore.getState().calendarRun?.draft.castPlan).toBe(authoredCast);
  });

  // «Пересобрать всё» сильнее кэша, но не сильнее замка: иначе кнопка полной
  // пересборки тихо стирала бы ровно то, что автор просил не трогать.
  it('замок сильнее «пересобрать всё»', async () => {
    await startCalendarRun(brief, { force: true, plan: { skip: ['cast/'], force: [], keepFresh: [] } });

    expect(castTransport).not.toHaveBeenCalled();
  });

  it('без плана прогон ведёт себя как прежде — каст генерируется', async () => {
    await startCalendarRun(brief, { force: true });

    expect(castTransport).toHaveBeenCalled();
  });
});
