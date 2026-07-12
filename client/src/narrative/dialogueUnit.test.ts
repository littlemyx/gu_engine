import { describe, expect, it } from 'vitest';
import type { DialogueUnit, DialogueUnitChoice, DialogueUnitNode } from './dialogueUnit';
import { parseDialogueUnit, validateDialogueUnit } from './dialogueUnit';

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
});
