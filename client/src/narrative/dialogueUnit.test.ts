import { describe, expect, it } from 'vitest';
import type { DialogueUnit, DialogueUnitChoice, DialogueUnitNode } from './dialogueUnit';
import {
  breakDialogueCycles,
  normalizeChoicePathDeltas,
  lintTimeOfDay,
  lintFarewellInBody,
  parseDialogueUnit,
  validateDialogueUnit,
} from './dialogueUnit';
import { CHOICE_PATH_DELTA_CAP } from './calendarTypes';

const LI = 'kira';

const choice = (patch: Partial<DialogueUnitChoice> & Pick<DialogueUnitChoice, 'id' | 'next'>): DialogueUnitChoice => ({
  kind: 'say',
  text: 'Ответить',
  effects: { stateDeltas: {}, flagSet: [], flagClear: [] },
  ...patch,
});

const node = (patch: Partial<DialogueUnitNode> & Pick<DialogueUnitNode, 'id'>): DialogueUnitNode => ({
  charactersPresent: [LI],
  characterEmotions: { [LI]: 'idle' },
  narration: 'Кира смотрит на тебя.',
  dialogue: [{ speaker: LI, emotion: 'idle', line: 'Привет.' }],
  choices: [],
  ...patch,
});

/**
 * Валидный эталонный юнит:
 *   n1 (entry) --ask--> n2 (ответ LI) --farewell--> n3 (closing)
 *   n1 --farewell--> n3
 * (к closing ведут только farewell-выборы — правило 5).
 */
const validUnit = (): DialogueUnit => ({
  id: 'unit_kira_neutral',
  liId: LI,
  bracket: 'neutral',
  entryNodeId: 'n1',
  nodes: [
    node({
      id: 'n1',
      choices: [
        choice({ id: 'c_ask', kind: 'ask', text: 'Спросить, как дела', next: 'n2' }),
        choice({ id: 'c_bye', kind: 'farewell', text: 'Попрощаться', next: 'n3' }),
      ],
    }),
    node({
      id: 'n2',
      dialogue: [{ speaker: LI, emotion: 'soft', line: 'Всё неплохо, спасибо.' }],
      choices: [
        choice({
          id: 'c_bye2',
          kind: 'farewell',
          text: 'Пожелать хорошего дня и попрощаться',
          next: 'n3',
          effects: { stateDeltas: { [`relationship[${LI}].affection`]: 0.05 }, flagSet: [], flagClear: [] },
        }),
      ],
    }),
    node({
      id: 'n3',
      closing: true,
      dialogue: [{ speaker: LI, emotion: 'happy', line: 'До встречи!' }],
      choices: [],
    }),
  ],
});

const errorsOf = (u: DialogueUnit) => validateDialogueUnit(u, LI).filter(i => i.severity === 'error');
const warningsOf = (u: DialogueUnit) => validateDialogueUnit(u, LI).filter(i => i.severity === 'warning');

describe('validateDialogueUnit', () => {
  it('валидный юнит проходит без ошибок', () => {
    expect(errorsOf(validUnit())).toEqual([]);
  });

  it('вопрос без ответа: ask ведёт в узел без реплики LI → error', () => {
    const u = validUnit();
    // n2 теряет реплику LI — вопрос остаётся без ответа.
    u.nodes[1].dialogue = [{ speaker: 'narrator', line: 'Повисает пауза.' }];
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'n1/choice/c_ask' && e.message.includes('вопрос обязан получить ответ'))).toBe(
      true,
    );
  });

  it('путь, не достигающий closing: лист без closing → error', () => {
    const u = validUnit();
    // n2 становится тупиком без closing-флага.
    u.nodes[1].choices = [];
    u.nodes[1].closing = undefined;
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'n2' && e.message.includes('обязан быть closing'))).toBe(true);
  });

  it('ask, ведущий в closing — замаскированный выход → error', () => {
    const u = validUnit();
    u.nodes[0].choices[0] = choice({ id: 'c_ask', kind: 'ask', text: 'Спросить, как дела', next: 'n3' });
    // n2 стал бы недостижим — уберём его из графа целиком.
    u.nodes.splice(1, 1);
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'n1/choice/c_ask' && e.message.includes('замаскированный выход'))).toBe(true);
  });

  it('движенческий эффект внутри юнита (slot / met[...]) → error', () => {
    const u = validUnit();
    u.nodes[0].choices[0].effects.stateDeltas = { slot: 1 };
    u.nodes[1].choices[0].effects.stateDeltas = { [`met[${LI}].0`]: 1 };
    const errs = errorsOf(u);
    expect(errs.filter(e => e.message.includes('им владеет encounter-обёртка'))).toHaveLength(2);
  });

  it('цикл в графе → error', () => {
    const u = validUnit();
    // n2 → n1 замыкает цикл.
    u.nodes[1].choices.push(choice({ id: 'c_loop', kind: 'say', text: 'Вернуться к началу', next: 'n1' }));
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'graph' && e.message.includes('цикл'))).toBe(true);
  });

  it('текст-вопрос при kind != ask → warning (рассинхрон)', () => {
    const u = validUnit();
    u.nodes[0].choices[0] = choice({ id: 'c_q', kind: 'say', text: 'Как ты себя чувствуешь?', next: 'n2' });
    expect(errorsOf(u)).toEqual([]);
    const warns = warningsOf(u);
    expect(warns.some(w => w.scope === 'n1/choice/c_q' && w.message.includes('рассинхрон'))).toBe(true);
  });

  it('недостижимый узел → error', () => {
    const u = validUnit();
    u.nodes.push(node({ id: 'orphan', closing: true }));
    // closing без реплики LI даст ещё одну ошибку — дадим реплику.
    u.nodes[3].dialogue = [{ speaker: LI, line: 'Пока.' }];
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'orphan' && e.message.includes('недостижим'))).toBe(true);
  });

  it('нет ни одного closing-узла → error', () => {
    const u = validUnit();
    u.nodes = [
      node({
        id: 'n1',
        choices: [choice({ id: 'c1', kind: 'say', text: 'Сказать что-то', next: 'n2' })],
      }),
      node({ id: 'n2', choices: [] }), // лист без closing
    ];
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'closing')).toBe(true);
  });

  it('closing без прощальной реплики LI → error', () => {
    const u = validUnit();
    u.nodes[2].dialogue = [{ speaker: 'narrator', line: 'Она уходит.' }];
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'n3' && e.message.includes('прощальную реплику'))).toBe(true);
  });

  it('глубина > 12 → error', () => {
    const chainNodes: DialogueUnitNode[] = [];
    for (let i = 1; i <= 14; i++) {
      chainNodes.push(
        node({
          id: `n${i}`,
          choices: [
            choice({
              id: `c${i}`,
              kind: i === 13 ? 'farewell' : 'say',
              text: i === 13 ? 'Попрощаться' : 'Продолжить',
              next: `n${i + 1}`,
            }),
          ],
        }),
      );
    }
    chainNodes[13].choices = [];
    chainNodes[13].closing = true;
    const u: DialogueUnit = { id: 'deep', liId: LI, bracket: 'neutral', entryNodeId: 'n1', nodes: chainNodes };
    const errs = errorsOf(u);
    expect(errs.some(e => e.scope === 'depth')).toBe(true);
  });
});

describe('parseDialogueUnit', () => {
  it('парсит валидный JSON в DialogueUnit', () => {
    const raw = JSON.stringify(validUnit());
    const parsed = parseDialogueUnit(raw);
    expect(parsed.entryNodeId).toBe('n1');
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.nodes[0].choices[0].kind).toBe('ask');
    expect(parsed.nodes[2].closing).toBe(true);
    expect(validateDialogueUnit(parsed, LI).filter(i => i.severity === 'error')).toEqual([]);
  });

  it('пропущенный next коэрсится в пустую строку — ловит валидатор, не парсер', () => {
    const u = validUnit() as unknown as { nodes: { choices: { next?: string }[] }[] };
    delete u.nodes[0].choices[0].next;
    const parsed = parseDialogueUnit(JSON.stringify(u));
    expect(parsed.nodes[0].choices[0].next).toBe('');
    const errs = validateDialogueUnit(parsed, LI).filter(i => i.severity === 'error');
    expect(errs.some(e => e.scope === 'n1/choice/c_ask')).toBe(true);
  });

  it('неизвестный kind коэрсится в say', () => {
    const u = validUnit() as unknown as { nodes: { choices: { kind: string }[] }[] };
    u.nodes[0].choices[0].kind = 'shout';
    const parsed = parseDialogueUnit(JSON.stringify(u));
    expect(parsed.nodes[0].choices[0].kind).toBe('say');
  });

  it('бросает на невалидном bracket и отсутствии nodes/entryNodeId', () => {
    expect(() => parseDialogueUnit('{"nodes": [], "entryNodeId": "", "bracket": "warm"}')).toThrow();
    expect(() => parseDialogueUnit('{"bracket": "neutral"}')).toThrow(/nodes or entryNodeId/);
    expect(() => parseDialogueUnit('not json')).toThrow(/JSON parse failed/);
  });

  it('щедрая дельта от LLM клампится на входе (±0.1)', () => {
    // Промпт просит -0.05..+0.1, но численно это не проверялось: одна дельта
    // +0.5 брала бы ступень лестницы за один выбор.
    const u = validUnit() as unknown as {
      nodes: { choices: { effects: { stateDeltas: Record<string, number> } }[] }[];
    };
    u.nodes[1].choices[0].effects.stateDeltas[`relationship[${LI}].affection`] = 0.5;
    u.nodes[1].choices[0].effects.stateDeltas[`relationship[${LI}].trust`] = -0.9;
    const parsed = parseDialogueUnit(JSON.stringify(u));
    const d = parsed.nodes[1].choices[0].effects.stateDeltas;
    expect(d[`relationship[${LI}].affection`]).toBe(0.1);
    expect(d[`relationship[${LI}].trust`]).toBe(-0.1);
  });
});

describe('validateDialogueUnit: анти-гринд по пути', () => {
  /** Цепочка из n выборов по delta, все ведут к closing. */
  const chainUnit = (steps: number, delta: number): DialogueUnit => {
    const key = `relationship[${LI}].affection`;
    const nodes: DialogueUnitNode[] = [];
    for (let i = 1; i <= steps; i++) {
      nodes.push(
        node({
          id: `n${i}`,
          dialogue: [{ speaker: LI, emotion: 'soft', line: 'Понимаю.' }],
          choices: [
            choice({
              id: `c${i}`,
              kind: 'say',
              text: 'Продолжить',
              next: i === steps ? `n${steps + 1}` : `n${i + 1}`,
              effects: { stateDeltas: { [key]: delta }, flagSet: [], flagClear: [] },
            }),
            choice({ id: `bye${i}`, kind: 'farewell', text: 'Попрощаться', next: 'nc' }),
          ],
        }),
      );
    }
    nodes.push(
      node({ id: `n${steps + 1}`, choices: [choice({ id: 'cf', kind: 'farewell', text: 'Пора', next: 'nc' })] }),
    );
    nodes.push(
      node({ id: 'nc', closing: true, dialogue: [{ speaker: LI, emotion: 'happy', line: 'Пока!' }], choices: [] }),
    );
    return { id: 'u', liId: LI, bracket: 'neutral', entryNodeId: 'n1', nodes };
  };

  const errs = (u: DialogueUnit) => validateDialogueUnit(u, LI).filter(i => i.severity === 'error');

  it('умеренный путь проходит', () => {
    expect(errs(chainUnit(2, 0.05))).toEqual([]); // сумма +0.10 ≤ 0.15
  });

  it('длинная цепочка мелких плюсов ловится (кламп на одну дельту тут бессилен)', () => {
    // 4 × 0.1 = +0.4 за один разговор — перепрыгивает ступень с наскока.
    const e = errs(chainUnit(4, 0.1));
    expect(e.some(i => i.scope === 'deltas' && i.message.includes('+0.40'))).toBe(true);
  });

  it('холодный путь ограничен симметрично', () => {
    const e = errs(chainUnit(4, -0.1));
    expect(e.some(i => i.scope === 'deltas' && i.message.includes('−0.40'))).toBe(true);
  });

  describe('normalizeChoicePathDeltas', () => {
    const key = `relationship[${LI}].affection`;
    const deltasOf = (u: DialogueUnit) =>
      u.nodes.flatMap(n => n.choices.map(c => c.effects.stateDeltas[key]).filter(d => d != null));

    it('ужимает перебор до капа — и юнит становится валидным', () => {
      // Живой прогон: ВСЕ 34 юнита падали здесь. Модель писала ровно то, что
      // просит промпт (шаг −0.05…+0.1), а 4 шага подряд дают +0.4.
      const { unit, scaled } = normalizeChoicePathDeltas(chainUnit(4, 0.1));
      expect(scaled).toEqual([`${key}: ±0.40 → ±0.15`]);
      expect(errs(unit)).toEqual([]);
    });

    it('сохраняет пропорции выборов: сжатие — не уравниловка', () => {
      const u: DialogueUnit = {
        ...chainUnit(2, 0.1),
      };
      // Первый выбор вдвое «теплее» второго — после нормировки должен им и остаться.
      u.nodes[0].choices[0].effects.stateDeltas[key] = 0.2;
      u.nodes[1].choices[0].effects.stateDeltas[key] = 0.1;
      const { unit } = normalizeChoicePathDeltas(u);
      const [a, b] = deltasOf(unit);
      expect(a / b).toBeCloseTo(2, 2);
      expect(a + b).toBeLessThanOrEqual(CHOICE_PATH_DELTA_CAP + 1e-9);
    });

    it('умеренный путь не трогает вовсе (идемпотентность на валидном)', () => {
      const src = chainUnit(2, 0.05);
      const { unit, scaled } = normalizeChoicePathDeltas(src);
      expect(scaled).toEqual([]);
      expect(unit).toBe(src);
    });

    it('повторный вызов ничего не меняет', () => {
      const once = normalizeChoicePathDeltas(chainUnit(4, 0.1)).unit;
      const twice = normalizeChoicePathDeltas(once);
      expect(twice.scaled).toEqual([]);
      expect(deltasOf(twice.unit)).toEqual(deltasOf(once));
    });

    it('холодный путь ужимается симметрично, знак сохраняется', () => {
      const { unit } = normalizeChoicePathDeltas(chainUnit(4, -0.1));
      expect(errs(unit)).toEqual([]);
      expect(deltasOf(unit).every(d => d < 0)).toBe(true);
    });
  });
});

describe('breakDialogueCycles', () => {
  /**
   * Реконструкция реального фейла E2E-прогона (campus_alley/negative):
   * LLM пишет «возврат к прошлой теме» — n3[say]→n2 замыкает цикл n2→n3→n2.
   */
  const cyclicUnit = (): DialogueUnit => ({
    id: 'unit_cyclic',
    liId: LI,
    bracket: 'negative',
    entryNodeId: 'n1',
    nodes: [
      node({
        id: 'n1',
        choices: [
          choice({ id: 'c1', kind: 'say', text: 'Заговорить', next: 'n2' }),
          choice({ id: 'c1b', kind: 'farewell', text: 'Уйти', next: 'bye' }),
        ],
      }),
      node({
        id: 'n2',
        choices: [
          choice({ id: 'c2', kind: 'say', text: 'Продолжить', next: 'n3' }),
          choice({ id: 'c2b', kind: 'farewell', text: 'Уйти', next: 'bye' }),
        ],
      }),
      node({
        id: 'n3',
        choices: [
          choice({ id: 'c3', kind: 'say', text: 'Вернуться к теме', next: 'n2' }), // цикл
          choice({ id: 'c3b', kind: 'farewell', text: 'Попрощаться', next: 'bye' }),
        ],
      }),
      node({
        id: 'bye',
        closing: true,
        dialogue: [{ speaker: LI, emotion: 'idle', line: 'Пока.' }],
        choices: [],
      }),
    ],
  });

  it('цикл ловится валидатором, разрыв делает юнит полностью валидным', () => {
    const before = errorsOf(cyclicUnit());
    expect(before.some(e => e.message.includes('цикл'))).toBe(true);

    const { unit: fixed, broken } = breakDialogueCycles(cyclicUnit());
    expect(broken).toEqual(['n3[say]→n2']);
    expect(errorsOf(fixed)).toEqual([]);
    // Узел-источник сохранил остальные выборы (не стал обрывом).
    const n3 = fixed.nodes.find(n => n.id === 'n3')!;
    expect(n3.choices.map(c => c.id)).toEqual(['c3b']);
  });

  it('идемпотентен: DAG проходит без изменений', () => {
    const clean = validUnit();
    const { unit: same, broken } = breakDialogueCycles(clean);
    expect(broken).toEqual([]);
    expect(same).toEqual(clean);
    // Повторный вызов на уже разорванном тоже ничего не рвёт.
    const { unit: fixed } = breakDialogueCycles(cyclicUnit());
    expect(breakDialogueCycles(fixed).broken).toEqual([]);
  });

  it('узел с единственным выбором-циклом не трогает (оставляет валидатору)', () => {
    const u = cyclicUnit();
    u.nodes[2].choices = [choice({ id: 'c3', kind: 'say', text: 'Вернуться', next: 'n2' })];
    const { unit: same, broken } = breakDialogueCycles(u);
    expect(broken).toEqual([]);
    expect(errorsOf(same).some(e => e.message.includes('цикл'))).toBe(true);
  });
});

describe('lintTimeOfDay: проза не врёт про время суток', () => {
  const withLine = (line: string): DialogueUnit => ({
    id: 'u',
    liId: LI,
    bracket: 'neutral',
    entryNodeId: 'n1',
    nodes: [
      node({
        id: 'n1',
        dialogue: [{ speaker: LI, emotion: 'idle', line }],
        choices: [choice({ id: 'c', kind: 'farewell', text: 'Пора', next: 'nc' })],
      }),
      node({ id: 'nc', closing: true, dialogue: [], choices: [] }),
    ],
  });

  it('окно шире части дня — приветствие запрещено: в половине слотов оно ложь', () => {
    // Живой плейтест: Асель говорит «Доброе утро» в ДЕНЬ 1 · ВЕЧЕР.
    const e = lintTimeOfDay(withLine('Доброе утро. Рада видеть тебя.'), ['утро', 'день', 'вечер']);
    expect(e.some(i => i.severity === 'error' && i.scope === 'timeOfDay/n1')).toBe(true);
  });

  it('окно в одной части дня — совпадающее приветствие проходит', () => {
    expect(lintTimeOfDay(withLine('Доброе утро.'), ['утро'])).toEqual([]);
  });

  it('окно в одной части дня — НЕсовпадающее приветствие ловится', () => {
    const e = lintTimeOfDay(withLine('Доброе утро.'), ['вечер']);
    expect(e[0]?.severity).toBe('error');
    expect(e[0]?.message).toContain('утро');
  });

  it('время-нейтральная реплика проходит при любом окне', () => {
    expect(lintTimeOfDay(withLine('Рада тебя видеть.'), ['утро', 'вечер'])).toEqual([]);
  });

  it('е-написание ловится наравне с ё: LLM пишет «днем», а не «днём»', () => {
    // Без ё-нормализации маркер «сегодня днём» не совпал бы с выводом модели,
    // и линт молча пропустил бы привязку к части дня.
    const e = lintTimeOfDay(withLine('Сегодня днем ты выглядишь усталой.'), ['вечер']);
    expect(e[0]?.severity).toBe('error');
  });

  it('голое наречие времени НЕ считается привязкой сцены: воспоминание — не «сейчас»', () => {
    // «Я утром видела тебя в библиотеке» — воспоминание, а не приветствие.
    // Ложный error жёг бы ретраи (автор платит за генерацию).
    expect(lintTimeOfDay(withLine('Я утром видела тебя в библиотеке.'), ['вечер'])).toEqual([]);
    expect(lintTimeOfDay(withLine('Позвони мне вечером, если освободишься.'), ['утро'])).toEqual([]);
  });
});

describe('lintFarewellInBody: прощание — не конец ступени', () => {
  const body = (line: string): DialogueUnit => ({
    id: 'u',
    liId: LI,
    bracket: 'neutral',
    entryNodeId: 'n1',
    nodes: [
      node({
        id: 'n1',
        dialogue: [{ speaker: LI, emotion: 'idle', line }],
        choices: [choice({ id: 'c', kind: 'farewell', text: 'Пора', next: 'nc' })],
      }),
      node({ id: 'nc', closing: true, dialogue: [], choices: [] }),
    ],
  });

  it('ловит прощание в теле: иначе персонаж попрощается и не уйдёт', () => {
    // Живой плейтест: «Спасибо за разговор. Надеюсь, скоро увидимся» — и следом
    // «Асель не спешит уходить», потому что у посиделки есть продолжение.
    const e = lintFarewellInBody(body('Спасибо за разговор. Надеюсь, скоро увидимся.'));
    expect(e.some(i => i.severity === 'error' && i.scope === 'farewell/n1')).toBe(true);
  });

  it('пауза без прощальных слов проходит', () => {
    expect(lintFarewellInBody(body('Асель задумчиво крутит чашку. За окном темнеет.'))).toEqual([]);
  });

  it('границы слова Unicode-осознанные: «увидимся» ловится, «увидимся» внутри слова — нет', () => {
    // \b в JS кириллицу не видит вовсе (линт был бы вечно зелёным), а без
    // границ маркер ловился бы внутри других слов.
    expect(lintFarewellInBody(body('Скоро увидимся.')).length).toBeGreaterThan(0);
    expect(lintFarewellInBody(body('Свидимся-ка мы нескоро, думает она.'))).toEqual([]);
  });

  it('двусмысленное «пока» прощанием НЕ считается — ложная отбраковка дороже пропуска', () => {
    // Линт кормит ретраи: ложное срабатывание жжёт деньги на хорошей прозе.
    expect(lintFarewellInBody(body('Пока не знаю, что думать.'))).toEqual([]);
    expect(lintFarewellInBody(body('Давай покажу, что я нашла в архиве.'))).toEqual([]);
  });
});

describe('parseDialogueUnit: farewell', () => {
  const base = { bracket: 'neutral', entryNodeId: 'n1', nodes: [{ id: 'n1' }] };

  it('farewell парсится в отдельную сцену', () => {
    const u = parseDialogueUnit(
      JSON.stringify({
        ...base,
        farewell: { narration: 'Она машет.', dialogue: [{ speaker: LI, line: 'До встречи!' }] },
      }),
    );
    expect(u.farewell?.narration).toBe('Она машет.');
    expect(u.farewell?.dialogue[0].line).toBe('До встречи!');
  });

  it('старая проза без farewell парсится как раньше — поле опционально', () => {
    expect(parseDialogueUnit(JSON.stringify(base)).farewell).toBeUndefined();
  });
});
