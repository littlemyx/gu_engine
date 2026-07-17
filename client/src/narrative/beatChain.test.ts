import { describe, expect, it } from 'vitest';
import { guardFromRequires } from './calendarTypes';
import type { Calendar, EventUnit, SpineBeat, SpinePlan } from './calendarTypes';
import { guardFiredIds } from './events';
import { assignBeatSlots } from './beatSchedule';
import { PLOT_LINE, applyBeatChain, deriveBeatChain, gatingUnitFor, storylineKeys } from './beatChain';

// 4 дня × 3 части дня = 12 слотов; акты по дню: act1=[0,2] act2=[3,5] act3=[6,8] act4=[9,11].
const cal: Calendar = { days: 4, dayparts: ['утро', 'день', 'вечер'], slotCount: 12, actBoundaries: [0, 1, 2, 3] };

const LI = new Set(['yuki', 'kira']);

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

const spineOf = (beats: SpineBeat[]): SpinePlan => ({ title: 't', logline: '', beats, endings: [] });

const unit = (patch: Partial<EventUnit> & Pick<EventUnit, 'id'>): EventUnit =>
  ({
    kind: 'dialogue',
    at: { slot: { fromSlot: 0, toSlot: 0 }, locationId: 'cafe' },
    participants: ['yuki'],
    guard: { all: [] },
    effects: [],
    priority: 20,
    goal: 'знакомство',
    source: 'agenda',
    ...patch,
  } as EventUnit);

const firedOf = (spine: SpinePlan, id: string) => guardFiredIds(spine.beats.find(b => b.id === id)!.guard);

describe('storylineKeys', () => {
  it('реальные LI — линии бита; плейсхолдеры и чужие id игнорируются', () => {
    expect(storylineKeys(beat({ id: 'b', participants: ['yuki', 'kira'] }), LI)).toEqual(['yuki', 'kira']);
    expect(storylineKeys(beat({ id: 'b', participants: ['yuki', '$closestLI'] }), LI)).toEqual(['yuki']);
  });

  it('бит без реальных LI (пусто / только $role / чужой id) → линия $plot', () => {
    expect(storylineKeys(beat({ id: 'b', participants: [] }), LI)).toEqual([PLOT_LINE]);
    expect(storylineKeys(beat({ id: 'b', participants: ['$closestLI'] }), LI)).toEqual([PLOT_LINE]);
    expect(storylineKeys(beat({ id: 'b', participants: ['stranger'] }), LI)).toEqual([PLOT_LINE]);
  });
});

describe('deriveBeatChain — порядок линии', () => {
  it('биты одного LI цепляются по возрастанию слота', () => {
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], window: { fromSlot: 0, toSlot: 0 } }),
      beat({ id: 'walk', participants: ['yuki'], window: { fromSlot: 3, toSlot: 3 } }),
      beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 6 } }),
    ]);
    const { predecessors } = deriveBeatChain(spine, cal, LI);
    expect(predecessors.get('meet')).toBeUndefined();
    expect(predecessors.get('walk')).toEqual(['meet']);
    expect(predecessors.get('confess')).toEqual(['walk']);
  });

  it('первый бит линии — голова', () => {
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], window: { fromSlot: 0, toSlot: 0 } }),
      beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 6 } }),
    ]);
    expect(deriveBeatChain(spine, cal, LI).heads.get('yuki')).toBe('meet');
  });

  it('линии разных LI независимы', () => {
    const spine = spineOf([
      beat({ id: 'y1', participants: ['yuki'], window: { fromSlot: 0, toSlot: 0 } }),
      beat({ id: 'k1', participants: ['kira'], window: { fromSlot: 1, toSlot: 1 } }),
      beat({ id: 'y2', participants: ['yuki'], window: { fromSlot: 6, toSlot: 6 } }),
    ]);
    const { predecessors } = deriveBeatChain(spine, cal, LI);
    expect(predecessors.get('y2')).toEqual(['y1']); // не k1
    expect(predecessors.get('k1')).toBeUndefined();
  });

  it('мульти-LI бит — конъюнкция предшественников обеих линий', () => {
    const spine = spineOf([
      beat({ id: 'y1', participants: ['yuki'], window: { fromSlot: 0, toSlot: 0 } }),
      beat({ id: 'k1', participants: ['kira'], window: { fromSlot: 1, toSlot: 1 } }),
      beat({ id: 'both', participants: ['yuki', 'kira'], window: { fromSlot: 6, toSlot: 6 } }),
    ]);
    expect(deriveBeatChain(spine, cal, LI).predecessors.get('both')?.sort()).toEqual(['k1', 'y1']);
  });

  it('finale не цепляется и головой линии не считается', () => {
    const spine = spineOf([
      beat({ id: 'y1', participants: ['yuki'], window: { fromSlot: 0, toSlot: 0 } }),
      beat({ id: 'fin', kind: 'finale', participants: ['yuki', 'kira'], act: 4, window: { fromSlot: 9, toSlot: 11 } }),
    ]);
    const { predecessors, heads } = deriveBeatChain(spine, cal, LI);
    expect(predecessors.get('fin')).toBeUndefined();
    expect(heads.get('kira')).toBeUndefined(); // финал — единственный бит kira
  });

  it('бит взаимоисключающей ветки предшественником НЕ становится', () => {
    // path_a требует chose_a, path_b — chose_b: на одном листе не живут.
    // Предшественник path_b — развилка (её селекторы ⊆ селекторов path_b).
    const spine = spineOf([
      beat({
        id: 'bp',
        kind: 'branchPoint',
        participants: ['yuki'],
        window: { fromSlot: 0, toSlot: 0 },
        outcomes: [
          { id: 'a', label: 'a', setsFlag: 'chose_a', summary: '' },
          { id: 'b', label: 'b', setsFlag: 'chose_b', summary: '' },
        ],
      }),
      beat({
        id: 'path_a',
        participants: ['yuki'],
        window: { fromSlot: 3, toSlot: 3 },
        guard: guardFromRequires(['chose_a']),
      }),
      beat({
        id: 'path_b',
        participants: ['yuki'],
        window: { fromSlot: 4, toSlot: 4 },
        guard: guardFromRequires(['chose_b']),
      }),
    ]);
    const { predecessors } = deriveBeatChain(spine, cal, LI);
    expect(predecessors.get('path_b')).toEqual(['bp']);
    expect(predecessors.get('path_a')).toEqual(['bp']);
  });

  it('ветвевой бит цепляется за более поздний бит СВОЕЙ ветки', () => {
    const spine = spineOf([
      beat({
        id: 'bp',
        kind: 'branchPoint',
        participants: ['yuki'],
        window: { fromSlot: 0, toSlot: 0 },
        outcomes: [
          { id: 'a', label: 'a', setsFlag: 'chose_a', summary: '' },
          { id: 'b', label: 'b', setsFlag: 'chose_b', summary: '' },
        ],
      }),
      beat({
        id: 'a1',
        participants: ['yuki'],
        window: { fromSlot: 3, toSlot: 3 },
        guard: guardFromRequires(['chose_a']),
      }),
      beat({
        id: 'a2',
        participants: ['yuki'],
        window: { fromSlot: 6, toSlot: 6 },
        guard: guardFromRequires(['chose_a']),
      }),
    ]);
    expect(deriveBeatChain(spine, cal, LI).predecessors.get('a2')).toEqual(['a1']);
  });

  it('пересекающиеся окна одной линии → warning order/ambiguous', () => {
    const spine = spineOf([
      beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 0, toSlot: 5 } }),
      beat({ id: 'meet', participants: ['yuki'], window: { fromSlot: 0, toSlot: 5 } }),
    ]);
    const { issues } = deriveBeatChain(spine, cal, LI);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', scope: 'order/ambiguous/yuki' });
  });

  it('непересекающиеся окна — без предупреждений', () => {
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], window: { fromSlot: 0, toSlot: 1 } }),
      beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 7 } }),
    ]);
    expect(deriveBeatChain(spine, cal, LI).issues).toEqual([]);
  });
});

describe('applyBeatChain — мерж в guard', () => {
  it('инжектит {fired: предшественник} и идемпотентен', () => {
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], window: { fromSlot: 0, toSlot: 0 } }),
      beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 6 } }),
    ]);
    const once = applyBeatChain(spine, cal, LI);
    expect(firedOf(once, 'confess')).toEqual(['meet']);

    const twice = applyBeatChain(once, cal, LI);
    expect(firedOf(twice, 'confess')).toEqual(['meet']); // без дублей
  });

  it('сохраняет исходные флаговые requires', () => {
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], window: { fromSlot: 0, toSlot: 0 }, establishes: ['seen'] }),
      beat({
        id: 'confess',
        participants: ['yuki'],
        window: { fromSlot: 6, toSlot: 6 },
        guard: guardFromRequires(['seen']),
      }),
    ]);
    const chained = applyBeatChain(spine, cal, LI);
    const guard = chained.beats.find(b => b.id === 'confess')!.guard;
    expect(JSON.stringify(guard)).toContain('"flag":"seen"');
    expect(guardFiredIds(guard)).toEqual(['meet']);
  });
});

/**
 * Инвариант вместо отдельного slot-slack валидатора.
 *
 * Движок ТРАТИТ слот на выходе бита и на закрытии встречи, поэтому гейт обязан
 * указывать строго в прошлое — иначе бит недостижим (стрела времени ушла).
 * Отдельная проверка в validateSpine была бы мёртвым кодом: и предшественник
 * (slot(Y) < slot(X) ≤ X.window.toSlot), и гейт-встреча (toSlot < fromSlot
 * головы) отбираются строго более ранними САМИМ выводом. Тест держит это
 * свойство, чтобы рефактор deriveBeatChain не сломал его молча.
 */
describe('инвариант: цепочка всегда указывает строго в прошлое', () => {
  it('предшественник помещается в окно потомка (слот освободится до дедлайна)', () => {
    const spine = spineOf([
      beat({ id: 'y1', participants: ['yuki'], window: { fromSlot: 0, toSlot: 2 } }),
      beat({ id: 'y2', participants: ['yuki'], act: 2, window: { fromSlot: 3, toSlot: 5 } }),
      beat({ id: 'y3', participants: ['yuki'], act: 3, window: { fromSlot: 6, toSlot: 8 } }),
      beat({ id: 'k1', participants: ['kira'], window: { fromSlot: 0, toSlot: 2 } }),
      beat({ id: 'shared', participants: ['yuki', 'kira'], act: 3, window: { fromSlot: 6, toSlot: 8 } }),
    ]);
    const { predecessors } = deriveBeatChain(spine, cal, LI);
    const slots = assignBeatSlots(spine, cal);
    const byId = new Map(spine.beats.map(b => [b.id, b]));

    expect(predecessors.size).toBeGreaterThan(0);
    for (const [beatId, preds] of predecessors) {
      const x = byId.get(beatId)!;
      for (const p of preds) {
        // Предшественник занимает более ранний слот, и у потомка остаётся
        // куда войти после того, как тот потратит свой слот.
        expect(slots[p]).toBeLessThan(slots[beatId]);
        expect(x.window.toSlot).toBeGreaterThan(slots[p]);
      }
    }
  });

  it('гейт головы открывается строго раньше окна головы (заходящее окно годится)', () => {
    const head = beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 8 } });
    const units = [
      unit({ id: 'u_before', at: { slot: { fromSlot: 0, toSlot: 5 }, locationId: 'cafe' } }),
      unit({ id: 'u_overlap', at: { slot: { fromSlot: 5, toSlot: 7 }, locationId: 'cafe' } }),
    ];
    // Юнит, чьё окно ЗАХОДИТ на окно бита, гейтом годится: он открывается в
    // слоте 5, когда бита ещё нет, и играется там (разговор слот не тратит).
    // Берётся последний — мера продвижения по арке.
    expect(gatingUnitFor('yuki', head, units)).toBe('u_overlap');
    expect(gatingUnitFor('yuki', head, [units[1]])).toBe('u_overlap');
    // А вот открывшийся ОДНОВРЕМЕННО с битом — не годится: иначе гейтом
    // знакомства стал бы разговор из его же окна (см. тест плейтеста ниже).
    expect(
      gatingUnitFor('yuki', head, [
        unit({ id: 'u_same', at: { slot: { fromSlot: 6, toSlot: 9 }, locationId: 'cafe' } }),
      ]),
    ).toBeNull();
  });
});

describe('гейт на разговоры (контекстная разблокировка)', () => {
  it('gatingUnitFor берёт ПОСЛЕДНЮЮ встречу строго до окна бита (мера продвижения по арке)', () => {
    const head = beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 6 } });
    const units = [
      unit({ id: 'filler_yuki_cafe_1', at: { slot: { fromSlot: 1, toSlot: 2 }, locationId: 'cafe' } }),
      unit({ id: 'evt_yuki_u1', at: { slot: { fromSlot: 4, toSlot: 4 }, locationId: 'cafe' } }),
    ];
    expect(gatingUnitFor('yuki', head, units)).toBe('evt_yuki_u1');
  });

  it('со-слотовая и более поздняя встреча гейтом НЕ становятся (порядок бы инвертировался)', () => {
    const head = beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 6 } });
    const coLocated = [unit({ id: 'u_same', at: { slot: { fromSlot: 6, toSlot: 6 }, locationId: 'park' } })];
    const later = [unit({ id: 'u_late', at: { slot: { fromSlot: 7, toSlot: 8 }, locationId: 'park' } })];
    expect(gatingUnitFor('yuki', head, coLocated)).toBeNull();
    expect(gatingUnitFor('yuki', head, later)).toBeNull();
  });

  it('встреча другого LI гейтом не становится', () => {
    const head = beat({ id: 'confess', participants: ['yuki'], window: { fromSlot: 6, toSlot: 6 } });
    const units = [
      unit({ id: 'evt_kira_u1', participants: ['kira'], at: { slot: { fromSlot: 1, toSlot: 1 }, locationId: 'cafe' } }),
    ];
    expect(gatingUnitFor('yuki', head, units)).toBeNull();
  });

  it('РЕПОРТНУТАЯ ТОПОЛОГИЯ: единственный бит Юки (признание в парке) гейтится на кафе-филлер', () => {
    // Кафе — только расписание, бита там нет; признание — единственный бит линии,
    // значит цепочка beat→beat его не держит: держит гейт головы.
    const spine = spineOf([
      beat({
        id: 'park_confession',
        participants: ['yuki'],
        act: 3,
        window: { fromSlot: 6, toSlot: 8 },
        locationId: 'park',
      }),
      beat({ id: 'fin', kind: 'finale', participants: ['yuki', 'kira'], act: 4, window: { fromSlot: 9, toSlot: 11 } }),
    ]);
    const units = [unit({ id: 'filler_yuki_cafe_1', at: { slot: { fromSlot: 1, toSlot: 2 }, locationId: 'cafe' } })];

    expect(deriveBeatChain(spine, cal, LI).heads.get('yuki')).toBe('park_confession');
    const chained = applyBeatChain(spine, cal, LI, units);
    expect(firedOf(chained, 'park_confession')).toEqual(['filler_yuki_cafe_1']);
  });

  it('без единой запланированной встречи голова остаётся без гейта (дедлока не создаём)', () => {
    const spine = spineOf([
      beat({ id: 'park_confession', participants: ['yuki'], act: 3, window: { fromSlot: 6, toSlot: 8 } }),
    ]);
    expect(firedOf(applyBeatChain(spine, cal, LI, []), 'park_confession')).toEqual([]);
  });

  it('$plot-голова интеракционного гейта не получает', () => {
    const spine = spineOf([beat({ id: 'storm', participants: [], act: 3, window: { fromSlot: 6, toSlot: 8 } })]);
    const units = [unit({ id: 'filler_yuki_cafe_1', at: { slot: { fromSlot: 1, toSlot: 2 }, locationId: 'cafe' } })];
    expect(firedOf(applyBeatChain(spine, cal, LI, units), 'storm')).toEqual([]);
  });

  it('гейт получает КАЖДЫЙ бит LI, а не только голова линии', () => {
    // Регресс настоящего бага: раньше гейт вешался только на голову, поэтому
    // признание (не голова) не требовало ни одного разговора.
    const spine = spineOf([
      beat({ id: 'meet', participants: ['yuki'], window: { fromSlot: 3, toSlot: 3 } }),
      beat({ id: 'confess', participants: ['yuki'], act: 3, window: { fromSlot: 6, toSlot: 8 } }),
    ]);
    const units = [
      unit({ id: 'talk_early', at: { slot: { fromSlot: 1, toSlot: 2 }, locationId: 'cafe' } }),
      unit({ id: 'talk_mid', at: { slot: { fromSlot: 4, toSlot: 5 }, locationId: 'cafe' } }),
    ];
    const chained = applyBeatChain(spine, cal, LI, units);
    expect(firedOf(chained, 'meet')).toEqual(['talk_early']);
    // Признание: и предшественник по цепочке, и САМЫЙ СВЕЖИЙ разговор до окна.
    expect(firedOf(chained, 'confess').sort()).toEqual(['meet', 'talk_mid']);
  });

  /**
   * Топология, вытащенная из localStorage реального плейтеста: бит-знакомство
   * сам срабатывал на входе в кафе и ставил met_yuki, а признание в парке
   * требовало только этот флаг — ни одного разговора. Пул при этом нёс честную
   * арку, которую бит обходил.
   */
  it('РЕАЛЬНЫЙ ПЛЕЙТЕСТ: признание требует разговора, а не только авто-бита знакомства', () => {
    const spine = spineOf([
      beat({
        id: 'quiet_moment_yuki',
        participants: ['yuki'],
        act: 1,
        window: { fromSlot: 0, toSlot: 2 },
        locationId: 'coffee_shop',
        establishes: ['met_yuki'],
      }),
      beat({
        id: 'branchpoint_yuki_confession',
        participants: ['yuki'],
        act: 3,
        window: { fromSlot: 6, toSlot: 8 },
        locationId: 'quiet_park',
        guard: guardFromRequires(['met_yuki']),
      }),
      beat({ id: 'fin', kind: 'finale', participants: ['yuki', 'kira'], act: 4, window: { fromSlot: 9, toSlot: 11 } }),
    ]);
    const units = [
      unit({
        id: 'evt_yuki_coffee_shop_observation',
        at: { slot: { fromSlot: 0, toSlot: 2 }, locationId: 'coffee_shop' },
      }),
      unit({
        id: 'evt_yuki_first_literature_chat',
        at: { slot: { fromSlot: 3, toSlot: 5 }, locationId: 'coffee_shop' },
      }),
    ];
    const fired = firedOf(applyBeatChain(spine, cal, LI, units), 'branchpoint_yuki_confession');

    // Ключевое: признание больше не открыть, не поговорив.
    expect(fired).toContain('evt_yuki_first_literature_chat');
    expect(fired).toContain('quiet_moment_yuki');

    // Знакомство остаётся входной точкой: до слота 0 встреч нет.
    expect(firedOf(applyBeatChain(spine, cal, LI, units), 'quiet_moment_yuki')).toEqual([]);
  });
});
