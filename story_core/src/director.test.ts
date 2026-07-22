import { describe, it, expect } from 'vitest';
import { StoryletDirector } from './director';
import {
  DEFAULT_BUNDLE_SETTINGS,
  DEFAULT_SELECTOR_CONFIG,
  STORY_BUNDLE_FORMAT_VERSION,
  type CompiledBeat,
  type StoryBundleV2,
  type StoryletUnit,
  type UnitVariant,
} from './bundle';
import { bracketThresholdsFor } from './brackets';
import { PHASES_PER_SLOT } from './calendar';

// ── Фикстура: 2 локации, 1 персонаж, 3 ступени лестницы, финал и концовки ──

const A0 = 0.15;

const variant = (bracket: UnitVariant['bracket'], text: string, withFarewell = true): UnitVariant => ({
  bracket,
  entryNodeId: 'n1',
  nodes: [
    {
      id: 'n1',
      lines: [{ speaker: 'Кира', text }],
      choices: [
        { id: 'warm', text: 'Тепло ответить', effects: [{ rel: { char: 'kira', var: 'affection', delta: 0.1 } }], next: 'n2' },
        { id: 'cold', text: 'Отмолчаться', effects: [{ rel: { char: 'kira', var: 'affection', delta: -0.05 } }], next: 'n2' },
      ],
    },
    { id: 'n2', lines: [{ speaker: 'Кира', text: 'Ну, пока.' }], choices: [] },
  ],
  ...(withFarewell ? { farewell: { lines: [{ text: 'Она уходит.' }] } } : {}),
});

const unit = (patch: Partial<StoryletUnit> & Pick<StoryletUnit, 'id'>): StoryletUnit => ({
  li: 'kira',
  participants: ['kira'],
  at: { locationId: 'cafe', slot: { fromSlot: 0, toSlot: 11 } },
  guard: { all: [] },
  effectsOnClose: [],
  source: 'agenda',
  weight: 1,
  goal: 'цель',
  variants: [variant('neutral', 'Привет.'), variant('positive', 'Рада тебя видеть!'), variant('negative', 'А, это ты.')],
  ...patch,
});

const beat = (patch: Partial<CompiledBeat> & Pick<CompiledBeat, 'id'>): CompiledBeat => ({
  kind: 'beat',
  window: { fromSlot: 0, toSlot: 11 },
  locationId: 'cafe',
  participants: [],
  guard: { all: [] },
  effects: [],
  text: 'Что-то происходит.',
  background: '',
  ...patch,
});

function makeBundle(patch: Partial<StoryBundleV2> = {}): StoryBundleV2 {
  return {
    formatVersion: STORY_BUNDLE_FORMAT_VERSION,
    title: 'Тест',
    meta: { generator: 'test' },
    stateSchema: {
      relationships: { kira: { affection: A0, trust: 0, tension: 0 } },
      flags: [],
    },
    calendar: { days: 4, dayparts: ['утро', 'день', 'вечер'], slotCount: 12, actBoundaries: [0, 1, 2, 3], phasesPerSlot: PHASES_PER_SLOT },
    world: {
      locations: [
        { id: 'cafe', name: 'Кафе', description: 'Кафе', background: '' },
        { id: 'home', name: 'Дом', description: 'Дом', background: '' },
      ],
      edges: [{ from: 'cafe', to: 'home', via: 'улица' }],
      startLocationId: 'cafe',
      homeLocationId: 'home',
    },
    cast: [{ id: 'kira', name: 'Кира', isLI: true, bracketThresholds: bracketThresholdsFor(A0) }],
    schedule: { kira: Array.from({ length: 12 }, () => 'cafe') },
    units: [unit({ id: 'u1', arcStage: 1 })],
    spine: { beats: [], endings: [], logline: '' },
    anchors: [
      { daypartIndex: 0, label: 'Дальше: день', narration: 'Наступает день.', isSleep: false },
      { daypartIndex: 1, label: 'Дальше: вечер', narration: 'Наступает вечер.', isSleep: false },
      { daypartIndex: 2, label: 'Пойти спать', narration: 'Сон приходит быстро.', isSleep: true },
    ],
    intro: { text: 'Начало.', background: '' },
    selector: DEFAULT_SELECTOR_CONFIG,
    audio: {},
    settings: DEFAULT_BUNDLE_SETTINGS,
    ...patch,
  };
}

/** Полный проход сцены: завести, выбрать, закрыть. */
function playTalk(d: StoryletDirector, unitId: string, choice: 'warm' | 'cold' = 'warm') {
  d.startTalk(unitId);
  d.choose(choice);
  return d.closeTalk();
}

describe('StoryletDirector — старт и состояние', () => {
  it('стартует в локации самого раннего бита с дефолтами архетипа', () => {
    const d = new StoryletDirector(makeBundle());
    expect(d.location).toBe('cafe');
    expect(d.slot).toBe(0);
    expect(d.phase).toBe(0);
    expect(d.slice.relationships.kira.affection).toBeCloseTo(A0);
  });

  it('стартовые отношения не делятся между прогонами', () => {
    const bundle = makeBundle();
    const a = new StoryletDirector(bundle);
    playTalk(a, 'u1', 'warm');
    const b = new StoryletDirector(bundle);
    expect(b.slice.relationships.kira.affection).toBeCloseTo(A0);
  });
});

describe('StoryletDirector — выбор тона в рантайме', () => {
  it('на старте архетипа играется нейтральный вариант', () => {
    const d = new StoryletDirector(makeBundle());
    expect(d.startTalk('u1')!.variant.bracket).toBe('neutral');
  });

  it('накопленное тепло переключает вариант без перепроводки графа', () => {
    const d = new StoryletDirector(makeBundle());
    d.slice.relationships.kira.affection = A0 + 0.2;
    expect(d.startTalk('u1')!.variant.bracket).toBe('positive');
    d.slice.relationships.kira.affection = A0 - 0.2;
    expect(d.startTalk('u1')!.variant.bracket).toBe('negative');
  });

  it('нейтральный вариант — гарантированный фолбэк', () => {
    const only = unit({ id: 'u1', arcStage: 1, variants: [variant('neutral', 'Привет.')] });
    const d = new StoryletDirector(makeBundle({ units: [only] }));
    d.slice.relationships.kira.affection = 0.9;
    expect(d.startTalk('u1')!.variant.bracket).toBe('neutral');
  });
});

describe('StoryletDirector — две стрелки времени', () => {
  it('разговор тратит фазу, но НЕ двигает слот', () => {
    const d = new StoryletDirector(makeBundle());
    playTalk(d, 'u1');
    expect(d.slot).toBe(0);
    expect(d.phase).toBe(1);
  });

  it('бит хребта двигает слот и сбрасывает фазу', () => {
    const d = new StoryletDirector(makeBundle({ spine: { beats: [beat({ id: 'b1' })], endings: [], logline: '' } }));
    playTalk(d, 'u1');
    expect(d.phase).toBe(1);
    d.completeBeat('b1');
    expect(d.slot).toBe(1);
    expect(d.phase).toBe(0);
  });

  it('якорный переход двигает слот и сбрасывает фазу; сон уводит домой', () => {
    const d = new StoryletDirector(makeBundle());
    playTalk(d, 'u1');
    d.anchorAdvance();
    expect(d.slot).toBe(1);
    expect(d.phase).toBe(0);
    expect(d.location).toBe('cafe');

    d.anchorAdvance(); // slot 2 = вечер
    const sleep = d.anchorAdvance();
    expect(sleep.movedTo).toBe('home');
    expect(d.location).toBe('home');
    expect(d.slot).toBe(3);
  });

  it('якорь есть в каждом слоте — софтлок невозможен по построению', () => {
    const d = new StoryletDirector(makeBundle());
    for (let s = 0; s < 12; s++) {
      d.slot = s;
      expect(d.currentAnchor()).not.toBeNull();
    }
  });

  it('перемещение бесплатно — исследовать мир не наказывается', () => {
    const d = new StoryletDirector(makeBundle());
    d.moveTo('home');
    expect(d.location).toBe('home');
    expect(d.slot).toBe(0);
    expect(d.phase).toBe(0);
  });
});

describe('StoryletDirector — созревание битов', () => {
  it('бит созревает по окну, guard-у и тому, что ещё не сыгран', () => {
    const b = beat({ id: 'b_late', window: { fromSlot: 5, toSlot: 7 } });
    const d = new StoryletDirector(makeBundle({ spine: { beats: [b], endings: [], logline: '' } }));
    expect(d.maturedBeat()).toBeNull();
    d.slot = 5;
    expect(d.maturedBeat()?.id).toBe('b_late');
    d.completeBeat('b_late');
    d.slot = 5;
    expect(d.maturedBeat()).toBeNull();
  });

  it('порядок битов детерминирован: самый горящий дедлайн первым', () => {
    const beats = [
      beat({ id: 'b_wide', window: { fromSlot: 0, toSlot: 9 } }),
      beat({ id: 'b_tight', window: { fromSlot: 0, toSlot: 2 } }),
    ];
    const d = new StoryletDirector(makeBundle({ spine: { beats, endings: [], logline: '' } }));
    expect(d.maturedBeat()?.id).toBe('b_tight');
  });

  it('флаговый guard бита ждёт своего флага', () => {
    const beats = [
      beat({ id: 'b1', effects: [{ setFlag: 'met' }], window: { fromSlot: 0, toSlot: 0 } }),
      beat({ id: 'b2', guard: { all: [{ flag: 'met' }] }, window: { fromSlot: 1, toSlot: 3 } }),
    ];
    const d = new StoryletDirector(makeBundle({ spine: { beats, endings: [], logline: '' } }));
    d.slot = 1;
    expect(d.maturedBeat()).toBeNull();
    d.slot = 0;
    d.completeBeat('b1');
    expect(d.maturedBeat()?.id).toBe('b2');
  });

  it('исход развилки ставит свой флаг', () => {
    const bp = beat({
      id: 'bp',
      kind: 'branchPoint',
      outcomes: [
        { id: 'o1', label: 'Налево', effects: [{ setFlag: 'went_left' }] },
        { id: 'o2', label: 'Направо', effects: [{ setFlag: 'went_right' }] },
      ],
    });
    const d = new StoryletDirector(makeBundle({ spine: { beats: [bp], endings: [], logline: '' } }));
    d.completeBeat('bp', 'o2');
    expect(d.slice.flags.has('went_right')).toBe(true);
    expect(d.slice.flags.has('went_left')).toBe(false);
  });
});

describe('StoryletDirector — доступность встреч', () => {
  it('персонажа нет по расписанию — встречи нет, даже если окно открыто', () => {
    const d = new StoryletDirector(
      makeBundle({ schedule: { kira: Array.from({ length: 12 }, (_, i) => (i === 0 ? 'cafe' : null)) } }),
    );
    expect(d.hubActions().talks).toHaveLength(1);
    d.slot = 1;
    expect(d.hubActions().talks).toHaveLength(0);
  });

  it('персонаж без расписания не ограничен присутствием', () => {
    const d = new StoryletDirector(makeBundle({ schedule: {} }));
    expect(d.hubActions().talks).toHaveLength(1);
  });

  it('сыгранная сцена больше не предлагается', () => {
    const d = new StoryletDirector(makeBundle());
    playTalk(d, 'u1');
    expect(d.hubActions().talks).toHaveLength(0);
  });

  it('окно фаз закрывает глубокую сцену к поздней фазе', () => {
    const early = unit({ id: 'u_early', arcStage: 1, at: { locationId: 'cafe', slot: { fromSlot: 0, toSlot: 11 }, phase: { fromPhase: 0, toPhase: 0 } } });
    const d = new StoryletDirector(makeBundle({ units: [early] }));
    expect(d.hubActions().talks).toHaveLength(1);
    d.phase = 1;
    expect(d.hubActions().talks).toHaveLength(0);
  });

  it('не более одной встречи на персонажа: сцены конкурируют, а не заваливают', () => {
    const units = [
      unit({ id: 'u1', arcStage: 1 }),
      unit({ id: 'u2', arcStage: 1 }),
      unit({ id: 'u3', arcStage: 1 }),
    ];
    const d = new StoryletDirector(makeBundle({ units }));
    expect(d.hubActions().talks).toHaveLength(1);
  });

  it('rel-гейт ступени не пускает без накопленной близости', () => {
    const gated = unit({
      id: 'u_deep',
      arcStage: 2,
      guard: { all: [{ rel: { var: 'affection', op: '>=', value: 0.5 } }] },
    });
    const d = new StoryletDirector(makeBundle({ units: [gated] }));
    expect(d.hubActions().talks).toHaveLength(0);
    d.slice.relationships.kira.affection = 0.6;
    expect(d.hubActions().talks).toHaveLength(1);
  });
});

describe('StoryletDirector — продолжение разговора', () => {
  const ladder = () => [
    unit({ id: 'u1', arcStage: 1, effectsOnClose: [{ setFlag: 'stage1_done' }] }),
    unit({ id: 'u2', arcStage: 2, guard: { all: [{ flag: 'stage1_done' }] } }),
  ];

  it('следующая ступень открывается В ТОЙ ЖЕ посиделке', () => {
    const d = new StoryletDirector(makeBundle({ units: ladder() }));
    const close = playTalk(d, 'u1');
    expect(close.continuation?.unitId).toBe('u2');
    expect(close.continuation?.liName).toBe('Кира');
  });

  it('прощание отдаётся отдельно — играется только при реальном уходе', () => {
    const d = new StoryletDirector(makeBundle({ units: ladder() }));
    const close = playTalk(d, 'u1');
    expect(close.farewell?.map(l => l.text)).toEqual(['Она уходит.']);
  });

  it('запас фаз слота — арифметический кап на число ступеней за присест', () => {
    const d = new StoryletDirector(makeBundle({ units: ladder() }));
    playTalk(d, 'u1');
    expect(d.phase).toBe(1);
    // Вторая ступень тратит последнюю фазу — третьей в этом слоте не будет.
    const close2 = playTalk(d, 'u2');
    expect(d.phase).toBe(PHASES_PER_SLOT);
    expect(close2.continuation).toBeNull();
  });

  it('ступень вне текущего слота продолжением не становится', () => {
    const units = [
      unit({ id: 'u1', arcStage: 1, at: { locationId: 'cafe', slot: { fromSlot: 0, toSlot: 5 } } }),
      unit({ id: 'u2', arcStage: 2, at: { locationId: 'cafe', slot: { fromSlot: 4, toSlot: 8 } } }),
    ];
    const d = new StoryletDirector(makeBundle({ units }));
    // Слот 0: окна пересекаются, но текущий слот вне окна второй ступени.
    expect(playTalk(d, 'u1').continuation).toBeNull();
  });

  it('ступень другой локации продолжением не становится', () => {
    const units = [
      unit({ id: 'u1', arcStage: 1 }),
      unit({ id: 'u2', arcStage: 2, at: { locationId: 'home', slot: { fromSlot: 0, toSlot: 11 } } }),
    ];
    const d = new StoryletDirector(makeBundle({ units }));
    expect(playTalk(d, 'u1').continuation).toBeNull();
  });
});

describe('StoryletDirector — эффекты и лестница', () => {
  it('выбор двигает отношения, закрытие добавляет гейн ступени', () => {
    const u = unit({ id: 'u1', arcStage: 1, effectsOnClose: [{ rel: { char: 'kira', var: 'affection', delta: 0.05 } }] });
    const d = new StoryletDirector(makeBundle({ units: [u] }));
    playTalk(d, 'u1', 'warm');
    expect(d.slice.relationships.kira.affection).toBeCloseTo(A0 + 0.1 + 0.05);
  });

  it('отношения клампятся спектром −1..1 даже без clamp в эффекте', () => {
    const u = unit({ id: 'u1', arcStage: 1, effectsOnClose: [{ rel: { char: 'kira', var: 'affection', delta: 5 } }] });
    const d = new StoryletDirector(makeBundle({ units: [u] }));
    playTalk(d, 'u1');
    expect(d.slice.relationships.kira.affection).toBe(1);
  });

  it('холодный выбор уводит вниз', () => {
    const d = new StoryletDirector(makeBundle());
    playTalk(d, 'u1', 'cold');
    expect(d.slice.relationships.kira.affection).toBeCloseTo(A0 - 0.05);
  });
});

describe('StoryletDirector — концовки', () => {
  const endings = () => [
    { id: 'e_good', kind: 'good' as const, liId: 'kira', guard: { all: [{ rel: { char: 'kira', var: 'affection', op: '>=' as const, value: 0.5 } }] }, scenes: [{ text: 'хорошо' }], background: '' },
    { id: 'e_normal', kind: 'normal' as const, liId: null, guard: { all: [] }, scenes: [{ text: 'обычно' }], background: '' },
  ];

  it('финал закрывает историю', () => {
    const fin = beat({ id: 'fin', kind: 'finale' });
    const d = new StoryletDirector(makeBundle({ spine: { beats: [fin], endings: endings(), logline: '' } }));
    expect(d.finaleFired()).toBe(false);
    d.completeBeat('fin');
    expect(d.finaleFired()).toBe(true);
  });

  it('берётся первая удовлетворённая — условная раньше безусловной', () => {
    const d = new StoryletDirector(makeBundle({ spine: { beats: [], endings: endings(), logline: '' } }));
    expect(d.checkEnding()?.id).toBe('e_normal');
    d.slice.relationships.kira.affection = 0.7;
    expect(d.checkEnding()?.id).toBe('e_good');
  });

  it('из нескольких хороших играется концовка того, кто роднее', () => {
    // Порядок в списке тут не аргумент: роман с Юки не должен заканчиваться
    // сценой Киры только потому, что её линию автор перечислил первой.
    const both = [
      { id: 'e_good_kira', kind: 'good' as const, liId: 'kira', guard: { all: [] }, scenes: [{ text: 'Кира' }], background: '' },
      { id: 'e_good_yuki', kind: 'good' as const, liId: 'yuki', guard: { all: [] }, scenes: [{ text: 'Юки' }], background: '' },
    ];
    const bundle = makeBundle({
      stateSchema: { relationships: { kira: { affection: 0.4, trust: 0, tension: 0 }, yuki: { affection: 0.9, trust: 0, tension: 0 } }, flags: [] },
      cast: [
        { id: 'kira', name: 'Кира', isLI: true, bracketThresholds: bracketThresholdsFor(A0) },
        { id: 'yuki', name: 'Юки', isLI: true, bracketThresholds: bracketThresholdsFor(A0) },
      ],
      spine: { beats: [], endings: both, logline: '' },
    });
    expect(new StoryletDirector(bundle).checkEnding()?.id).toBe('e_good_yuki');
  });

  it('среди обычных и плохих порядок автора сохраняется', () => {
    const list = [
      { id: 'e_bad', kind: 'bad' as const, liId: null, guard: { all: [] }, scenes: [{ text: 'плохо' }], background: '' },
      { id: 'e_normal', kind: 'normal' as const, liId: null, guard: { all: [] }, scenes: [{ text: 'обычно' }], background: '' },
    ];
    const d = new StoryletDirector(makeBundle({ spine: { beats: [], endings: list, logline: '' } }));
    expect(d.checkEnding()?.id).toBe('e_bad');
  });

  it('концовка по флагу ветки', () => {
    const branchEndings = [
      { id: 'e_left', kind: 'normal' as const, liId: null, guard: { all: [{ flag: 'went_left' }] }, scenes: [{ text: 'налево' }], background: '' },
      { id: 'e_any', kind: 'normal' as const, liId: null, guard: { all: [] }, scenes: [{ text: 'куда-то' }], background: '' },
    ];
    const d = new StoryletDirector(makeBundle({ spine: { beats: [], endings: branchEndings, logline: '' } }));
    expect(d.checkEnding()?.id).toBe('e_any');
    d.slice.flags.add('went_left');
    expect(d.checkEnding()?.id).toBe('e_left');
  });
});

describe('StoryletDirector — конец календаря (анти-софтлок)', () => {
  // Регресс живого плейтеста: игрок проспал все биты, слот упёрся в потолок —
  // и повис в мире, где расписание кончилось (говорить не с кем), якорь
  // считался по slot % perDay («Двигаться дальше: день» после последнего
  // вечера), а финал с невыполнимым guard-ом не наступал никогда.

  const finaleNeedingFlag = () =>
    beat({ id: 'fin', kind: 'finale', window: { fromSlot: 9, toSlot: 12 }, guard: { all: [{ flag: 'met' }] } });
  const endings = () => [
    { id: 'e_normal', kind: 'normal' as const, liId: null, guard: { all: [] }, scenes: [{ text: 'обычно' }], background: '' },
  ];

  /** Сон до упора: политика игрока, который просто скипает время. */
  const sleepThrough = (d: StoryletDirector) => {
    let guard = 0;
    while (d.currentAnchor() && guard++ < 40) d.anchorAdvance();
  };

  it('за краем календаря якоря НЕТ — фантомное «Двигаться дальше: день» невозможно', () => {
    const d = new StoryletDirector(makeBundle());
    sleepThrough(d);
    expect(d.slot).toBe(12);
    expect(d.timeExhausted()).toBe(true);
    expect(d.currentAnchor()).toBeNull();
    expect(d.hubActions().anchor).toBeNull();
  });

  it('проспал цепочку битов → guard финала невыполним → история ОБЯЗАНА кончиться', () => {
    const beats = [
      beat({ id: 'b_met', window: { fromSlot: 0, toSlot: 2 }, effects: [{ setFlag: 'met' }], locationId: 'home' }),
      finaleNeedingFlag(),
    ];
    const d = new StoryletDirector(makeBundle({ spine: { beats, endings: endings(), logline: '' } }));
    // Игрок не идёт в home за b_met — просто спит. Окно бита закрывается.
    sleepThrough(d);
    expect(d.finaleFired()).toBe(false);
    expect(d.finaleReachable()).toBe(false);
    expect(d.shouldEnd()).toBe(true);
    expect(d.checkEnding()?.id).toBe('e_normal');
  });

  it('финал ещё достижим после последнего сна — игра НЕ обрывается, дойти можно', () => {
    // Окно финала дотянуто до потолка календаря: «после последнего сна» —
    // легитимное время дойти до него ногами.
    const beats = [beat({ id: 'fin', kind: 'finale', window: { fromSlot: 9, toSlot: 12 } })];
    const d = new StoryletDirector(makeBundle({ spine: { beats, endings: endings(), logline: '' } }));
    sleepThrough(d);
    expect(d.timeExhausted()).toBe(true);
    expect(d.finaleReachable()).toBe(true);
    expect(d.shouldEnd()).toBe(false);
    d.moveTo('cafe');
    expect(d.maturedBeat()?.id).toBe('fin');
  });

  it('до края календаря shouldEnd молчит', () => {
    const d = new StoryletDirector(makeBundle({ spine: { beats: [finaleNeedingFlag()], endings: endings(), logline: '' } }));
    d.anchorAdvance();
    expect(d.timeExhausted()).toBe(false);
    expect(d.shouldEnd()).toBe(false);
  });
});

describe('StoryletDirector — детерминизм и сейв', () => {
  /** Один и тот же сценарий действий; возвращает отпечаток прохождения. */
  const runScript = (seed: number): string => {
    const units = [unit({ id: 'u1', arcStage: 1 }), unit({ id: 'u2', arcStage: 1 }), unit({ id: 'u3', arcStage: 1 })];
    const d = new StoryletDirector(makeBundle({ units }), { seed });
    const trail: string[] = [];
    for (let i = 0; i < 6; i++) {
      const talks = d.hubActions().talks;
      if (talks.length > 0) {
        trail.push(talks[0].unitId);
        playTalk(d, talks[0].unitId, i % 2 === 0 ? 'warm' : 'cold');
      }
      d.anchorAdvance();
      trail.push(`s${d.slot}`);
    }
    return trail.join('|') + `#${d.slice.relationships.kira.affection.toFixed(4)}`;
  };

  it('один seed — одно прохождение (баг-репорт реплеится точь-в-точь)', () => {
    expect(runScript(12345)).toBe(runScript(12345));
  });

  it('перепрохождения на разных seed отличаются', () => {
    const seen = new Set([runScript(1), runScript(2), runScript(3), runScript(4), runScript(5)]);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('сейв восстанавливает состояние и поток ГПСЧ', () => {
    const bundle = makeBundle({ units: [unit({ id: 'u1', arcStage: 1 }), unit({ id: 'u2', arcStage: 1 })] });
    const live = new StoryletDirector(bundle, { seed: 99 });
    live.hubActions();
    playTalk(live, 'u1');
    live.anchorAdvance();
    const snap = live.snapshot();
    const liveTail = [live.hubActions().talks.map(t => t.unitId).join(','), live.slot, live.phase].join('|');

    const restored = StoryletDirector.restore(bundle, snap);
    expect(restored.slot).toBe(live.slot);
    expect(restored.phase).toBe(live.phase);
    expect(restored.location).toBe(live.location);
    expect([...restored.slice.flags]).toEqual([...live.slice.flags]);
    expect(restored.slice.fired.map(f => f.eventId)).toEqual(live.slice.fired.map(f => f.eventId));
    // Продолжение потока: тот же розыгрыш селектора, что у живого прогона.
    const restoredTail = [restored.hubActions().talks.map(t => t.unitId).join(','), restored.slot, restored.phase].join('|');
    expect(restoredTail).toBe(liveTail);
  });

  it('снимок сериализуем в JSON без потерь', () => {
    const bundle = makeBundle();
    const d = new StoryletDirector(bundle, { seed: 7 });
    playTalk(d, 'u1');
    const snap = JSON.parse(JSON.stringify(d.snapshot()));
    const restored = StoryletDirector.restore(bundle, snap);
    expect(restored.slice.relationships.kira.affection).toBeCloseTo(d.slice.relationships.kira.affection);
  });
});

describe('StoryletDirector — салиенс', () => {
  it('сюжетная сцена вытесняет филлер', () => {
    const units = [
      unit({ id: 'u_filler', arcStage: 1, source: 'filler' }),
      unit({ id: 'u_spine', arcStage: 1, source: 'spine' }),
    ];
    // topN=1 — чистый argmax, чтобы проверить именно ранжирование.
    const bundle = makeBundle({ units, selector: { ...DEFAULT_SELECTOR_CONFIG, topN: 1 } });
    expect(new StoryletDirector(bundle).hubActions().talks[0].unitId).toBe('u_spine');
  });

  it('следующая ступень лестницы вытесняет чужую', () => {
    const units = [
      unit({ id: 'u_far', arcStage: 3 }),
      unit({ id: 'u_next', arcStage: 1 }),
    ];
    const bundle = makeBundle({ units, selector: { ...DEFAULT_SELECTOR_CONFIG, topN: 1 } });
    expect(new StoryletDirector(bundle).hubActions().talks[0].unitId).toBe('u_next');
  });

  it('закрывающееся окно всплывает', () => {
    const units = [
      unit({ id: 'u_wide', arcStage: 1, at: { locationId: 'cafe', slot: { fromSlot: 0, toSlot: 11 } } }),
      unit({ id: 'u_closing', arcStage: 1, at: { locationId: 'cafe', slot: { fromSlot: 0, toSlot: 0 } } }),
    ];
    const bundle = makeBundle({ units, selector: { ...DEFAULT_SELECTOR_CONFIG, topN: 1 } });
    expect(new StoryletDirector(bundle).hubActions().talks[0].unitId).toBe('u_closing');
  });

  it('филлер НИКОГДА не вытесняет ступень арки — даже жребием', () => {
    // Регресс живого прогона демо: «поболтать» выиграло у сцены третьей
    // ступени, персонаж по расписанию ушёл, и вершина арки не сыграла вовсе —
    // вместо хорошей концовки выпала обычная. Ярусы это запрещают.
    const units = [
      unit({ id: 'f1', source: 'filler', arcStage: undefined }),
      unit({ id: 'f2', source: 'filler', arcStage: undefined }),
      unit({ id: 'u_rung', arcStage: 1, source: 'agenda' }),
    ];
    const bundle = makeBundle({ units });
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const d = new StoryletDirector(bundle, { seed });
      expect(d.hubActions().talks[0].unitId).toBe('u_rung');
    }
  });

  it('среди равноценных филлеров жребий всё-таки разный', () => {
    const units = [
      unit({ id: 'f1', source: 'filler', arcStage: undefined }),
      unit({ id: 'f2', source: 'filler', arcStage: undefined }),
      unit({ id: 'f3', source: 'filler', arcStage: undefined }),
    ];
    const bundle = makeBundle({ units });
    const picked = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(seed => new StoryletDirector(bundle, { seed }).hubActions().talks[0].unitId),
    );
    expect(picked.size).toBeGreaterThan(1);
  });

  it('пройденная ступень не держит ярус: дальше играют филлеры', () => {
    const units = [
      unit({ id: 'u_done', arcStage: 1 }),
      unit({ id: 'f1', source: 'filler', arcStage: undefined }),
    ];
    const d = new StoryletDirector(makeBundle({ units }));
    playTalk(d, 'u_done');
    d.phase = 0;
    expect(d.hubActions().talks[0].unitId).toBe('f1');
  });

  it('трейс выбора доступен для отладки', () => {
    const units = [unit({ id: 'u1', arcStage: 1 }), unit({ id: 'u2', arcStage: 1 })];
    const d = new StoryletDirector(makeBundle({ units }));
    d.hubActions();
    expect(d.lastSelection?.candidates).toHaveLength(2);
    expect(d.lastSelection?.picked).toBeTruthy();
    expect(d.lastSelection?.candidates[0].terms).toHaveProperty('arcProgress');
  });
});

/**
 * Политика игрока для сквозных прогонов: играет созревший бит, иначе говорит,
 * иначе идёт туда, где бит созрел, иначе двигает время якорем.
 *
 * Шаг «идти туда, где созрел бит» обязателен, а не для полноты: сон уводит
 * ДОМОЙ, и политика без перемещения навсегда застревает там, если сюжет живёт
 * в другой локации. Мир открыт — доходить до сюжета игрок обязан сам.
 */
function runPolicy(d: StoryletDirector, choice: 'warm' | 'cold', maxSteps = 200): void {
  let steps = 0;
  while (!d.finaleFired() && steps++ < maxSteps) {
    const matured = d.maturedBeat();
    if (matured) {
      d.completeBeat(matured.id, matured.outcomes?.[0]?.id);
      continue;
    }
    const actions = d.hubActions();
    if (actions.talks.length > 0) {
      playTalk(d, actions.talks[0].unitId, choice);
      continue;
    }
    const toBeat = actions.moves.find(m => d.maturedBeat(m.locationId));
    if (toBeat) {
      d.moveTo(toBeat.locationId);
      continue;
    }
    d.anchorAdvance();
  }
}

describe('StoryletDirector — сквозное прохождение', () => {
  it('жадная политика доходит до финала и получает концовку', () => {
    const beats = [
      beat({ id: 'b1', window: { fromSlot: 0, toSlot: 3 }, effects: [{ setFlag: 'met' }] }),
      beat({ id: 'fin', kind: 'finale', window: { fromSlot: 4, toSlot: 12 }, guard: { all: [{ flag: 'met' }] } }),
    ];
    const endings = [
      { id: 'e_good', kind: 'good' as const, liId: 'kira', guard: { all: [{ rel: { char: 'kira', var: 'affection', op: '>=' as const, value: 0.4 } }] }, scenes: [{ text: 'хорошо' }], background: '' },
      { id: 'e_normal', kind: 'normal' as const, liId: null, guard: { all: [] }, scenes: [{ text: 'обычно' }], background: '' },
    ];
    const units = [
      unit({ id: 'u1', arcStage: 1, effectsOnClose: [{ setFlag: 's1' }] }),
      unit({ id: 'u2', arcStage: 2, guard: { all: [{ flag: 's1' }] } }),
      unit({ id: 'u3', arcStage: 3, guard: { all: [{ flag: 's1' }] } }),
    ];
    const bundle = makeBundle({ units, spine: { beats, endings, logline: '' } });

    for (const seed of [1, 2, 3, 4, 5]) {
      const d = new StoryletDirector(bundle, { seed });
      runPolicy(d, 'warm');
      expect(d.finaleFired()).toBe(true);
      expect(d.checkEnding()).not.toBeNull();
      // Тёплая политика должна доводить до хорошей концовки.
      expect(d.checkEnding()!.id).toBe('e_good');
    }
  });

  it('холодная политика тоже доходит до конца — тупиков нет', () => {
    const beats = [beat({ id: 'fin', kind: 'finale', window: { fromSlot: 2, toSlot: 12 } })];
    const endings = [
      { id: 'e_good', kind: 'good' as const, liId: 'kira', guard: { all: [{ rel: { char: 'kira', var: 'affection', op: '>=' as const, value: 0.6 } }] }, scenes: [{ text: 'хорошо' }], background: '' },
      { id: 'e_normal', kind: 'normal' as const, liId: null, guard: { all: [] }, scenes: [{ text: 'обычно' }], background: '' },
    ];
    const bundle = makeBundle({ spine: { beats, endings, logline: '' } });
    const d = new StoryletDirector(bundle, { seed: 42 });
    runPolicy(d, 'cold');
    expect(d.finaleFired()).toBe(true);
    expect(d.checkEnding()!.id).toBe('e_normal');
  });
});
