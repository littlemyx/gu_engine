import type { DialogueLine, DialogueVariantBracket, SegmentIssue, StateVarPath } from './types';
import { isQuestionChoice } from './types';
import { CHOICE_DELTA_BOUND, CHOICE_PATH_DELTA_CAP } from './calendarTypes';

/**
 * Диалог — первоклассная сущность (фаза 3 docs/plans/calendar-branching.md).
 *
 * Ключевое отличие от DialogueVariant: полнота диалога — СТРУКТУРНАЯ,
 * а не эвристическая. У выбора обязательный typed kind (ask/say/react/
 * farewell) и обязательный next — концепт «nextSceneId: null = выход»
 * исчезает. Выход из диалога существует только через closing-узлы
 * (прощальная сцена с финальной репликой LI); движенческие эффекты
 * (met, slot+1, возврат в хаб) диалогу не принадлежат — их вешает
 * encounter-обёртка компилятора на auto-advance closing-узла.
 */

export type DialogueChoiceKind = 'ask' | 'say' | 'react' | 'farewell';

export const DIALOGUE_CHOICE_KINDS: DialogueChoiceKind[] = ['ask', 'say', 'react', 'farewell'];

export type DialogueUnitChoice = {
  id: string;
  kind: DialogueChoiceKind;
  text: string;
  /** id узла ВНУТРИ юнита — обязателен для всех kind. */
  next: string;
  effects: { stateDeltas: Record<string, number>; flagSet: string[]; flagClear: string[] };
};

export type DialogueUnitNode = {
  id: string;
  charactersPresent: string[];
  characterEmotions: Record<string, string>;
  narration: string;
  dialogue: DialogueLine[];
  /** closing-узлы: choices = []. */
  choices: DialogueUnitChoice[];
  closing?: boolean;
};

export type DialogueUnit = {
  id: string;
  liId: string;
  /** Тот же литеральный union, что у DialogueVariant.bracket. */
  bracket: DialogueVariantBracket;
  entryNodeId: string;
  nodes: DialogueUnitNode[];
  /**
   * Прощание — ОТДЕЛЬНАЯ сцена, играемая только при реальном уходе.
   *
   * Тело ступени заканчивается паузой: разговор может продолжиться следующей
   * ступенью, и прощальная реплика внутри тела делала персонажа попрощавшимся,
   * но не ушедшим (живой плейтест). Поле опционально: проза, сгенерированная до
   * этого контракта, играет по-старому — перегенерировать оплаченное незачем.
   */
  farewell?: { narration: string; dialogue: DialogueLine[] };
};

/** Каждый путь от entry обязан достигать closing-узла не глубже этого. */
export const DIALOGUE_UNIT_MAX_DEPTH = 12;

// ============================================================================
// PARSER (LLM JSON → DialogueUnit; в стиле parseDialogueVariant)
// ============================================================================

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : []);

/**
 * Дельты выборов — жёсткий кламп на входе.
 *
 * Промпт просит «-0.05..+0.1», но численно это не проверялось: одна щедрая
 * дельта (+0.5) обнуляла бы всю арифметику лестницы отношений — пороги ступеней
 * берутся холодным перебором выборов за один присест. Валюта арки не может
 * зависеть от того, послушалась ли модель.
 */
function clampStateDeltas(raw: unknown): Record<StateVarPath, number> {
  const out: Record<string, number> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.max(-CHOICE_DELTA_BOUND, Math.min(CHOICE_DELTA_BOUND, n));
  }
  return out;
}

/**
 * Парсер терпим к семантике и строг к скелету: отсутствующий next/kind
 * коэрсится в пустую строку / 'say' не выбрасывая — такие дефекты ловит
 * validateDialogueUnit и возвращает их фидбеком в retry-цикл.
 */
export function parseDialogueUnit(rawText: string): DialogueUnit {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`dialogue unit JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('dialogue unit must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.nodes) || !obj.entryNodeId) {
    throw new Error('dialogue unit missing nodes or entryNodeId');
  }

  const validBrackets: DialogueVariantBracket[] = ['positive', 'neutral', 'negative'];
  const bracket = String(obj.bracket ?? 'neutral') as DialogueVariantBracket;
  if (!validBrackets.includes(bracket)) {
    throw new Error(`invalid bracket "${obj.bracket}", expected one of: ${validBrackets.join(', ')}`);
  }

  const nodes: DialogueUnitNode[] = (obj.nodes as unknown[]).map((n, i) => {
    const node = n as Record<string, unknown>;
    if (!node.id) throw new Error(`nodes[${i}] missing id`);
    return {
      id: String(node.id),
      charactersPresent: asStringArray(node.charactersPresent),
      characterEmotions:
        node.characterEmotions && typeof node.characterEmotions === 'object'
          ? (node.characterEmotions as Record<string, string>)
          : {},
      narration: String(node.narration ?? ''),
      dialogue: Array.isArray(node.dialogue)
        ? (node.dialogue as unknown[]).map((d): DialogueLine => {
            const line = d as Record<string, unknown>;
            return {
              speaker: String(line.speaker ?? ''),
              ...(line.emotion ? { emotion: String(line.emotion) } : {}),
              line: String(line.line ?? ''),
            };
          })
        : [],
      choices: Array.isArray(node.choices)
        ? (node.choices as unknown[]).map((c, j): DialogueUnitChoice => {
            const choice = c as Record<string, unknown>;
            const effects = (choice.effects ?? {}) as Record<string, unknown>;
            const kind = String(choice.kind ?? 'say') as DialogueChoiceKind;
            return {
              id: String(choice.id ?? `${node.id}_c${j}`),
              kind: DIALOGUE_CHOICE_KINDS.includes(kind) ? kind : 'say',
              text: String(choice.text ?? ''),
              next: choice.next != null ? String(choice.next) : '',
              effects: {
                stateDeltas: clampStateDeltas(effects.stateDeltas),
                flagSet: asStringArray(effects.flagSet),
                flagClear: asStringArray(effects.flagClear),
              },
            };
          })
        : [],
      ...(node.closing != null ? { closing: Boolean(node.closing) } : {}),
    };
  });

  const rawFarewell = obj.farewell as Record<string, unknown> | undefined;
  const farewell =
    rawFarewell && typeof rawFarewell === 'object'
      ? {
          narration: String(rawFarewell.narration ?? ''),
          dialogue: Array.isArray(rawFarewell.dialogue)
            ? (rawFarewell.dialogue as unknown[]).map((d): DialogueLine => {
                const line = d as Record<string, unknown>;
                return {
                  speaker: String(line.speaker ?? ''),
                  ...(line.emotion ? { emotion: String(line.emotion) } : {}),
                  line: String(line.line ?? ''),
                };
              })
            : [],
        }
      : undefined;

  return {
    id: String(obj.id ?? ''),
    liId: String(obj.liId ?? ''),
    bracket,
    entryNodeId: String(obj.entryNodeId),
    nodes,
    ...(farewell && (farewell.narration || farewell.dialogue.length) ? { farewell } : {}),
  };
}

// ============================================================================
// NORMALIZER (детерминированный разрыв циклов — LLM-вывод это черновик)
// ============================================================================

/**
 * LLM устойчиво пишет «возврат к прошлой теме» (say/ask → более ранний узел),
 * а контракт требует DAG — retry-фидбек это не лечит. Разрываем детерминированно:
 * back-edge (ребро в «серый» узел DFS от entry) удаляется ВМЕСТЕ с выбором,
 * если у узла-источника остаются другие выборы (диалог остаётся полным: узел
 * не становится обрывом). Узел с единственным выбором-циклом не трогаем —
 * молча превращать его в обрыв хуже, чем отдать ошибку валидатору.
 *
 * Возвращает нормализованный юнит и список разорванных рёбер (warning автору).
 * Идемпотентен: на DAG возвращает юнит без изменений.
 */
export function breakDialogueCycles(unit: DialogueUnit): { unit: DialogueUnit; broken: string[] } {
  const broken: string[] = [];
  let current = unit;
  // Каждый проход рвёт максимум одно ребро; рёбер конечно — цикл ограничен.
  const maxPasses = unit.nodes.reduce((acc, n) => acc + n.choices.length, 0) + 1;

  for (let pass = 0; pass < maxPasses; pass++) {
    const nodeById = new Map(current.nodes.map(n => [n.id, n]));
    if (!nodeById.has(current.entryNodeId)) return { unit: current, broken };

    // Итеративный DFS (white/gray/black): ищем первое ребро в серый узел.
    const color = new Map<string, 0 | 1 | 2>();
    let backEdge: { nodeId: string; choice: DialogueUnitChoice } | null = null;
    const stack: { id: string; childIdx: number }[] = [{ id: current.entryNodeId, childIdx: 0 }];
    color.set(current.entryNodeId, 1);
    while (stack.length > 0 && !backEdge) {
      const frame = stack[stack.length - 1];
      const node = nodeById.get(frame.id)!;
      if (frame.childIdx < node.choices.length) {
        const choice = node.choices[frame.childIdx++];
        if (!nodeById.has(choice.next)) continue; // битая ссылка — дело валидатора
        const c = color.get(choice.next) ?? 0;
        if (c === 1) {
          backEdge = { nodeId: node.id, choice };
        } else if (c === 0) {
          color.set(choice.next, 1);
          stack.push({ id: choice.next, childIdx: 0 });
        }
      } else {
        color.set(frame.id, 2);
        stack.pop();
      }
    }

    if (!backEdge) return { unit: current, broken }; // DAG — готово
    const src = nodeById.get(backEdge.nodeId)!;
    if (src.choices.length < 2) return { unit: current, broken }; // нечем жертвовать

    const doomed = backEdge.choice;
    current = {
      ...current,
      nodes: current.nodes.map(n =>
        n.id === backEdge!.nodeId ? { ...n, choices: n.choices.filter(c => c !== doomed) } : n,
      ),
    };
    broken.push(`${backEdge.nodeId}[${doomed.kind}]→${doomed.next}`);
  }
  return { unit: current, broken };
}

/** Экстремальная (в направлении dir) сумма дельт `key` по путям node→closing. */
function extremePathDelta(unit: DialogueUnit, key: string, dir: 1 | -1): number {
  const nodeById = new Map(unit.nodes.map(n => [n.id, n]));
  const memo = new Map<string, number>();
  const bestFrom = (id: string): number => {
    const m = memo.get(id);
    if (m != null) return m;
    memo.set(id, 0); // страховка от цикла: до нормировки граф уже DAG, но не падаем
    const node = nodeById.get(id);
    let best = 0;
    for (const c of node?.choices ?? []) {
      const step = (c.effects.stateDeltas[key] ?? 0) * dir;
      best = Math.max(best, step + bestFrom(c.next));
    }
    memo.set(id, best);
    return best;
  };
  return bestFrom(unit.entryNodeId);
}

/**
 * Пропорционально ужимает дельты отношений так, чтобы ни один путь
 * entry→closing не выходил за `CHOICE_PATH_DELTA_CAP`.
 *
 * Почему нормируем, а не отвергаем: живой прогон завалил 39 юнитов из 34 —
 * ВСЕ по этому капу. Модель писала ровно то, что просит промпт («шаг выбора
 * −0.05…+0.1»), но четыре выбора подряд дают +0.28, и кап резал корректную
 * прозу. Кап — свойство арки, а не текста: валюта ступени — детерминированный
 * closing-гейн, а дельты выборов лишь оттеняют тон. Значит их можно сжать
 * пропорционально — соотношение выборов между собой (что теплее, что холоднее)
 * сохраняется, а перепрыгнуть ступень с наскока становится нельзя. Отбраковка
 * же стоила бы генерации целого юнита ради того, что чинится арифметикой.
 *
 * Требует DAG — вызывать ПОСЛЕ breakDialogueCycles. Идемпотентна.
 */
export function normalizeChoicePathDeltas(unit: DialogueUnit): { unit: DialogueUnit; scaled: string[] } {
  const relKeys = new Set<string>();
  for (const n of unit.nodes)
    for (const c of n.choices)
      for (const k of Object.keys(c.effects.stateDeltas)) if (k.startsWith('relationship[')) relKeys.add(k);

  const factors = new Map<string, number>();
  const scaled: string[] = [];
  for (const key of relKeys) {
    const extreme = Math.max(extremePathDelta(unit, key, 1), extremePathDelta(unit, key, -1));
    if (extreme > CHOICE_PATH_DELTA_CAP + 1e-9) {
      factors.set(key, CHOICE_PATH_DELTA_CAP / extreme);
      scaled.push(`${key}: ±${extreme.toFixed(2)} → ±${CHOICE_PATH_DELTA_CAP}`);
    }
  }
  if (factors.size === 0) return { unit, scaled };

  // Округляем ВНИЗ по модулю: любая сумма пути после этого строго ≤ капа,
  // без гонки с погрешностью округления на длинных путях.
  const shrink = (v: number, f: number): number => Math.sign(v) * (Math.floor(Math.abs(v) * f * 10000) / 10000);

  return {
    unit: {
      ...unit,
      nodes: unit.nodes.map(n => ({
        ...n,
        choices: n.choices.map(c => {
          const deltas = { ...c.effects.stateDeltas };
          let touched = false;
          for (const [key, f] of factors) {
            if (deltas[key] != null) {
              deltas[key] = shrink(deltas[key], f);
              touched = true;
            }
          }
          return touched ? { ...c, effects: { ...c.effects, stateDeltas: deltas } } : c;
        }),
      })),
    },
    scaled,
  };
}

// ============================================================================
// STRUCTURAL VALIDATOR (полнота диалога — структурой, не регэкспом)
// ============================================================================

/** Префиксы state-переменных движения/времени — собственность encounter-обёртки. */
const RESERVED_DELTA_PREFIXES = ['met[', 'beat[', 'evt[', 'time', 'phase'];

const isMovementDelta = (key: string): boolean =>
  key === 'slot' || RESERVED_DELTA_PREFIXES.some(p => key.startsWith(p));

const hasLiLine = (node: DialogueUnitNode, liId: string): boolean =>
  node.dialogue.some(d => d.speaker === liId && d.line.trim().length > 0);

/**
 * Структурная полнота диалогового юнита:
 *   1. entryNodeId существует; каждый choice.next ведёт в существующий узел.
 *   2. Граф узлов — DAG; каждый узел достижим из entry.
 *   3. Лист (choices=[]) обязан быть closing; closing обязан быть листом
 *      с непустой прощальной репликой liId.
 *   4. ≥1 closing-узел; каждый путь от entry достигает closing-узла за
 *      ≤DIALOGUE_UNIT_MAX_DEPTH шагов.
 *   5. farewell ведёт ТОЛЬКО в closing; ask/say/react — только в не-closing
 *      (замаскированные выходы запрещены).
 *   6. Целевой узел ask содержит непустую реплику liId (вопрос получает ответ).
 *   7. Движенческие/временные эффекты внутри юнита запрещены.
 *   8. Текст-вопрос при kind !== 'ask' — warning (рассинхрон текста и kind).
 */
export function validateDialogueUnit(unit: DialogueUnit, liId: string): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const error = (scope: string, message: string) => issues.push({ severity: 'error', scope, message });
  const warning = (scope: string, message: string) => issues.push({ severity: 'warning', scope, message });

  const nodeById = new Map(unit.nodes.map(n => [n.id, n]));

  // 1. entry + ссылки choices.
  if (!nodeById.has(unit.entryNodeId)) {
    error('entry', `entryNodeId "${unit.entryNodeId}" не найден среди узлов`);
  }
  let referencesValid = true;
  for (const node of unit.nodes) {
    for (const choice of node.choices) {
      if (!choice.next || !nodeById.has(choice.next)) {
        referencesValid = false;
        error(
          `${node.id}/choice/${choice.id}`,
          `next "${choice.next}" не найден среди узлов юнита — у каждого выбора обязателен переход внутри диалога`,
        );
      }
    }
  }

  // 3 (часть). Лист ↔ closing и прощальная реплика LI.
  const closingNodes = unit.nodes.filter(n => n.closing === true);
  for (const node of unit.nodes) {
    if (node.choices.length === 0 && node.closing !== true) {
      error(node.id, 'узел без choices обязан быть closing (обрыв диалога без прощания запрещён)');
    }
    if (node.closing === true) {
      if (node.choices.length > 0) {
        error(node.id, `closing-узел не может иметь choices (${node.choices.length} шт.) — он завершает диалог`);
      }
      if (!hasLiLine(node, liId)) {
        error(node.id, `closing-узел обязан содержать непустую прощальную реплику "${liId}"`);
      }
    }
  }

  // 4 (часть). Хотя бы один closing.
  if (closingNodes.length === 0) {
    error('closing', 'нет ни одного closing-узла — диалог не имеет выхода');
  }

  // 5. Типизированные цели выборов; 6. ask получает ответ; 7. эффекты; 8. warning.
  for (const node of unit.nodes) {
    for (const choice of node.choices) {
      const scope = `${node.id}/choice/${choice.id}`;
      const target = nodeById.get(choice.next);

      if (target) {
        if (choice.kind === 'farewell' && target.closing !== true) {
          error(scope, `farewell-выбор обязан вести в closing-узел, а "${target.id}" — не closing`);
        }
        if (choice.kind !== 'farewell' && target.closing === true) {
          error(
            scope,
            `выбор kind="${choice.kind}" ведёт в closing-узел "${target.id}" — замаскированный выход запрещён, к прощанию ведёт только farewell`,
          );
        }
        if (choice.kind === 'ask' && !hasLiLine(target, liId)) {
          error(scope, `ask-выбор ведёт в узел "${target.id}" без реплики "${liId}" — вопрос обязан получить ответ`);
        }
      }

      for (const key of Object.keys(choice.effects.stateDeltas)) {
        if (isMovementDelta(key)) {
          error(scope, `эффект перемещения/времени "${key}" внутри диалога запрещён — им владеет encounter-обёртка`);
        }
      }

      if (isQuestionChoice(choice.text) && choice.kind !== 'ask') {
        warning(
          scope,
          `текст "${choice.text}" читается как вопрос, но kind="${choice.kind}" — рассинхрон текста и kind`,
        );
      }
    }
  }

  // 2 + 4. Графовые проверки имеют смысл только при валидных ссылках и entry.
  if (!referencesValid || !nodeById.has(unit.entryNodeId)) return issues;

  // DAG: итеративный DFS с раскраской (white/gray/black).
  const color = new Map<string, 0 | 1 | 2>();
  let cyclic = false;
  const dfs = (startId: string) => {
    const stack: { id: string; childIdx: number }[] = [{ id: startId, childIdx: 0 }];
    color.set(startId, 1);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const node = nodeById.get(frame.id)!;
      if (frame.childIdx < node.choices.length) {
        const nextId = node.choices[frame.childIdx++].next;
        const c = color.get(nextId) ?? 0;
        if (c === 1) {
          cyclic = true;
          error('graph', `цикл в графе диалога через узел "${nextId}" — граф обязан быть DAG`);
          return;
        }
        if (c === 0) {
          color.set(nextId, 1);
          stack.push({ id: nextId, childIdx: 0 });
        }
      } else {
        color.set(frame.id, 2);
        stack.pop();
      }
    }
  };
  dfs(unit.entryNodeId);
  if (cyclic) return issues;

  // Достижимость каждого узла из entry (DFS выше покрасил достижимые).
  for (const node of unit.nodes) {
    if ((color.get(node.id) ?? 0) === 0) {
      error(node.id, `узел "${node.id}" недостижим из entry "${unit.entryNodeId}"`);
    }
  }

  // Глубина: DAG + правило «лист = closing» гарантируют, что каждый путь
  // завершается closing-узлом; остаётся проверить границу глубины. Считаем
  // самый длинный путь (в рёбрах) от entry мемоизированным DFS по DAG.
  const depthMemo = new Map<string, number>();
  const longestFrom = (id: string): number => {
    const memo = depthMemo.get(id);
    if (memo != null) return memo;
    const node = nodeById.get(id)!;
    let best = 0;
    for (const c of node.choices) best = Math.max(best, 1 + longestFrom(c.next));
    depthMemo.set(id, best);
    return best;
  };
  const maxDepth = longestFrom(unit.entryNodeId);
  if (maxDepth > DIALOGUE_UNIT_MAX_DEPTH) {
    error('depth', `самый длинный путь от entry — ${maxDepth} шагов, допускается ≤${DIALOGUE_UNIT_MAX_DEPTH}`);
  }

  // Анти-гринд: сколько отношений можно взять за ОДИН присест.
  //
  // Клампа на отдельную дельту мало — путь из 5 выборов по +0.1 даёт +0.5 и
  // перепрыгивает ступень лестницы за один разговор, ровно тот скачок, который
  // мы чиним. Считаем экстремальные суммы по всем путям entry→closing тем же
  // мемоизированным DFS (DAG, так что это линейно), отдельно на каждую
  // relationship-переменную и отдельно вверх/вниз: холодный путь ограничиваем
  // симметрично, иначе одна злая ветка утопит арку ниже дна восстановления.
  const relKeys = new Set<string>();
  for (const n of unit.nodes)
    for (const c of n.choices)
      for (const k of Object.keys(c.effects.stateDeltas)) {
        if (k.startsWith('relationship[')) relKeys.add(k);
      }
  for (const key of relKeys) {
    for (const dir of [1, -1] as const) {
      const memo = new Map<string, number>();
      // Лучшая (для направления dir) сумма от узла до любого closing.
      const bestFrom = (id: string): number => {
        const m = memo.get(id);
        if (m != null) return m;
        const node = nodeById.get(id)!;
        let best = 0;
        for (const c of node.choices) {
          const step = (c.effects.stateDeltas[key] ?? 0) * dir;
          best = Math.max(best, step + bestFrom(c.next));
        }
        memo.set(id, best);
        return best;
      };
      const extreme = bestFrom(unit.entryNodeId);
      if (extreme > CHOICE_PATH_DELTA_CAP + 1e-9) {
        error(
          'deltas',
          `путь через диалог даёт ${dir > 0 ? '+' : '−'}${extreme.toFixed(
            2,
          )} по "${key}" — за один разговор допускается не больше ±${CHOICE_PATH_DELTA_CAP}, иначе ступень отношений берётся с наскока`,
        );
      }
    }
  }

  return issues;
}

// ============================================================================
// ЛИНТЫ ПРОЗЫ: время суток и структура прощания
// ============================================================================

/**
 * Границы слова для кириллицы.
 *
 * `\b` в JS считает словом только [A-Za-z0-9_], поэтому с русским текстом он
 * молча не совпадает НИКОГДА — линт был бы вечно зелёным (поймано тестом).
 * Lookaround по \p{L} с флагом u — единственный рабочий вариант; без границ
 * вовсе нельзя: «пока» нашлось бы внутри «показать».
 */
const word = (...alts: string[]): RegExp => new RegExp(`(?<!\\p{L})(?:${alts.join('|')})(?!\\p{L})`, 'iu');

/** ё→е перед матчингом: LLM пишет «днем», паттерн — «днём»; иначе гэп. */
const deyo = (s: string): string => s.replace(/ё/g, 'е');

/**
 * Маркеры времени суток — ТОЛЬКО фразы, приколачивающие СЦЕНУ к части дня
 * (приветствия, «сегодня/этим X»). Голых наречий «утром/днём/вечером/ночью»
 * здесь намеренно нет: «Я утром видела тебя в библиотеке» — воспоминание, а не
 * привязка сцены, и линт кормит ретраи — ложное срабатывание жжёт деньги. Тот
 * же принцип, по которому из прощаний убрано голое «пока».
 */
const TIME_OF_DAY_MARKERS: { re: RegExp; daypart: string }[] = [
  { re: word('доброе утро', 'с добрым утром', 'сегодня утром', 'этим утром'), daypart: 'утро' },
  { re: word('добрый день', 'сегодня днем', 'этим днем'), daypart: 'день' },
  { re: word('добрый вечер', 'сегодня вечером', 'этим вечером'), daypart: 'вечер' },
  { re: word('доброй ночи', 'спокойной ночи'), daypart: 'ночь' },
];

/**
 * Прощальные маркеры: их место — в farewell, а не в теле ступени.
 *
 * Только ОДНОЗНАЧНЫЕ. Голого «пока» здесь нет намеренно: «пока не знаю, что
 * думать» — не прощание, а линт кормит ретраи, то есть ложное срабатывание
 * сжигает деньги на хорошей прозе. Пропущенное «Пока!» — косметика; ложная
 * отбраковка — счёт.
 */
const FAREWELL_MARKERS = word('до встречи', 'до завтра', 'до скорого', 'увидимся', 'прощай', 'спасибо за разговор');

const unitLines = (unit: DialogueUnit): { nodeId: string; text: string }[] =>
  unit.nodes.flatMap(n => [
    ...n.dialogue.map(d => ({ nodeId: n.id, text: d.line })),
    { nodeId: n.id, text: n.narration ?? '' },
  ]);

/**
 * Проза не должна врать про время суток.
 *
 * Живой плейтест: Асель говорит «Доброе утро» в ДЕНЬ 1 · ВЕЧЕР. Окно юнита
 * шире одной части дня, а приветствие приколачивает сцену к одной — в половине
 * слотов окна она становится ложью. Дайпарты окна даёт вызывающий (он же знает
 * календарь), здесь — чистая проверка текста против них.
 */
export function lintTimeOfDay(unit: DialogueUnit, windowDayparts: string[]): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const allowed = new Set(windowDayparts);
  const ambiguous = allowed.size > 1;

  for (const { nodeId, text } of unitLines(unit)) {
    if (!text.trim()) continue;
    const norm = deyo(text);
    for (const m of TIME_OF_DAY_MARKERS) {
      if (!m.re.test(norm)) continue;
      if (ambiguous) {
        issues.push({
          severity: 'error',
          scope: `timeOfDay/${nodeId}`,
          message: `"${text.trim().slice(0, 60)}" привязывает сцену к времени суток, но окно встречи покрывает ${[
            ...allowed,
          ].join('/')} — в остальных случаях реплика станет ложью. Пиши время-нейтрально.`,
        });
      } else if (!allowed.has(m.daypart)) {
        issues.push({
          severity: 'error',
          scope: `timeOfDay/${nodeId}`,
          message: `"${text.trim().slice(0, 60)}" — это ${m.daypart}, а встреча идёт в «${[...allowed].join('')}».`,
        });
      }
      break;
    }
  }
  return issues;
}

/**
 * Прощание — не конец ступени; конец ступени — пауза.
 *
 * Живой плейтест: Асель говорит «Спасибо за разговор. Надеюсь, скоро увидимся»,
 * а следом узел сообщает «Асель не спешит уходить» — она попрощалась и не ушла.
 * Причина структурная: у посиделки есть продолжение, и прощальная реплика в
 * теле ступени звучит раньше, чем игрок решил уйти. Тело обязано кончаться
 * точкой выдоха; прощание живёт в отдельном поле и играется при реальном уходе.
 */
export function lintFarewellInBody(unit: DialogueUnit): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  for (const node of unit.nodes) {
    for (const d of node.dialogue) {
      if (!FAREWELL_MARKERS.test(deyo(d.line))) continue;
      issues.push({
        severity: 'error',
        scope: `farewell/${node.id}`,
        message: `реплика "${d.line
          .trim()
          .slice(
            0,
            60,
          )}" прощается прямо в теле разговора — а разговор может продолжиться, и персонаж окажется попрощавшимся, но не ушедшим. Финальная нода — естественная ПАУЗА; прощальные слова верни в поле farewell.`,
      });
      break;
    }
  }
  return issues;
}
