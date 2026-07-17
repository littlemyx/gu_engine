import { describe, expect, it } from 'vitest';
import { REL_DELTA_BOUND, guardFiredIds, parseEventPool, unitEstablishes, validateEventUnits } from './parseEventPool';
import { guardFlags } from './validateSpine';
import { PHASES_PER_SLOT } from './calendarTypes';
import type { Calendar, CharacterSchedule, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { Brief } from './types';

const brief: Brief = SAMPLE_BRIEF;

const cal: Calendar = {
  days: 4,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 12,
  actBoundaries: [0, 1, 2, 3],
};

const beat = (patch: Partial<SpineBeat> & Pick<SpineBeat, 'id'>): SpineBeat => ({
  kind: 'beat',
  act: 1,
  window: { fromSlot: 0, toSlot: 2 },
  locationId: 'loc_a',
  participants: [],
  summary: 'событие',
  establishes: [],
  guard: { all: [] },
  ...patch,
});

const spine: SpinePlan = {
  title: 'Тест',
  logline: 'Интро.',
  beats: [beat({ id: 'b1', establishes: ['met_all'] })],
  endings: [{ id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } }],
};

/** Кира весь календарь в loc_a. */
const schedule: CharacterSchedule = { kira: new Array(12).fill('loc_a') };

const shell = (patch: Record<string, unknown>) => ({
  id: 'talk',
  arcStage: 1,
  goal: 'Разговориться.',
  locationId: 'loc_a',
  window: { fromSlot: 0, toSlot: 3 },
  requires: [],
  establishes: [],
  relEffects: [{ var: 'affection', delta: 0.1 }],
  ...patch,
});

const parse = (units: Record<string, unknown>[], stageCount = 3) =>
  parseEventPool(JSON.stringify({ units }), 'kira', stageCount);

describe('parseEventPool', () => {
  it('строит EventUnit: префикс id, kind dialogue, at, scene, priority, source', () => {
    const [unit] = parse([shell({ establishes: ['knows_taste'] })]);
    expect(unit.id).toBe('evt_kira_talk');
    expect(unit.kind).toBe('dialogue');
    expect(unit.participants).toEqual(['kira']);
    expect(unit.at).toEqual({ slot: { fromSlot: 0, toSlot: 3 }, locationId: 'loc_a' });
    expect(unit.scene).toEqual({ kind: 'dialogue', anchorId: 'evt_kira_talk', liId: 'kira' });
    expect(unit.priority).toBe(20);
    expect(unit.source).toBe('agenda');
    expect(unit.goal).toBe('Разговориться.');
    expect(unitEstablishes(unit)).toEqual(['knows_taste']);
  });

  it('rel-эффекты клампятся в ±0.3, establishes → setFlag', () => {
    const [unit] = parse([shell({ relEffects: [{ var: 'trust', delta: 0.9 }], establishes: ['x'] })]);
    const rel = unit.effects.find(e => 'rel' in e);
    expect(rel && 'rel' in rel && rel.rel.delta).toBe(REL_DELTA_BOUND);
    expect(unit.effects.some(e => 'setFlag' in e && e.setFlag === 'x')).toBe(true);
  });

  it('fired-цепочка стадий строится автоматически: стадия N зависит от САМОГО РАННЕГО юнита N-1', () => {
    // Раньше гейтом был последний юнит стадии ПО ПОЗИЦИИ В МАССИВЕ. Живой
    // прогон показал, чего это стоит: модель перечислила поздний юнит
    // последним, и вся верхушка арки Киры (6 юнитов) стала недостижима —
    // встречи открывались раньше, чем мог сработать их же гейт. Порядок в
    // массиве не несёт смысла; смысл гейта — «стадия N−1 пройдена», и самый
    // ранний юнит выражает его слабее всех, оставляя следующей стадии
    // максимум играбельных окон.
    const units = parse([
      shell({ id: 'u1', arcStage: 1 }), // окно 0..3 — раньше u2
      shell({ id: 'u2', arcStage: 1, window: { fromSlot: 2, toSlot: 5 } }),
      shell({ id: 'u3', arcStage: 2, window: { fromSlot: 4, toSlot: 7 } }),
      shell({ id: 'u4', arcStage: 3, window: { fromSlot: 8, toSlot: 11 } }),
    ]);
    expect(guardFiredIds(units[0].guard)).toEqual([]);
    expect(guardFiredIds(units[2].guard)).toEqual(['evt_kira_u1']); // самый ранний стадии 1
    expect(guardFiredIds(units[3].guard)).toEqual(['evt_kira_u3']);
  });

  it('requires уходят в guard как флаги', () => {
    const [unit] = parse([shell({ requires: ['met_all'] })]);
    expect(guardFlags(unit.guard)).toEqual(['met_all']);
  });
});

describe('validateEventUnits', () => {
  const validate = (units: EventUnit[]) => validateEventUnits(units, brief, cal, spine, schedule);
  const errorsOf = (units: EventUnit[]) => validate(units).filter(i => i.severity === 'error');

  /** Полная лестница календаря (4 дня → 5 ступеней), без дыр. */
  const fullPool = () =>
    parse(
      [
        shell({ id: 'u1', arcStage: 1 }),
        shell({ id: 'u2', arcStage: 2, window: { fromSlot: 2, toSlot: 5 } }),
        shell({ id: 'u3', arcStage: 3, window: { fromSlot: 4, toSlot: 7 } }),
        shell({ id: 'u4', arcStage: 4, window: { fromSlot: 6, toSlot: 9 } }),
        shell({ id: 'u5', arcStage: 5, window: { fromSlot: 8, toSlot: 11 } }),
      ],
      5,
    );

  it('валидный пул проходит без ошибок и warning-ов', () => {
    expect(validate(fullPool())).toEqual([]);
  });

  describe('временнáя выполнимость fired-цепочки ступеней', () => {
    // Цепочку строит САМ парсер: ступень N вешается на юнит ступени N−1.
    // Оба дефекта ниже пришли из живого прогона (арка Киры, 6 мёртвых юнитов).

    it('гейтом ступени становится самый ранний юнит, а не последний в массиве', () => {
      // Модель перечислила поздний юнит последним. Пока гейт брался по позиции
      // в массиве, встреча ступени 2 в слотах 3..4 ждала событие из слота 8 и
      // была недостижима — при том, что ранний юнит той же ступени открыт в 0.
      const units = parse([
        shell({ id: 'early', arcStage: 1, window: { fromSlot: 0, toSlot: 1 } }),
        shell({ id: 'late', arcStage: 1, window: { fromSlot: 8, toSlot: 9 } }),
        shell({ id: 'next', arcStage: 2, window: { fromSlot: 3, toSlot: 4 } }),
      ]);
      const next = units.find(u => u.id.endsWith('_next'))!;
      expect(guardFiredIds(next.guard)).toEqual(['evt_kira_early']);
      expect(errorsOf(units).filter(i => i.message.includes('не успеет'))).toEqual([]);
    });

    it('ступень открыта раньше своей зависимости — error с подсказкой в фидбек', () => {
      // Неисправимо сдвигом окон: окно связано с локацией и расписанием
      // персонажа. Окно выбирает модель — ей и сообщаем, какое именно мешает.
      const units = parse([
        shell({ id: 'habit', arcStage: 1, window: { fromSlot: 8, toSlot: 9 } }),
        shell({ id: 'open_up', arcStage: 2, window: { fromSlot: 1, toSlot: 2 } }),
      ]);
      const e = errorsOf(units);
      expect(e.some(i => i.scope === 'units/evt_kira_open_up' && i.message.includes('evt_kira_habit'))).toBe(true);
      expect(e.some(i => i.message.includes('после слота 8'))).toBe(true);
    });

    it('окна внахлёст чинит ремонт ступени — ошибки нет', () => {
      // Валидатор судит ПОЧИНЕННЫЙ граф (тот же, что компилятор и prune).
      // Здесь окно b (2..3) пересекается с окном зависимости (3..4), но подъём
      // к полу ступени растягивает его до 3..5 — a успевает в слоте 3, b
      // играется в 4..5. Ругаться не на что, и ругаться нельзя: первый же
      // прогон этого валидатора завалил стадию на рабочем пуле именно так.
      const units = parse([
        shell({ id: 'a', arcStage: 1, window: { fromSlot: 3, toSlot: 4 } }),
        shell({ id: 'b', arcStage: 2, window: { fromSlot: 2, toSlot: 3 } }),
      ]);
      expect(errorsOf(units)).toEqual([]);
    });
  });

  it('дыра в лестнице → warning: отношения прыгнут через ступень', () => {
    // Пул без ступени 3: между «привыкли общаться» и «делюсь сокровенным»
    // не остаётся промежуточного шага — ровно репортнутый скачок.
    const holed = parse(
      [
        shell({ id: 'u1', arcStage: 1 }),
        shell({ id: 'u2', arcStage: 2, window: { fromSlot: 2, toSlot: 5 } }),
        shell({ id: 'u4', arcStage: 4, window: { fromSlot: 6, toSlot: 9 } }),
        shell({ id: 'u5', arcStage: 5, window: { fromSlot: 8, toSlot: 11 } }),
      ],
      5,
    );
    expect(validate(holed).some(i => i.scope === 'pool/kira' && i.message.includes('ступени 3'))).toBe(true);
  });

  it('ступень выше вершины лестницы клампится (иначе висела бы недостижимой)', () => {
    const [u] = parse([shell({ id: 'u9', arcStage: 9 })], 5);
    expect(u.arcStage).toBe(5);
  });

  it('окно вне календаря — error', () => {
    const units = parse([shell({ window: { fromSlot: 10, toSlot: 14 } })]);
    expect(errorsOf(units).some(i => i.message.includes('выходит за календарь'))).toBe(true);
  });

  it('локация, где персонажа не бывает в окне — error', () => {
    const units = parse([shell({ locationId: 'loc_ghost' })]);
    expect(errorsOf(units).some(i => i.message.includes('не бывает'))).toBe(true);
  });

  it('неизвестный requires-флаг — error; флаг хребта и флаг другого юнита — известны', () => {
    const bad = parse([shell({ requires: ['ghost_flag'] })]);
    expect(errorsOf(bad).some(i => i.message.includes('"ghost_flag"'))).toBe(true);

    const good = parse([
      shell({ id: 'u1', establishes: ['unit_flag'] }),
      shell({ id: 'u2', requires: ['met_all', 'unit_flag'], window: { fromSlot: 2, toSlot: 5 } }),
    ]);
    expect(errorsOf(good).filter(i => i.message.includes('требует флаг'))).toEqual([]);
  });

  it('rel-дельта вне границ — error (на юните, собранном вручную)', () => {
    const [unit] = fullPool();
    const broken: EventUnit = {
      ...unit,
      effects: [{ rel: { char: 'kira', var: 'affection', delta: 0.5 } }],
    };
    expect(errorsOf([broken]).some(i => i.message.includes('вне границ'))).toBe(true);
  });

  it('пул меньше лестницы — warning с целевым диапазоном', () => {
    const units = parse([shell({})]);
    expect(
      validate(units).some(i => i.severity === 'warning' && i.scope === 'pool/kira' && i.message.includes('ступеней')),
    ).toBe(true);
  });
});

describe('parseEventPool: окно восприимчивости (timing)', () => {
  it('timing юнита переводится в окно фаз', () => {
    const [early, late, any] = parse([
      shell({ id: 'e', timing: 'early' }),
      shell({ id: 'l', timing: 'late' }),
      shell({ id: 'a', timing: 'any' }),
    ]);
    expect(early.at.phase).toEqual({ fromPhase: 0, toPhase: 0 });
    expect(late.at.phase).toEqual({ fromPhase: PHASES_PER_SLOT - 1, toPhase: PHASES_PER_SLOT - 1 });
    expect(any.at.phase).toEqual({ fromPhase: 0, toPhase: PHASES_PER_SLOT - 1 });
  });

  it('timing не указан — фазы нет: дефолт доштампует лестница', () => {
    const [u] = parse([shell({ id: 'u' })]);
    expect(u.at.phase).toBeUndefined();
  });

  it('мусор в timing не роняет пул — поле опциональное, падать несоразмерно', () => {
    const [u] = parse([shell({ id: 'u', timing: 'посреди дня' })]);
    expect(u.at.phase).toBeUndefined();
  });
});
