import { beforeEach, describe, expect, it, vi } from 'vitest';

// Транспорт не должен быть тронут: стоп обязан сработать до сетевых вызовов.
const { transport } = vi.hoisted(() => ({
  transport: vi.fn(async () => {
    throw new Error('стоп не сработал: пайплайн полез в text_gen');
  }),
}));

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
  getBatchStatus: transport,
}));

import { requestStopCalendarRun, startCalendarRun } from './calendarRunner';
import { useNarrativeStore } from './narrativeStore';
import { clearRunLog, useRunLog } from './runLog';

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

describe('остановка прогона', () => {
  beforeEach(() => {
    clearRunLog();
    transport.mockClear();
    useNarrativeStore.setState({ calendarRun: null });
  });

  it('стоп обрывает прогон на ближайшей контрольной точке', async () => {
    // Старт синхронно доходит до первого сетевого вызова, поэтому он успевает
    // уйти всегда. Смысл стопа в другом: дальше пайплайн не идёт — ни ретраев
    // той же стадии, ни следующих стадий, сколько бы их ни оставалось.
    const started = startCalendarRun(brief, { force: true });
    requestStopCalendarRun();
    await started;

    const run = useNarrativeStore.getState().calendarRun;
    expect(run?.status).toBe('error');
    expect(run?.error).toBe('остановлено автором');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('в консоль пишется строка об остановке с сохранением черновика', async () => {
    const started = startCalendarRun(brief, { force: true });
    requestStopCalendarRun();
    await started;

    const texts = useRunLog.getState().lines.map(l => l.text);
    expect(texts.some(t => t.includes('прогон остановлен'))).toBe(true);
    expect(texts.some(t => t.includes('черновик сохранён'))).toBe(true);
  });

  it('после завершения флаг стопа сбрасывается — следующий запуск не глохнет', async () => {
    const first = startCalendarRun(brief, { force: true });
    requestStopCalendarRun();
    await first;

    // Второй прогон должен дойти до транспорта, раз стоп больше не запрошен.
    await startCalendarRun(brief, { force: true });
    expect(transport).toHaveBeenCalled();
  });
});
