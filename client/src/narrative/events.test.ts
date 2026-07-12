import { describe, it, expect } from 'vitest';
import {
  evaluateSlice,
  createSliceState,
  bracketOfAffection,
  evalGuard,
  formatGuard,
  formatEffect,
  type EventDef,
  type TimeSlice,
} from './events';

const SLICE: TimeSlice = { z: 6, anchorId: 'a7_festival', timeMarker: 'день 7 · вечер' };

/** События среза д7 · вечер из спеки §4. */
const d7Events = (): EventDef[] => [
  {
    id: 'd7_dlg_yuki',
    kind: 'dialogue',
    at: { anchorId: 'a7_festival' },
    participants: ['yuki'],
    guard: { at: { char: 'yuki', loc: 'hall' } },
    effects: [{ rel: { char: 'yuki', var: 'affection', delta: 0.06 } }, { setFlag: 'yuki_first_choice' }],
    scene: { kind: 'dialogue', anchorId: 'a7_festival', liId: 'yuki' },
    priority: 10,
  },
  {
    id: 'd7_dlg_kira',
    kind: 'dialogue',
    at: { anchorId: 'a7_festival' },
    participants: ['kira'],
    guard: { all: [{ at: { char: 'kira', loc: 'hall' } }, { not: { flag: 'kira_left' } }] },
    effects: [{ rel: { char: 'kira', var: 'tension', delta: -0.05 } }],
    scene: { kind: 'dialogue', anchorId: 'a7_festival', liId: 'kira' },
    priority: 20,
  },
  {
    id: 'd7_kira_leaves',
    kind: 'move_out',
    at: { anchorId: 'a7_festival' },
    participants: ['kira'],
    guard: { all: [{ fired: 'd7_dlg_yuki' }, { rel: { var: 'tension', op: '>=', value: 0.5 } }] },
    effects: [
      { move: { char: 'kira', to: 'library' } },
      { setFlag: 'kira_left' },
      { rel: { char: 'kira', var: 'tension', delta: 0.08 } },
    ],
    scene: null,
    priority: 30,
  },
  {
    id: 'd7_asel_arrives',
    kind: 'move_in',
    at: { anchorId: 'a7_festival' },
    participants: ['asel'],
    guard: { time: { op: '>=', value: '21:00' } },
    effects: [{ move: { char: 'asel', to: 'hall' } }, { setFlag: 'asel_arrived' }],
    scene: { kind: 'beat', anchorId: 'a7_festival' },
    priority: 40,
  },
  {
    id: 'd7_dlg_asel',
    kind: 'dialogue',
    at: { anchorId: 'a7_festival' },
    participants: ['asel'],
    guard: { flag: 'asel_arrived' },
    effects: [{ rel: { char: 'asel', var: 'affection', delta: 0.04 } }],
    scene: { kind: 'dialogue', anchorId: 'a7_festival', liId: 'asel' },
    priority: 50,
  },
];

describe('bracketOfAffection', () => {
  it('делит спектр по константам bracket-порогов', () => {
    expect(bracketOfAffection(0.3)).toBe('warm');
    expect(bracketOfAffection(0.29)).toBe('neutral');
    expect(bracketOfAffection(0.01)).toBe('neutral');
    expect(bracketOfAffection(0)).toBe('cold');
    expect(bracketOfAffection(-0.4)).toBe('cold');
  });
});

describe('evaluateSlice — разбор среза д7 из спеки', () => {
  it('уход Киры (priority 30) видит результат диалога с Юки (priority 10) в том же срезе', () => {
    const state = createSliceState({
      positions: { yuki: 'hall', kira: 'hall', asel: 'coffee' },
      relationships: {
        yuki: { affection: 0.56, trust: 0.55, tension: 0.18 },
        kira: { affection: 0.1, trust: 0.3, tension: 0.55 },
        asel: { affection: 0.2, trust: 0.44, tension: 0.4 },
      },
      clock: '21:30',
    });

    const result = evaluateSlice(d7Events(), SLICE, state, 'hall');

    expect(result.fired.map(e => e.id)).toEqual([
      'd7_dlg_yuki',
      'd7_dlg_kira',
      'd7_kira_leaves',
      'd7_asel_arrives',
      'd7_dlg_asel',
    ]);
    expect(state.positions.kira).toBe('library');
    expect(state.positions.asel).toBe('hall');
    expect(state.flags.has('kira_left')).toBe(true);
    expect(state.flags.has('yuki_first_choice')).toBe(true);
    expect(state.relationships.yuki.affection).toBeCloseTo(0.62);
    // −0.05 от диалога, +0.08 от ухода
    expect(state.relationships.kira.tension).toBeCloseTo(0.58);
    // Триггер без сцены (уход Киры) не попадает в очередь сцен.
    expect(result.scenes).toHaveLength(4);
    expect(result.state.fired.every(f => f.z === 6)).toBe(true);
  });

  it('без часов time-guard ложен: Асель не приходит, её диалог не открывается', () => {
    const state = createSliceState({
      positions: { yuki: 'hall', kira: 'hall' },
      relationships: {
        yuki: { affection: 0.5, trust: 0.5, tension: 0.1 },
        kira: { affection: 0.1, trust: 0.3, tension: 0.2 },
      },
    });

    const result = evaluateSlice(d7Events(), SLICE, state, 'hall');

    expect(result.fired.map(e => e.id)).toEqual(['d7_dlg_yuki', 'd7_dlg_kira']);
    // tension 0.2 − 0.05 < 0.5 — Кира остаётся.
    expect(state.positions.kira).toBe('hall');
  });

  it('события прошлых срезов не срабатывают повторно', () => {
    const state = createSliceState({
      positions: { yuki: 'hall' },
      fired: [{ eventId: 'd7_dlg_yuki', z: 5 }],
    });

    const result = evaluateSlice(d7Events(), SLICE, state, 'hall');
    expect(result.fired.map(e => e.id)).not.toContain('d7_dlg_yuki');
  });

  it('детерминизм: равный priority разрешается лексикографически по id', () => {
    const mk = (id: string): EventDef => ({
      id,
      kind: 'state_change',
      at: { anchorId: 'a7_festival' },
      participants: [],
      guard: { all: [] },
      effects: [{ setFlag: `f_${id}` }],
      scene: null,
      priority: 10,
    });
    const state = createSliceState();
    const result = evaluateSlice([mk('b_event'), mk('a_event')], SLICE, state);
    expect(result.fired.map(e => e.id)).toEqual(['a_event', 'b_event']);
  });

  it('каскад ограничен 3 проходами: цепочка глубже не дорабатывает', () => {
    // f1 → f2 → f3 → f4: каждый следующий guard видит флаг предыдущего,
    // но priority выстроен против порядка, чтобы каждый проход давал ровно
    // одно срабатывание.
    const chain = (n: number, dependsOn: string | null): EventDef => ({
      id: `chain_${n}`,
      kind: 'state_change',
      at: { anchorId: 'a7_festival' },
      participants: [],
      guard: dependsOn ? { flag: dependsOn } : { all: [] },
      effects: [{ setFlag: `chain_${n}_done` }],
      scene: null,
      priority: 100 - n * 10,
    });
    const defs = [chain(1, null), chain(2, 'chain_1_done'), chain(3, 'chain_2_done'), chain(4, 'chain_3_done')];
    const state = createSliceState();
    const result = evaluateSlice(defs, SLICE, state);
    expect(result.passes).toBe(3);
    expect(result.fired.map(e => e.id)).toEqual(['chain_1', 'chain_2', 'chain_3']);
    expect(state.flags.has('chain_4_done')).toBe(false);
  });

  it('at-маска: событие чужого якоря в срез не попадает', () => {
    const defs = d7Events().map(d => ({ ...d, at: { anchorId: 'a8_crisis' } }));
    const state = createSliceState({ positions: { yuki: 'hall' } });
    const result = evaluateSlice(defs, SLICE, state, 'hall');
    expect(result.fired).toHaveLength(0);
  });

  it('locked-событие срабатывает только после unlock-эффекта', () => {
    const defs: EventDef[] = [
      {
        id: 'unlocker',
        kind: 'state_change',
        at: {},
        participants: [],
        guard: { all: [] },
        effects: [{ unlock: { eventId: 'locked_ev' } }],
        scene: null,
        priority: 10,
      },
      {
        id: 'locked_ev',
        kind: 'state_change',
        at: {},
        participants: [],
        guard: { all: [] },
        effects: [{ setFlag: 'was_unlocked' }],
        scene: null,
        priority: 20,
        locked: true,
      },
    ];
    const state = createSliceState();
    evaluateSlice(defs, SLICE, state);
    expect(state.flags.has('was_unlocked')).toBe(true);

    const stateLocked = createSliceState();
    evaluateSlice([defs[1]], SLICE, stateLocked);
    expect(stateLocked.flags.has('was_unlocked')).toBe(false);
  });
});

describe('evalGuard — bracket и rel по vars', () => {
  it('bracket(affection) читает R героини к участнику', () => {
    const ctx = {
      x: 'yuki',
      y: 'hall',
      z: SLICE,
      R: { affection: 0.62, trust: 0.5, tension: 0.1 },
      H: { flags: new Set<string>(), fired: [] },
    };
    expect(evalGuard({ bracket: { of: 'affection', is: 'warm' } }, ctx, createSliceState())).toBe(true);
    expect(evalGuard({ bracket: { of: 'affection', is: 'cold' } }, ctx, createSliceState())).toBe(false);
  });

  it('rel-guard достаёт доп. переменные архетипа из vars', () => {
    const ctx = {
      x: 'asel',
      y: 'hall',
      z: SLICE,
      R: { affection: 0.2, trust: 0.3, tension: 0.1, vars: { external_pressure: 0.7 } },
      H: { flags: new Set<string>(), fired: [] },
    };
    expect(evalGuard({ rel: { var: 'external_pressure', op: '>=', value: 0.5 } }, ctx, createSliceState())).toBe(true);
    expect(evalGuard({ rel: { var: 'unknown_var', op: '>=', value: 0.1 } }, ctx, createSliceState())).toBe(false);
  });
});

describe('форматирование для UI', () => {
  it('formatGuard повторяет нотацию спеки', () => {
    expect(formatGuard({ all: [{ fired: 'd7_dlg_yuki' }, { rel: { var: 'tension', op: '>=', value: 0.5 } }] })).toBe(
      'all[ fired(d7_dlg_yuki), rel(tension ≥ 0.5) ]',
    );
    expect(formatGuard({ all: [] })).toBe('true');
    expect(formatGuard({ time: { op: '>=', value: '21:00' } })).toBe('time ≥ 21:00');
  });

  it('formatEffect повторяет нотацию спеки', () => {
    expect(formatEffect({ move: { char: 'kira', to: 'library' } })).toBe('move(kira → library)');
    expect(formatEffect({ rel: { char: 'kira', var: 'tension', delta: -0.05 } })).toBe('rel(kira, tension, −0.05)');
    expect(formatEffect({ setFlag: 'kira_left' })).toBe('setFlag(kira_left)');
  });
});
