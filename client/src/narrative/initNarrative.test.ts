import { describe, expect, it } from 'vitest';
import { collectMediaBatches, decideInitAction, parseCalendarRunFromRaw } from './initNarrative';
import type { CalendarRunState } from './calendarRunState';

const run = (status: CalendarRunState['status']): CalendarRunState => ({ status } as CalendarRunState);

describe('decideInitAction', () => {
  it('продолжает только незавершённый прогон', () => {
    expect(decideInitAction(run('running'))).toBe('resume');
    expect(decideInitAction(run('error'))).toBe('noop');
    expect(decideInitAction(run('done'))).toBe('noop');
    expect(decideInitAction(null)).toBe('noop');
    expect(decideInitAction(undefined)).toBe('noop');
  });
});

describe('parseCalendarRunFromRaw', () => {
  it('достаёт calendarRun из сырого значения стора', () => {
    const raw = JSON.stringify({ state: { calendarRun: { status: 'running', phase: 'spine' } }, version: 12 });
    expect(parseCalendarRunFromRaw(raw)).toEqual({ status: 'running', phase: 'spine' });
  });

  it('null-значение стора → calendarRun == null (а не «пропустить»)', () => {
    expect(parseCalendarRunFromRaw(JSON.stringify({ state: {} }))).toBeNull();
  });

  it('непарсимое значение → undefined (событие пропускается)', () => {
    expect(parseCalendarRunFromRaw('{битый')).toBeUndefined();
    expect(parseCalendarRunFromRaw(null)).toBeUndefined();
  });
});

describe('collectMediaBatches', () => {
  const empty = {
    images: {},
    characters: {},
    audioBase: null,
    audioMoodBeds: {},
    audioSpecialBeds: {},
    audioByLi: {},
    audioSfxState: null,
  };

  it('собирает только записи со status=generating', () => {
    const refs = collectMediaBatches({
      ...empty,
      images: {
        'loc:cafe': { status: 'generating', batchId: 'img-1' },
        'loc:park': { status: 'done', filename: 'park.png' },
        'loc:home': { status: 'failed', error: 'нет' },
      },
      characters: { kira: { status: 'generating', batchId: 'ch-1' } },
      audioBase: { status: 'generating', batchId: 'aud-base' },
      audioMoodBeds: { warm_cozy: { status: 'done', filenames: ['a.mp3'], selected: 0 } },
      audioSpecialBeds: { club: { status: 'generating', batchId: 'aud-club' } },
      audioByLi: { kira: { positive: { status: 'generating', batchId: 'aud-kira-pos' } } },
      audioSfxState: { status: 'generating', batchId: 'sfx-1' },
    });

    expect(refs).toEqual([
      { kind: 'image', key: 'loc:cafe', batchId: 'img-1' },
      { kind: 'character', liId: 'kira', batchId: 'ch-1' },
      { kind: 'audioBase', batchId: 'aud-base' },
      { kind: 'audioSpecialBed', specialKind: 'club', batchId: 'aud-club' },
      { kind: 'audioVariation', liId: 'kira', tone: 'positive', batchId: 'aud-kira-pos' },
      { kind: 'audioSfx', batchId: 'sfx-1' },
    ]);
  });

  it('пустой стор не даёт работы', () => {
    expect(collectMediaBatches(empty)).toEqual([]);
  });
});
