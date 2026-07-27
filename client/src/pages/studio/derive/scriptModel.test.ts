import { describe, expect, it } from 'vitest';

import { deriveScript } from './scriptModel';

import type { Calendar, EventUnit, SpinePlan } from '@/narrative/calendarTypes';
import type { DialogueUnit } from '@/narrative/dialogueUnit';
import type { AnchorBeat, Brief, WorldModel } from '@/narrative/types';

const calendar: Calendar = {
  days: 2,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 6,
  actBoundaries: [0, 1],
};

const brief = {
  loveInterests: [{ id: 'kira', name: 'Кира' }],
} as unknown as Brief;

const worldModel = {
  locations: [{ id: 'loc_cafe', name: 'кафе Прибой', adjacent: [] }],
  anchorLocations: {},
} as unknown as WorldModel;

const spine: SpinePlan = {
  title: 'Лето',
  logline: '—',
  beats: [
    {
      id: 'b1',
      kind: 'beat',
      act: 0,
      window: { fromSlot: 0, toSlot: 0 },
      locationId: 'loc_cafe',
      participants: ['kira'],
      summary: 'Знакомство',
      establishes: ['met_kira'],
      guard: { all: [] },
    },
  ],
  endings: [],
};

const unit: EventUnit = {
  id: 'enc_kira',
  kind: 'dialogue',
  at: { slot: { fromSlot: 1, toSlot: 2 }, locationId: 'loc_cafe' },
  participants: ['kira'],
  guard: { all: [{ flag: 'met_kira' }] },
  effects: [{ setFlag: 'talked' }],
  priority: 10,
  goal: 'разговор у стойки',
  source: 'agenda',
} as EventUnit;

/** Юнит с развилкой: вход → два выбора → закрывающий узел. */
const dialogue: DialogueUnit = {
  id: 'enc_kira',
  liId: 'kira',
  bracket: 'neutral',
  entryNodeId: 'n1',
  nodes: [
    {
      id: 'n1',
      charactersPresent: ['kira'],
      characterEmotions: {},
      narration: 'Она поднимает взгляд.',
      dialogue: [{ speaker: 'kira', emotion: 'shy', line: 'Привет.' }],
      choices: [
        {
          id: 'c1',
          kind: 'say',
          text: 'Ответить',
          next: 'n2',
          effects: { stateDeltas: { 'trust.kira': 0.1 }, flagSet: [], flagClear: [] },
        },
        {
          id: 'c2',
          kind: 'farewell',
          text: 'Уйти',
          next: 'n2',
          effects: { stateDeltas: {}, flagSet: [], flagClear: [] },
        },
      ],
    },
    {
      id: 'n2',
      charactersPresent: ['kira'],
      characterEmotions: {},
      narration: 'Разговор гаснет.',
      dialogue: [],
      choices: [],
      closing: true,
    },
  ],
  farewell: { narration: 'Она машет рукой.', dialogue: [{ speaker: 'kira', line: 'Пока.' }] },
};

const beatProse: Record<string, AnchorBeat> = {
  b1: { anchorId: 'b1', beatText: 'Ты входишь в кафе.', transitions: [{ toAnchorId: 'b2', label: 'Пойти дальше' }] },
};

const base = {
  brief,
  calendar,
  spine,
  worldModel,
  eventUnits: { enc_kira: unit },
  unitProse: {},
  spineBeatProse: {},
};

describe('deriveScript', () => {
  it('группирует сцены по слотам, хребет идёт впереди встречи', () => {
    const model = deriveScript(base);

    expect(model.groups.map(g => g.slot)).toEqual([0, 1]);
    expect(model.groups[0].blocks[0].kind).toBe('beat');
    expect(model.groups[1].blocks[0].key).toBe('unit:enc_kira:neutral');
    expect(model.total).toBe(2);
  });

  it('проза бита превращается в нарацию и переходы', () => {
    const model = deriveScript({ ...base, spineBeatProse: beatProse });
    const block = model.groups[0].blocks[0];

    expect(block.state).toBe('done');
    expect(block.lines[0]).toEqual({ kind: 'narration', text: 'Ты входишь в кафе.' });
    expect(block.lines[1]).toMatchObject({ kind: 'choice', text: 'Пойти дальше' });
    expect(block.effectText).toBe('+met_kira');
  });

  it('юнит разворачивается обходом от входа, узлы не повторяются', () => {
    const model = deriveScript({
      ...base,
      unitProse: { enc_kira: [dialogue] },
    });
    const block = model.groups[1].blocks[0];

    const nodes = block.lines.filter(l => l.kind === 'node');
    expect(nodes).toHaveLength(3); // n1, n2 и прощание
    expect(nodes[0]).toMatchObject({ text: 'n1 · вход' });
    expect(nodes[1]).toMatchObject({ text: 'n2 · выход' });
    expect(block.lines.filter(l => l.kind === 'choice')).toHaveLength(2);
    expect(block.lines.some(l => l.kind === 'speech' && l.text === 'Пока.')).toBe(true);
  });

  it('выбор несёт дельты и флаги в аннотации', () => {
    const model = deriveScript({ ...base, unitProse: { enc_kira: [dialogue] } });
    const choice = model.groups[1].blocks[0].lines.find(l => l.kind === 'choice');

    expect(choice).toMatchObject({ kind: 'choice', text: 'Ответить' });
    expect(choice && 'note' in choice ? choice.note : '').toContain('trust.kira +0.1');
  });

  it('ступень выбирает прозу: без неё блок пустой', () => {
    const model = deriveScript({
      ...base,
      unitProse: { enc_kira: [dialogue] },
      bracket: 'positive',
    });

    expect(model.groups[1].blocks[0].state).toBe('empty');
    expect(model.withProse).toBe(0);
  });

  it('чужая ветка запирает блок', () => {
    const spineWithBranch: SpinePlan = {
      ...spine,
      beats: [
        {
          ...spine.beats[0],
          id: 'b2',
          guard: { all: [{ flag: 'never_set' }] },
          window: { fromSlot: 3, toSlot: 3 },
        },
      ],
    };
    const model = deriveScript({ ...base, spine: spineWithBranch, eventUnits: {} });

    expect(model.groups[0].blocks[0].state).toBe('locked');
  });
});
