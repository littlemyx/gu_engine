import { describe, expect, it } from 'vitest';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { FILLER_RECOVERY_DELTA, ladderThreshold } from './calendarTypes';
import { archetypeAffectionStart } from './ladderGuards';
import { SAMPLE_BRIEF } from './sampleBrief';
import { computeUncoveredRuns, coverageIssues, fillerUnitId, synthesizeCoverageFillers } from './coverageUnits';

const cal: Calendar = { days: 4, dayparts: ['утро', 'день', 'вечер'], slotCount: 12, actBoundaries: [0, 1, 2, 3] };

const beat = (patch: Partial<SpineBeat> & Pick<SpineBeat, 'id'>): SpineBeat => ({
  kind: 'beat',
  act: 1,
  window: { fromSlot: 0, toSlot: 2 },
  locationId: 'loc_a',
  participants: [],
  summary: '',
  establishes: [],
  guard: { all: [] },
  ...patch,
});

const spineOf = (beats: SpineBeat[]): SpinePlan => ({ title: 't', logline: '', beats, endings: [] });

const unit = (patch: Partial<EventUnit> & Pick<EventUnit, 'id'>): EventUnit =>
  ({
    kind: 'dialogue',
    at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'cafe' },
    participants: ['yuki'],
    guard: { all: [] },
    effects: [],
    priority: 20,
    goal: 'g',
    source: 'agenda',
    ...patch,
  } as EventUnit);

const nulls = () => new Array<string | null>(12).fill(null);

/** Юки в кафе слоты 0-2, дальше за кадром. */
const cafeSchedule = (): CharacterSchedule => {
  const slots = nulls();
  slots[0] = slots[1] = slots[2] = 'cafe';
  return { yuki: slots };
};

describe('computeUncoveredRuns', () => {
  it('РЕПОРТНУТЫЙ БАГ: Юки в кафе без единого юнита → диапазон немой', () => {
    const runs = computeUncoveredRuns(spineOf([]), cal, cafeSchedule(), []);
    expect(runs).toEqual([{ liId: 'yuki', locId: 'cafe', fromSlot: 0, toSlot: 2 }]);
  });

  it('диапазон, покрытый юнитом той же локации, немым не считается', () => {
    const units = [unit({ id: 'evt_yuki_u1' })];
    expect(computeUncoveredRuns(spineOf([]), cal, cafeSchedule(), units)).toEqual([]);
  });

  it('юнит в ДРУГОЙ локации диапазон не покрывает', () => {
    const units = [unit({ id: 'evt_yuki_u1', at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'park' } })];
    expect(computeUncoveredRuns(spineOf([]), cal, cafeSchedule(), units)).toHaveLength(1);
  });

  it('юнит другого LI диапазон не покрывает', () => {
    const units = [unit({ id: 'evt_kira_u1', participants: ['kira'] })];
    expect(computeUncoveredRuns(spineOf([]), cal, cafeSchedule(), units)).toHaveLength(1);
  });

  it('юнит вне окна диапазона не покрывает', () => {
    const units = [unit({ id: 'evt_yuki_u1', at: { slot: { fromSlot: 6, toSlot: 8 }, locationId: 'cafe' } })];
    expect(computeUncoveredRuns(spineOf([]), cal, cafeSchedule(), units)).toHaveLength(1);
  });

  it('диапазон, целиком занятый битом хребта, немым не считается', () => {
    // Бит Юки в кафе назначен на слот 0; расписание — только этот слот.
    const slots = nulls();
    slots[0] = 'cafe';
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], locationId: 'cafe', window: { fromSlot: 0, toSlot: 0 } }),
    ]);
    expect(computeUncoveredRuns(spine, cal, { yuki: slots }, [])).toEqual([]);
  });

  it('слоты за кадром (null) диапазонов не создают', () => {
    expect(computeUncoveredRuns(spineOf([]), cal, { yuki: nulls() }, [])).toEqual([]);
  });
});

describe('synthesizeCoverageFillers', () => {
  it('на немой диапазон — ровно один филлер с детерминированным id', () => {
    const fillers = synthesizeCoverageFillers(spineOf([]), cal, cafeSchedule(), [], SAMPLE_BRIEF);
    expect(fillers).toHaveLength(1);
    expect(fillers[0].id).toBe(fillerUnitId('yuki', 'cafe', 0));
    expect(fillers[0]).toMatchObject({
      kind: 'dialogue',
      source: 'filler',
      arcStage: 1,
      participants: ['yuki'],
      at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'cafe' },
    });
  });

  it('идемпотентность: синтезированный филлер сам покрывает диапазон', () => {
    const first = synthesizeCoverageFillers(spineOf([]), cal, cafeSchedule(), [], SAMPLE_BRIEF);
    const second = synthesizeCoverageFillers(spineOf([]), cal, cafeSchedule(), first, SAMPLE_BRIEF);
    expect(second).toEqual([]);
  });

  it('канал восстановления: маленький гейн + потолок ниже ступени 2 (догнать можно, фармить нельзя)', () => {
    // Ступени гейтятся порогами, а сюжетные встречи одноразовы: без догоняющего
    // канала игрок, ушедший в минус, запирался бы навсегда — линия LI мертва до
    // конца истории. Но и источником близости болтовня быть не должна.
    const [filler] = synthesizeCoverageFillers(spineOf([]), cal, cafeSchedule(), [], SAMPLE_BRIEF);
    const rel = filler.effects.find(e => 'rel' in e);
    expect(rel && 'rel' in rel && rel.rel.delta).toBe(FILLER_RECOVERY_DELTA);
    expect(FILLER_RECOVERY_DELTA).toBeLessThan(0.05);

    // Потолок: как только игрок дорос до ступени 2, филлер закрывается.
    const g = filler.guard as { all: { rel?: { op: string; value: number } }[] };
    const gate = g.all.find(x => x.rel)!.rel!;
    expect(gate.op).toBe('<='); // движок строгих сравнений не умеет
    expect(gate.value).toBeCloseTo(ladderThreshold(archetypeAffectionStart(SAMPLE_BRIEF, 'yuki'), 2, 3));
  });

  it('персонаж вне брифа филлера не получает', () => {
    const slots = nulls();
    slots[0] = 'cafe';
    expect(synthesizeCoverageFillers(spineOf([]), cal, { stranger: slots }, [], SAMPLE_BRIEF)).toEqual([]);
  });
});

describe('coverageIssues', () => {
  it('немой диапазон → warning coverage/<li>', () => {
    const issues = coverageIssues(spineOf([]), cal, cafeSchedule(), []);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', scope: 'coverage/yuki' });
    expect(issues[0].message).toContain('cafe');
  });

  it('покрытое расписание — без замечаний', () => {
    expect(coverageIssues(spineOf([]), cal, cafeSchedule(), [unit({ id: 'evt_yuki_u1' })])).toEqual([]);
  });
});
