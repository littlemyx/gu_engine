import { describe, expect, it } from 'vitest';
import type { Calendar, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { PHASES_PER_SLOT, guardFromRequires, ladderThreshold } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import {
  applyLadderGuards,
  archetypeAffectionStart,
  beatStage,
  effectiveStageCount,
  skipsNegativeBracket,
} from './ladderGuards';

const cal: Calendar = { days: 4, dayparts: ['утро', 'день', 'вечер'], slotCount: 12, actBoundaries: [0, 1, 2, 3] };

const unit = (patch: Partial<EventUnit> & Pick<EventUnit, 'id'>): EventUnit =>
  ({
    kind: 'dialogue',
    at: { slot: { fromSlot: 0, toSlot: 11 }, locationId: 'cafe' },
    participants: ['yuki'],
    guard: { all: [] },
    effects: [],
    priority: 20,
    goal: 'g',
    arcStage: 1,
    source: 'agenda',
    ...patch,
  } as EventUnit);

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
const emptySpine = spineOf([]);

/** Пороги affection в guard-е (то, что доедет до ребра как rel-условие). */
const relFloors = (guard: unknown): number[] => {
  const g = guard as { all?: { rel?: { var: string; op: string; value: number } }[] };
  return (g.all ?? []).flatMap(x => (x.rel && x.rel.var === 'affection' ? [x.rel.value] : []));
};
const unitById = (r: { units: EventUnit[] }, id: string) => r.units.find(u => u.id === id)!;

describe('effectiveStageCount', () => {
  it('легаси-пул со стадиями 1..3 остаётся трёхступенчатым', () => {
    const units = [unit({ id: 'a', arcStage: 1 }), unit({ id: 'b', arcStage: 3 })];
    expect(effectiveStageCount(units, cal)).toBe(3);
  });

  it('новый пул на 5 ступеней гейтится пятью', () => {
    const units = [unit({ id: 'a', arcStage: 1 }), unit({ id: 'e', arcStage: 5 })];
    expect(effectiveStageCount(units, cal)).toBe(5);
  });

  it('пул выше потолка календаря клампится (генерация ошиблась — гейтим по календарю)', () => {
    expect(effectiveStageCount([unit({ id: 'x', arcStage: 9 })], cal)).toBe(5); // 4 дня → 5
  });
});

describe('beatStage', () => {
  it('день бита → ступень по полам (N=5, 4 дня): [0,0,1,2,3]', () => {
    expect(beatStage(0, 5, 4)).toBe(2); // дни 0 и 1 держат ступени 1-2
    expect(beatStage(1, 5, 4)).toBe(3);
    expect(beatStage(2, 5, 4)).toBe(4);
    expect(beatStage(3, 5, 4)).toBe(5);
  });
});

describe('applyLadderGuards: rel-пороги юнитов', () => {
  it('ступень 1 порога не несёт — это точка входа в линию', () => {
    const r = applyLadderGuards([unit({ id: 'u1', arcStage: 1 })], emptySpine, cal, SAMPLE_BRIEF);
    expect(relFloors(unitById(r, 'u1').guard)).toEqual([]);
  });

  it('ступень s≥2 получает t(s) от старта архетипа этого LI', () => {
    const units = [unit({ id: 'u1', arcStage: 1 }), unit({ id: 'u3', arcStage: 3 })];
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    const a0 = archetypeAffectionStart(SAMPLE_BRIEF, 'yuki');
    expect(relFloors(unitById(r, 'u3').guard)).toEqual([ladderThreshold(a0, 3, 3)]);
  });

  it('идемпотентность: повторное применение не дублирует пороги', () => {
    const units = [unit({ id: 'u1', arcStage: 1 }), unit({ id: 'u3', arcStage: 3 })];
    const once = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    const twice = applyLadderGuards(once.units, once.spine, cal, SAMPLE_BRIEF);
    expect(relFloors(unitById(twice, 'u3').guard)).toHaveLength(1);
    expect(twice.units).toEqual(once.units);
  });

  it('исходные флаговые requires сохраняются рядом с порогом', () => {
    const units = [
      unit({ id: 'u1', arcStage: 1 }),
      unit({ id: 'u2', arcStage: 2, guard: guardFromRequires(['met_yuki']) }),
    ];
    const g = JSON.stringify(unitById(applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF), 'u2').guard);
    expect(g).toContain('met_yuki');
    expect(g).toContain('affection');
  });

  it('не-диалоговые юниты и чужие персонажи не трогаются', () => {
    const units = [
      unit({ id: 'amb', kind: 'ambient', arcStage: 3 }),
      unit({ id: 'ghost', arcStage: 3, participants: ['stranger'] }),
    ];
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    expect(relFloors(unitById(r, 'amb').guard)).toEqual([]);
    expect(relFloors(unitById(r, 'ghost').guard)).toEqual([]);
  });
});

describe('applyLadderGuards: полы окон (z)', () => {
  it('окно поздней ступени поднимается к полу дня', () => {
    // Ступень 3 при N=3 на 4 днях → пол дня 2 → слот 6.
    const units = [unit({ id: 'u3', arcStage: 3, at: { slot: { fromSlot: 0, toSlot: 11 }, locationId: 'cafe' } })];
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    expect(unitById(r, 'u3').at.slot!.fromSlot).toBe(6);
  });

  it('РЕГРЕСС: подъём пола НЕ инвертирует окно — toSlot тянется следом', () => {
    // LLM выдал позднюю ступень в первый день: [0,2]. Наивный кламп fromSlot=6
    // дал бы [6,2] → мёртвый юнит → обрыв всей цепочки арки и good-концовки.
    const units = [unit({ id: 'u3', arcStage: 3, at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'cafe' } })];
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    const w = unitById(r, 'u3').at.slot!;
    expect(w.fromSlot).toBeLessThanOrEqual(w.toSlot);
    expect(w).toEqual({ fromSlot: 6, toSlot: 8 });
    expect(r.plan.issues).toEqual([]);
  });

  it('окно, уже лежащее позже пола, не трогается', () => {
    const units = [unit({ id: 'u2', arcStage: 2, at: { slot: { fromSlot: 4, toSlot: 7 }, locationId: 'cafe' } })];
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    expect(unitById(r, 'u2').at.slot).toEqual({ fromSlot: 4, toSlot: 7 });
  });
});

describe('applyLadderGuards: биты LI в лестнице', () => {
  it('поздний бит LI получает rel-порог своей ступени', () => {
    // Регресс репортнутого бага: признание в парке (акт 3) гейтилось только
    // знакомством — теперь ещё и близостью. Пул несёт ступень 2, значит право
    // требовать её у бита есть.
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], act: 1, window: { fromSlot: 0, toSlot: 2 } }),
      beat({ id: 'confess', participants: ['yuki'], act: 3, window: { fromSlot: 6, toSlot: 8 } }),
    ]);
    const units = [
      unit({ id: 'u1', arcStage: 1 }),
      unit({ id: 'u2', arcStage: 2, at: { slot: { fromSlot: 4, toSlot: 7 }, locationId: 'cafe' } }),
    ];
    const r = applyLadderGuards(units, spine, cal, SAMPLE_BRIEF);
    const confess = r.spine.beats.find(b => b.id === 'confess')!;
    expect(relFloors(confess.guard).length).toBe(1);
    expect(relFloors(confess.guard)[0]).toBeGreaterThan(archetypeAffectionStart(SAMPLE_BRIEF, 'yuki'));
  });

  it('бит НЕ требует близости, которую пул не даёт заработать', () => {
    // Пул из одной ступени 1, а бит — на позднем дне. Требовать вершину
    // лестницы значило бы сделать сцену недостижимой навсегда: это не строгий
    // гейт, а мёртвый контент.
    const spine = spineOf([
      beat({ id: 'confess', participants: ['yuki'], act: 3, window: { fromSlot: 6, toSlot: 8 } }),
    ]);
    const r = applyLadderGuards([unit({ id: 'u1', arcStage: 1 })], spine, cal, SAMPLE_BRIEF);
    expect(relFloors(r.spine.beats.find(b => b.id === 'confess')!.guard)).toEqual([]);
  });

  it('ранний бит (ступень 1) и финал порогов не несут', () => {
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], act: 1, window: { fromSlot: 0, toSlot: 2 } }),
      beat({ id: 'fin', kind: 'finale', participants: ['yuki', 'kira'], act: 4, window: { fromSlot: 9, toSlot: 11 } }),
    ]);
    const r = applyLadderGuards([unit({ id: 'u1' })], spine, cal, SAMPLE_BRIEF);
    expect(relFloors(r.spine.beats.find(b => b.id === 'meet')!.guard)).toEqual([]);
    expect(relFloors(r.spine.beats.find(b => b.id === 'fin')!.guard)).toEqual([]);
  });

  it('сюжетный бит без LI порога не несёт', () => {
    const spine = spineOf([beat({ id: 'storm', participants: [], act: 3, window: { fromSlot: 6, toSlot: 8 } })]);
    const r = applyLadderGuards([unit({ id: 'u1' })], spine, cal, SAMPLE_BRIEF);
    expect(relFloors(r.spine.beats.find(b => b.id === 'storm')!.guard)).toEqual([]);
  });
});

describe('closing-гейны', () => {
  it('детерминированы и убывают к вершине лестницы', () => {
    const units = [unit({ id: 'u1', arcStage: 1 }), unit({ id: 'u3', arcStage: 3 })];
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    expect(r.plan.closingGain.get('u1')).toBeGreaterThan(0);
    expect(r.plan.closingGain.get('u3')).toBe(0); // вершина при N=3
  });
});

describe('skipsNegativeBracket', () => {
  const pool = [unit({ id: 'u1', arcStage: 1 }), unit({ id: 'u2', arcStage: 2 })];

  it('ступень 1 холодную прозу сохраняет — вход в линию открыт и холодному игроку', () => {
    expect(skipsNegativeBracket(unit({ id: 'u1', arcStage: 1 }), SAMPLE_BRIEF, cal, pool)).toBe(false);
  });

  it('ступень ≥2 требует тепла выше холодного порога → холодную прозу не генерим', () => {
    expect(skipsNegativeBracket(unit({ id: 'u2', arcStage: 2 }), SAMPLE_BRIEF, cal, pool)).toBe(true);
  });

  it('персонаж вне брифа не скипается', () => {
    expect(
      skipsNegativeBracket(unit({ id: 'x', arcStage: 2, participants: ['stranger'] }), SAMPLE_BRIEF, cal, pool),
    ).toBe(false);
  });
});

describe('applyLadderGuards: перецепка гейта ступени (H)', () => {
  // Регресс живого прогона. parseEventPool цепляет ступень N за юнит N−1, и
  // выбирал его ПО ПОЗИЦИИ В МАССИВЕ. Модель перечислила поздний юнит
  // последним — и верхушка арки Киры (ступени 3-5, шесть юнитов) стала
  // недостижима: встречи открывались раньше, чем их гейт вообще мог сработать.
  // Парсер исправлен, но цепочка ЗАПЕЧЕНА в сохранённых юнитах, поэтому
  // перецепка живёт здесь — на чтении, без миграции.
  const firedOf = (r: { units: EventUnit[] }, id: string) => {
    const g = unitById(r, id).guard as { all?: { fired?: string }[] };
    return (g.all ?? []).flatMap(x => (x.fired ? [x.fired] : []));
  };

  const pool = (): EventUnit[] => [
    unit({ id: 'early', arcStage: 1, at: { slot: { fromSlot: 0, toSlot: 1 }, locationId: 'cafe' } }),
    unit({ id: 'late', arcStage: 1, at: { slot: { fromSlot: 8, toSlot: 9 }, locationId: 'cafe' } }),
    // Запечённая цепочка указывает на ПОЗДНИЙ юнит — так делал старый парсер.
    unit({
      id: 'next',
      arcStage: 2,
      at: { slot: { fromSlot: 3, toSlot: 4 }, locationId: 'cafe' },
      guard: guardFromRequires([]),
    }),
  ];

  it('перевешивает fired с позднего юнита ступени на самый ранний', () => {
    const units = pool();
    (units[2].guard as { all: unknown[] }).all.push({ fired: 'late' });
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    expect(firedOf(r, 'next')).toEqual(['early']);
  });

  it('идемпотентна: повторное чтение ничего не меняет', () => {
    const units = pool();
    (units[2].guard as { all: unknown[] }).all.push({ fired: 'late' });
    const once = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    const twice = applyLadderGuards(once.units, emptySpine, cal, SAMPLE_BRIEF);
    expect(firedOf(twice, 'next')).toEqual(['early']);
  });

  it('ссылку на юнит ЧУЖОЙ линии не трогает: это не автоцепочка ступеней', () => {
    const units = pool();
    units.push(unit({ id: 'kira_beat', arcStage: 1, participants: ['kira'] }));
    (units[2].guard as { all: unknown[] }).all.push({ fired: 'kira_beat' });
    const r = applyLadderGuards(units, emptySpine, cal, SAMPLE_BRIEF);
    expect(firedOf(r, 'next')).toEqual(['kira_beat']);
  });
});

describe('applyLadderGuards: малая стрелка (окно восприимчивости)', () => {
  const phaseOf = (r: { units: EventUnit[] }, id: string) => unitById(r, id).at.phase;

  it('дефолт по ступени: глубокий разговор — на свежую голову, знакомство — когда угодно', () => {
    const r = applyLadderGuards(
      [unit({ id: 'greet', arcStage: 1 }), unit({ id: 'deep', arcStage: 2 })],
      emptySpine,
      cal,
      SAMPLE_BRIEF,
    );
    expect(phaseOf(r, 'greet')).toEqual({ fromPhase: 0, toPhase: PHASES_PER_SLOT - 1 });
    expect(phaseOf(r, 'deep')).toEqual({ fromPhase: 0, toPhase: 0 });
  });

  it('собственное окно юнита НЕ перетирается дефолтом', () => {
    // Восприимчивость — свойство сцены: «подбодрить вымотанную к концу смены»
    // обязано открываться поздно, даже будучи глубокой ступенью. Иначе дефолт
    // запретил бы целый класс арок.
    const late = { fromPhase: PHASES_PER_SLOT - 1, toPhase: PHASES_PER_SLOT - 1 };
    const u = unit({ id: 'cheer_up', arcStage: 3 });
    u.at = { ...u.at, phase: late };
    const r = applyLadderGuards([u], emptySpine, cal, SAMPLE_BRIEF);
    expect(phaseOf(r, 'cheer_up')).toEqual(late);
  });

  it('идемпотентна: повторное чтение не меняет окна фаз', () => {
    const once = applyLadderGuards([unit({ id: 'deep', arcStage: 2 })], emptySpine, cal, SAMPLE_BRIEF);
    const twice = applyLadderGuards(once.units, emptySpine, cal, SAMPLE_BRIEF);
    expect(phaseOf(twice, 'deep')).toEqual(phaseOf(once, 'deep'));
  });

  it('биты хребта фаза-агностичны: сюжет не зависит от того, сколько ты болтал', () => {
    const r = applyLadderGuards(
      [unit({ id: 'u1', arcStage: 1 })],
      spineOf([beat({ id: 'b_yuki', participants: ['yuki'], window: { fromSlot: 6, toSlot: 8 } })]),
      cal,
      SAMPLE_BRIEF,
    );
    const b = r.spine.beats.find(x => x.id === 'b_yuki')!;
    expect('phase' in (b as unknown as Record<string, unknown>)).toBe(false);
  });
});
