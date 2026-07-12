import type { DialogueLine, DialogueVariantBracket, SegmentIssue, StateVarPath } from './types';
import { isQuestionChoice } from './types';

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
};

/** Каждый путь от entry обязан достигать closing-узла не глубже этого. */
export const DIALOGUE_UNIT_MAX_DEPTH = 12;

// ============================================================================
// PARSER (LLM JSON → DialogueUnit; в стиле parseDialogueVariant)
// ============================================================================

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : []);

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
                stateDeltas: (effects.stateDeltas ?? {}) as Record<StateVarPath, number>,
                flagSet: asStringArray(effects.flagSet),
                flagClear: asStringArray(effects.flagClear),
              },
            };
          })
        : [],
      ...(node.closing != null ? { closing: Boolean(node.closing) } : {}),
    };
  });

  return {
    id: String(obj.id ?? ''),
    liId: String(obj.liId ?? ''),
    bracket,
    entryNodeId: String(obj.entryNodeId),
    nodes,
  };
}

// ============================================================================
// STRUCTURAL VALIDATOR (полнота диалога — структурой, не регэкспом)
// ============================================================================

/** Префиксы state-переменных движения/времени — собственность encounter-обёртки. */
const RESERVED_DELTA_PREFIXES = ['met[', 'beat[', 'evt[', 'time'];

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

  return issues;
}
