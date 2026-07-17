import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from './logger.js';

// ────────────────────────────────────────────────────────────────────────────
// Tier-раскладка моделей по стадиям (docs/plans/calendar-branching.md, фаза 7).
// A — ответственные проходы (хребет, каст, критик листьев), B — структурный
// JSON среднего объёма, C — массовая проза. Провайдер — только OpenAI.
// Переопределение: TEXTGEN_MODEL_<STAGE> (точечно) или TEXTGEN_MODEL_TIER_<A|B|C>.
// Дефолты сохраняют текущее поведение (gpt-4.1-mini везде).
// ────────────────────────────────────────────────────────────────────────────

export type StageId =
  | 'storyMasterPrompt'
  | 'sceneText'
  | 'castPlan'
  | 'eventPool'
  | 'worldCalendar'
  | 'spine'
  | 'anchorBeat'
  | 'ending'
  | 'dialogueUnit'
  | 'dialogueQA'
  | 'storyLeafQA'
  | 'anchorTransition';

type Tier = 'A' | 'B' | 'C';

const STAGE_TIER: Record<StageId, Tier> = {
  storyMasterPrompt: 'C',
  sceneText: 'C',
  castPlan: 'A',
  eventPool: 'B',
  worldCalendar: 'B',
  spine: 'A',
  anchorBeat: 'B',
  ending: 'B',
  dialogueUnit: 'C',
  dialogueQA: 'B',
  storyLeafQA: 'A',
  // Один вызов на историю, три коротких перехода — самый дешёвый tier.
  anchorTransition: 'C',
};

const DEFAULT_TIER_MODEL: Record<Tier, string> = {
  A: 'gpt-4.1-mini',
  B: 'gpt-4.1-mini',
  C: 'gpt-4.1-mini',
};

export function resolveModelId(stage: StageId): string {
  const explicit = process.env[`TEXTGEN_MODEL_${stage.toUpperCase()}`];
  const tier = STAGE_TIER[stage];
  return explicit ?? process.env[`TEXTGEN_MODEL_TIER_${tier}`] ?? DEFAULT_TIER_MODEL[tier];
}

function resolveModel(stage: StageId) {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const id = resolveModelId(stage);
  logger.log(`[model] ${stage} → ${id} (tier ${STAGE_TIER[stage]})`);
  return openai(id);
}
import type {
  BatchState,
  StoryMasterPromptRequest,
  SceneTextRequest,
  WorldCalendarRequest,
  CastPlanRequest,
  EventPoolRequest,
  SpineRequest,
  AnchorBeatRequest,
  AnchorTransitionRequest,
  DialogueUnitRequest,
  DialogueQARequest,
  StoryLeafQARequest,
  EndingRequest,
} from './types.js';

const SYSTEM_PROMPT = `Ты — опытный сценарист интерактивных визуальных новелл. Твоя задача — создать детальный костяк истории, который станет основой для разработки визуальной новеллы.

Сгенерируй структурированное описание истории, включающее следующие разделы:

## Мир
Опиши сеттинг: место, время, ключевые особенности мира. Что делает этот мир уникальным и интересным для игрока?

## Центральный конфликт
Какая главная проблема или противоречие движет сюжетом? Почему игроку будет интересно в это погрузиться?

## Персонажи
Для каждого ключевого персонажа укажи:
- Имя и краткое описание внешности
- Характер и мотивация
- Роль в истории
- Отношения с другими персонажами

## Сюжетные линии
Опиши 2-3 основные сюжетные ветки, которые может пройти игрок. Для каждой ветки укажи ключевые точки принятия решений.

## Тон и атмосфера
Какое настроение должна создавать новелла? Какие эмоции должен испытывать игрок?

Пиши кратко, но содержательно. Каждый раздел — 3-5 предложений. Общий объём — не более 2000 символов.`;

export async function processStoryMasterPrompt(
  batch: BatchState,
  body: StoryMasterPromptRequest,
): Promise<void> {
  const itemId = 'storyMasterPrompt';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const openai = createOpenAI({ apiKey });

    const userMessage = body.userHint?.trim()
      ? `Сгенерируй костяк истории для визуальной новеллы.\n\nПожелания автора: ${body.userHint.trim()}`
      : 'Сгенерируй костяк истории для визуальной новеллы.';

    logger.log(`[storyMasterPrompt] batch=${batch.batchId} — generating...`);

    const { text } = await generateText({
      model: resolveModel('storyMasterPrompt'),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
    });

    item.status = 'completed';
    item.result = text;
    logger.log(`[storyMasterPrompt] batch=${batch.batchId} — completed (${text.length} chars)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[storyMasterPrompt] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

function getActGuidance(depth: number, maxDepth: number): string {
  if (maxDepth <= 0) maxDepth = 10;
  const remaining = maxDepth - depth;
  const progress = depth / maxDepth;

  if (progress <= 0.2) {
    return `Сцена ${depth + 1} из ${maxDepth}. Осталось сцен: ${remaining}.
Начало истории. Покажи мир и обстоятельства, в которых оказался игрок. Намекни на проблему, но не раскрывай всё сразу.
Количество выходов: 2.`;
  }
  if (progress <= 0.4) {
    return `Сцена ${depth + 1} из ${maxDepth}. Осталось сцен: ${remaining}.
Развитие. Конфликт обозначен, появляются препятствия. Игрок начинает понимать, с чем столкнулся. Введи напряжение.
Количество выходов: 3.`;
  }
  if (progress <= 0.6) {
    return `Сцена ${depth + 1} из ${maxDepth}. Осталось сцен: ${remaining}.
Середина истории. Ставки растут, ситуация усложняется. Решения игрока начинают иметь серьёзные последствия. Не затягивай — впереди кульминация.
Количество выходов: 3.`;
  }
  if (progress <= 0.8) {
    return `Сцена ${depth + 1} из ${maxDepth}. Осталось сцен: ${remaining}.
Приближение к кульминации. Напряжение на пике, все нити сюжета сходятся. Выборы должны быть судьбоносными — каждый ведёт к разному финалу.
Количество выходов: 2.`;
  }
  if (remaining > 0) {
    return `Сцена ${depth + 1} из ${maxDepth}. Осталось сцен: ${remaining}. Это ПРЕДПОСЛЕДНЯЯ сцена.
Кульминация. Главное противостояние, момент истины. Покажи развязку основного конфликта. Следующая сцена — финал.
Количество выходов: 2.`;
  }
  return `Сцена ${depth + 1} из ${maxDepth}. Это ПОСЛЕДНЯЯ сцена.
Финал. Подведи итоги, покажи последствия выборов игрока. Дай ощущение завершённости. Больше сцен не будет.
Количество выходов: 0. Массив outputs ДОЛЖЕН быть пустым [].`;
}

const SCENE_SYSTEM_PROMPT = `Ты — опытный сценарист интерактивных визуальных новелл. Ты пишешь историю с ФИКСИРОВАННОЙ длиной. История ОБЯЗАНА уложиться в заданное количество сцен и прийти к завершению.

Правила:
1. Пиши от второго лица ("Ты входишь...", "Перед тобой...").
2. Текст сцены: 3–6 предложений. Описывай обстановку, действия, диалоги. Будь конкретен и образен.
3. Варианты выхода (outputs): короткие варианты действий для игрока. Каждый выход — одна фраза (до 10 слов).
4. Каждый выбор должен вести историю в разном направлении.
5. Используй ТОЛЬКО персонажей, указанных в мастер-промте или в списке персонажей сцены. НЕ выдумывай новых персонажей, которых нет в этих источниках.
6. Количество выходов (outputs) задаётся в инструкции к сцене. Следуй ему СТРОГО. Если указано 0 — массив outputs ДОЛЖЕН быть пустым [].

ВАЖНО: Ответ СТРОГО в JSON формате, без markdown-обёртки, без \`\`\`json:
{"sceneText": "...", "outputs": ["...", ...]}`;

export async function processSceneText(
  batch: BatchState,
  body: SceneTextRequest,
): Promise<void> {
  const itemId = 'sceneText';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const openai = createOpenAI({ apiKey });

    const actGuidance = getActGuidance(body.depth, body.maxDepth);

    const parts: string[] = [];

    if (body.storyMasterPrompt) {
      parts.push(`## Мастер-промпт истории\n${body.storyMasterPrompt}`);
    }

    parts.push(`## Актовая структура\n${actGuidance}`);

    if (body.characters && body.characters.length > 0) {
      const charList = body.characters
        .map(c => {
          let entry = `- ${c.name}`;
          if (c.description) entry += `: ${c.description}`;
          return entry;
        })
        .join('\n');
      parts.push(`## Персонажи в этой сцене\n${charList}`);
    }

    if (body.sceneChain.length > 0) {
      const chainText = body.sceneChain
        .map((s, i) => {
          let entry = `Сцена ${i + 1}: ${s.sceneText}`;
          if (s.outputText) entry += `\nИгрок выбрал: "${s.outputText}"`;
          return entry;
        })
        .join('\n\n');
      parts.push(`## Предыдущие сцены\n${chainText}`);
    }

    if (body.incomingOutputText) {
      parts.push(`## Выбор, который привёл к этой сцене\nИгрок выбрал: "${body.incomingOutputText}"`);
    }

    parts.push('Напиши следующую сцену. Следуй указанному количеству выходов.');

    const userMessage = parts.join('\n\n');

    logger.log(`[sceneText] batch=${batch.batchId} depth=${body.depth}/${body.maxDepth} chain=${body.sceneChain.length} — generating...`);

    const { text } = await generateText({
      model: resolveModel('sceneText'),
      system: SCENE_SYSTEM_PROMPT,
      prompt: userMessage,
    });

    // Validate JSON
    const parsed = JSON.parse(text);
    if (!parsed.sceneText || !Array.isArray(parsed.outputs)) {
      throw new Error('Invalid response format: missing sceneText or outputs');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[sceneText] batch=${batch.batchId} — completed (${text.length} chars)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[sceneText] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// OUTLINE GENERATION
// ============================================================================

const CAST_PLAN_SYSTEM_PROMPT = `Ты — планировщик персонажей романтической визуальной новеллы (romance VN) с календарным временем.

Получаешь:
  1. Бриф (brief) — мир, тон, каст love interests (LI) с архетипами.
  2. Профили архетипов (archetypeProfiles) — для каждого использованного archetypeId.
  3. targets.arcStageCount (N) — сколько ступеней близости в лестнице этой истории.

Твоя задача — АГЕНДА каждого LI: ЛЕСТНИЦА близости (цель на каждую ступень) +
weekly-паттерн «где персонаж обычно бывает» по абстрактным тегам локаций.
Конкретных локаций ещё нет — их создаст следующая стадия по твоим тегам.

Про лестницу. Отношения растут ступенями, и соседние ступени обязаны быть
БЛИЗКИ друг к другу: между «впервые перекинулись словом» и «делюсь сокровенным»
не бывает одного шага. Ступень — это маленький сдвиг в том, как персонаж себя
ведёт с героиней: чуть меньше дистанции, чуть больше личного, чуть выше цена
откровенности. Ступени, отстоящие далеко, и дают ощущение «мы только
познакомились, а у нас уже роман».

Жёсткие правила:
  1. members — ровно по одной записи на КАЖДОГО LI брифа; id ОБЯЗАН посимвольно
     совпадать с id LI из брифа. Никаких лишних и никаких пропущенных персонажей.
  2. isLI: true у всех (стадия описывает только LI).
  3. goals — РОВНО N целей (по числу targets.arcStageCount), по одной на каждую
     ступень: arcStage 1, 2, … N — без пропусков и без повторов.
       ступень 1 — первый контакт: персонаж ещё держит дистанцию;
       средние ступени — ПОСТЕПЕННОЕ сближение: каждая следующая на шаг ближе
         предыдущей (общий интерес → привычка общаться → мелкая личная деталь →
         настоящее доверие → уязвимость). Не перепрыгивай: соседние ступени
         должны читаться как соседние;
       ступень N — вершина арки: признание/выбор/разрешение конфликта.
     description — 1 конкретное предложение по-русски: как выглядит ИМЕННО ЭТА
     ступень близости для ИМЕННО ЭТОГО персонажа (его характер, роль в мире,
     архетип). У разных персонажей одна и та же ступень выглядит по-разному:
     замкнутый и дерзкий «открываются» не одинаково.
     id цели — snake_case ("kira_open_up").
  3a. idealRelationship — 1 предложение: какие отношения ЭТОТ персонаж считает
      для себя идеальными (его словами, из его характера — не общий штамп).
      worstRelationship — 1 предложение: какой исход для него худший.
      Это не украшение: по ним пишутся концовки и тон поздних ступеней.
  4. weeklyPattern — объект с ключами-частями дня РОВНО "утро", "день", "вечер".
     Значение — 1-3 взвешенных тега: [{ "tag": "workplace", "weight": 2 }].
     weight — целое ≥ 1 (больше = чаще там бывает). Каждая из трёх частей дня
     ОБЯЗАНА иметь хотя бы одну запись.
  5. locationTags — 3-5 АБСТРАКТНЫХ тегов на персонажа (snake_case:
     "workplace", "hangout", "home", "training_ground"...) с описанием
     по-русски (1 фраза: что это за место для этого персонажа). КАЖДЫЙ тег,
     использованный в weeklyPattern, обязан быть ключом locationTags.
     Теги отражают роль персонажа (roleInWorld) и его характер.
  6. Все тексты — по-русски (кроме id и тегов).

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json.
Пример структуры для N = 5 (число целей ВСЕГДА равно targets.arcStageCount —
в примере их пять, но бери N из запроса). Обрати внимание на шаг между
соседними ступенями: каждая — маленький сдвиг, а не новая глава.
{
  "members": [
    {
      "id": "kira",
      "isLI": true,
      "agenda": {
        "idealRelationship": "Кто-то, кто спорит с ней на равных и не уходит, когда она язвит.",
        "worstRelationship": "Вежливое приятельство, где её так и не приняли всерьёз.",
        "goals": [
          { "id": "kira_first_contact", "description": "Обменяться колкостями у стеллажей и запомниться.", "arcStage": 1 },
          { "id": "kira_shared_interest", "description": "Обнаружить, что героиня читала ту же спорную книгу, и втянуться в спор.", "arcStage": 2 },
          { "id": "kira_habit", "description": "Начать придерживать для героини место в читальном зале, не признаваясь зачем.", "arcStage": 3 },
          { "id": "kira_open_up", "description": "Показать героине черновики своих переводов — то, что не показывала никому.", "arcStage": 4 },
          { "id": "kira_confession", "description": "Решиться на признание на вечернем фестивале.", "arcStage": 5 }
        ],
        "weeklyPattern": {
          "утро": [{ "tag": "workplace", "weight": 2 }],
          "день": [{ "tag": "workplace", "weight": 1 }, { "tag": "hangout", "weight": 1 }],
          "вечер": [{ "tag": "hangout", "weight": 2 }, { "tag": "home", "weight": 1 }]
        },
        "locationTags": {
          "workplace": "библиотека, где Кира подрабатывает",
          "hangout": "кафе и аллеи кампуса, где она отдыхает",
          "home": "её комната в общежитии"
        }
      }
    }
  ]
}`;

export async function processCastPlan(batch: BatchState, body: CastPlanRequest): Promise<void> {
  const itemId = 'castPlan';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Профили архетипов (для контекста персонажей)\n${JSON.stringify(body.archetypeProfiles, null, 2)}`,
      `## Целевые размеры\n${JSON.stringify(body.targets ?? { arcStageCount: 3 }, null, 2)}`,
    ];

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${JSON.stringify(body.previousAttempt, null, 2)}`);
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${(body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННЫЙ план каста. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Составь агенды каста (цели по стадиям арки + weekly-паттерны по тегам). Только JSON.');
    }

    logger.log(`[castPlan] batch=${batch.batchId} — generating...`);

    const { text } = await generateText({
      model: resolveModel('castPlan'),
      system: CAST_PLAN_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.members)) {
      throw new Error('Invalid response: missing members');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[castPlan] batch=${batch.batchId} — completed (${parsed.members.length} members)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[castPlan] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// EVENT POOL GENERATION (calendar pipeline, stage B2)
// ============================================================================

const EVENT_POOL_SYSTEM_PROMPT = `Ты — дизайнер событий-storylet-ов для романтической визуальной новеллы (romance VN) с календарным временем.

Получаешь:
  1. Бриф (brief) — мир, тон, протагонист.
  2. liCard — карточка ОДНОГО love interest.
  3. agenda — агенда персонажа: ЛЕСТНИЦА близости (goals с arcStage 1..N,
     description каждой — как выглядит эта ступень именно для него), плюс его
     представление об идеальных (idealRelationship) и худших (worstRelationship)
     отношениях.
  4. scheduleExcerpt — слоты, где персонаж на сцене: [{ slot, locationId }].
  5. spineBeats — биты хребта с его участием (id/summary/window) — НЕ дублируй их.
  6. calendar — slotCount, dayparts, actBoundaries.
  7. targets.unitsPerStage — целевое число юнитов на ступень.
  8. targets.arcStageCount (N) — сколько ступеней в лестнице близости.

Твоя задача — ПУЛ СОБЫТИЙ-ШЕЛЛОВ этого персонажа: guard+goal+effects БЕЗ прозы.
Проза диалога генерируется отдельно; здесь — только каркас: когда, где, зачем
и что событие меняет.

Модель времени: слот = (день, часть дня), нумерация с 0. window = {fromSlot,
toSlot} включительно — окно, в котором встреча может произойти.

Жёсткие правила:
  1. Примерно targets.unitsPerStage юнитов на КАЖДУЮ ступень 1..N — каждая
     ступень обязана быть покрыта, без пропусков: пропущенная ступень = разрыв
     в отношениях, из-за которого сцены соседних дней читаются как чужие.
  1a. Ступени упорядочены во времени: окно ступени s+1 начинается не раньше
      окна ступени s. Но окна СОСЕДНИХ ступеней МОГУТ пересекаться — это норма
      и даже желательно: если разговор пошёл хорошо, следующая ступень должна
      быть доступна сразу, а не «через день, потому что так расписано».
      Далёкие ступени (s и s+2) пересекаться не должны.
  2. id юнита — короткий snake_case ("kira_book_talk"). Без префиксов evt_ —
     их добавит клиент.
  3. arcStage — от 1 до N; goal — 1 конкретное предложение по-русски: что
     должно произойти между героями (опирайся на goal ЭТОЙ ступени из агенды,
     не копируя дословно). Шаг между соседними ступенями — маленький: чуть
     меньше дистанции, чуть больше личного. Не перепрыгивай через ступень.
  4. window обязано ЦЕЛИКОМ лежать в календаре [0, slotCount-1], fromSlot ≤ toSlot.
  5. locationId — ТОЛЬКО локация из scheduleExcerpt, причём персонаж обязан
     стоять в ней хотя бы в одном слоте окна (событие там, где он бывает).
  6. requires — флаги-предусловия (snake_case), только те, что устанавливают
     spineBeats (summary подскажет) или БОЛЕЕ РАННИЕ юниты этого пула через
     establishes. Обычно пуст. НЕ выдумывай флаги из воздуха.
  7. establishes — флаги, становящиеся истинными после события (0-2 шт).
  8. relEffects — 1-2 эффекта отношений: var из affection|trust|tension,
     delta в диапазоне -0.3..0.3 (типично ±0.05..0.15). Это ПОМЕТКА о смысле
     события для автора, а не рычаг: насколько реально сдвинутся отношения,
     считает движок (шаг лестницы + выборы игрока в диалоге) — не пытайся
     «добрать» близость дельтами.
  9. Ни цепочку ступеней (событие ступени 2 после ступени 1), ни пороги
     близости, ни «не раньше такого-то дня» в requires НЕ кодируй — всё это
     навязывает движок. В requires — только НАСТОЯЩИЕ сюжетные предусловия.
  10. timing — НЕОБЯЗАТЕЛЬНОЕ поле: когда ВНУТРИ части дня уместен разговор.
      "early" — персонаж свеж, в начале смены/пары, готов к серьёзному;
      "late"  — он вымотан, дело к концу (утешить уставшую, поймать перед
                уходом, ночной откровенный разговор — это late);
      "any"   — момент не важен.
      Выбирай ПО СМЫСЛУ цели юнита, а не по ступени. Не уверен — не указывай:
      движок подставит разумный дефолт (глубокие разговоры — на свежую голову).
  11. Все тексты — по-русски (кроме id и флагов).

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "units": [
    {
      "id": "kira_book_talk",
      "arcStage": 1,
      "goal": "Разговориться с Кирой о редкой книге и узнать её вкусы.",
      "locationId": "library",
      "window": { "fromSlot": 0, "toSlot": 4 },
      "timing": "any",
      "requires": [],
      "establishes": ["knows_kira_taste"],
      "relEffects": [{ "var": "affection", "delta": 0.1 }]
    },
    {
      "id": "kira_tired_evening",
      "arcStage": 3,
      "goal": "Застать Киру вымотанной после смены и молча посидеть рядом.",
      "locationId": "library",
      "window": { "fromSlot": 5, "toSlot": 8 },
      "timing": "late",
      "requires": [],
      "establishes": [],
      "relEffects": [{ "var": "trust", "delta": 0.1 }]
    }
  ]
}`;

export async function processEventPool(batch: BatchState, body: EventPoolRequest): Promise<void> {
  const itemId = 'eventPool';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Карточка LI\n${JSON.stringify(body.liCard, null, 2)}`,
      `## Агенда персонажа\n${JSON.stringify(body.agenda, null, 2)}`,
      `## Расписание персонажа (слоты на сцене)\n${JSON.stringify(body.scheduleExcerpt, null, 2)}`,
      `## Биты хребта с его участием (не дублировать)\n${JSON.stringify(body.spineBeats, null, 2)}`,
      `## Календарь\n${JSON.stringify(body.calendar, null, 2)}`,
      `## Целевые бюджеты\nunitsPerStage: ${body.targets.unitsPerStage} (итого 4-8 юнитов)`,
    ];

    // previousIssues без previousAttempt — легальный случай: QA-затравки
    // (мёртвые слоты симуляции, deadContent) при регенерации пула с нуля,
    // когда прежний пул уже инвалидирован каскадом от нового хребта.
    const hasFeedback = Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      if (body.previousAttempt) {
        parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${JSON.stringify(body.previousAttempt, null, 2)}`);
      }
      parts.push(
        `## ${
          body.previousAttempt ? 'ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ' : 'ЗАМЕЧАНИЯ QA К ПРОШЛОЙ ВЕРСИИ ИСТОРИИ'
        }\n${(body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nПри генерации ОБЯЗАТЕЛЬНО устрани эти проблемы (покрой мёртвые слоты юнитами, не оставляй юнитов, недостижимых при любом выборе веток).`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННЫЙ пул событий. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Сгенерируй пул событий-шеллов этого персонажа. Только JSON.');
    }

    const liId = (body.liCard as { id?: string })?.id ?? '?';
    logger.log(`[eventPool] batch=${batch.batchId} — generating li=${liId} (slots=${body.scheduleExcerpt.length})...`);

    const { text } = await generateText({
      model: resolveModel('eventPool'),
      system: EVENT_POOL_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.units)) {
      throw new Error('Invalid response: missing units');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[eventPool] batch=${batch.batchId} — completed (${parsed.units.length} units, li=${liId})`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[eventPool] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// WORLD CALENDAR GENERATION (calendar pipeline, stage A2)
// ============================================================================

const WORLD_CALENDAR_SYSTEM_PROMPT = `Ты — картограф мира и календаря романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — сеттинг, эпоха, конкретика места, каст LI.
  2. castPlan — агенды персонажей с абстрактными тегами локаций (workplace/hangout/home и т.п.), или null.
  3. Целевые размеры календаря (targets) — days, daypartsPerDay, acts.

Твоя задача — построить ТРИ артефакта одним ответом:
  А. РЕЕСТР ЛОКАЦИЙ мира со связностью (locations).
  Б. ДИСКРЕТНЫЙ КАЛЕНДАРЬ истории (calendar): дни × части дня, границы актов.
  В. МАППИНГ агендных тегов на локации (tagMap).

Жёсткие правила для locations:
  1. 6-10 локаций. Каждая: id (короткий snake_case: "library", "campus_alley"),
     name (по-русски), description (2-3 предложения, СТАБИЛЬНОЕ описание места —
     его будут использовать все генераторы сцен), pointsOfInterest (2-4 ключевые
     точки: "стол у окна", "стеллажи у входа").
  2. adjacent — физическая связность: из какой локации в какую можно пройти
     и КАК ("via": "через аллею кампуса", "по коридору второго этажа").
     Мир должен быть СВЯЗНЫМ: из любой локации в любую существует путь по
     adjacency. Добавляй промежуточные "транзитные" локации (аллея, коридор,
     двор), если они нужны для естественных путей.
  3. mood — доминирующее НАСТРОЕНИЕ локации (для подбора фоновой музыки-эмбиента).
     Ровно одно значение из фиксированного набора:
       neutral_calm (нейтральная/спокойная), cheerful_warm (весёлая/тёплая),
       cozy_tender (уютная/нежная), romantic (романтическая),
       melancholic_sad (грустная/меланхоличная), wistful_nostalgic (ностальгическая),
       tense_anxious (тревожная/напряжённая), ominous_mysterious (зловещая/таинственная),
       tragic_heavy (трагическая/тяжёлая).
     Выбирай по атмосфере места и его роли в сюжете (дождливый пустой универ → melancholic_sad,
     тёплое кафе свиданий → cozy_tender). Если сомневаешься — neutral_calm.
  4. specialKind — ТОЛЬКО для локаций с характерным собственным звуком; одно из:
     bar_tavern, party_club, sports_stadium, market_street, ceremony. Для обычных
     локаций поле опусти или поставь null.

Жёсткие правила для calendar:
  5. days, число элементов dayparts и число элементов actBoundaries обязаны
     ТОЧНО совпадать с targets (days, daypartsPerDay, acts) из сообщения —
     не придумывай свои размеры.
  6. dayparts — названия частей дня по-русски (обычно "утро", "день", "вечер").
  7. actBoundaries — день начала каждого акта: длина = число актов,
     первый элемент всегда 0, значения СТРОГО возрастают, каждое < days.
  8. specialDays (опционально) — 0-2 особых дня (фестиваль, экзамен, гроза):
     колорит для сцен, day в диапазоне [0, days-1].

Жёсткие правила для tagMap:
  9. КАЖДЫЙ тег из агенд castPlan (ключи locationTags и теги weeklyPattern)
     обязан быть ключом tagMap и вести к МИНИМУМ ОДНОЙ локации (массив id из
     locations). Один тег может вести к нескольким локациям.
  10. Если castPlan = null — выдай tagMap для базовых тегов workplace/hangout/home.
  11. Все тексты — по-русски (кроме id).

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "locations": [
    {
      "id": "library",
      "name": "университетская библиотека",
      "description": "Просторный зал с рядами стеллажей до потолка...",
      "pointsOfInterest": ["стол у окна", "стеллажи у входа"],
      "adjacent": [{ "locationId": "campus_alley", "via": "через главные двери на аллею" }],
      "mood": "melancholic_sad",
      "specialKind": null
    }
  ],
  "calendar": {
    "days": 4,
    "dayparts": ["утро", "день", "вечер"],
    "actBoundaries": [0, 1, 2, 3],
    "specialDays": [{ "day": 2, "label": "осенний фестиваль" }]
  },
  "tagMap": {
    "workplace": ["library"],
    "hangout": ["campus_cafe", "campus_alley"],
    "home": ["dorm_room"]
  }
}`;

export async function processWorldCalendar(batch: BatchState, body: WorldCalendarRequest): Promise<void> {
  const itemId = 'worldCalendar';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Агенды персонажей (castPlan)\n${body.castPlan ? JSON.stringify(body.castPlan, null, 2) : 'null'}`,
      `## Целевые размеры календаря (соблюдать ТОЧНО)\ndays: ${body.targets.days}\ndaypartsPerDay (длина dayparts): ${body.targets.daypartsPerDay}\nslotCount (days × daypartsPerDay): ${body.targets.slotCount}\nacts (длина actBoundaries): ${body.targets.acts}`,
    ];

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${JSON.stringify(body.previousAttempt, null, 2)}`);
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${(body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННЫЕ мир, календарь и маппинг тегов. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Построй мир, календарь и маппинг тегов. Только JSON.');
    }

    logger.log(`[worldCalendar] batch=${batch.batchId} — mapping world+calendar (days=${body.targets.days}, acts=${body.targets.acts})...`);

    const { text } = await generateText({
      model: resolveModel('worldCalendar'),
      system: WORLD_CALENDAR_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.locations) || !parsed.calendar || !parsed.tagMap) {
      throw new Error('Invalid response: missing locations, calendar or tagMap');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(
      `[worldCalendar] batch=${batch.batchId} — completed (${parsed.locations.length} locations, ${parsed.calendar.days} days)`,
    );
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[worldCalendar] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// SPINE GENERATION (calendar pipeline, stage A3)
// ============================================================================

const SPINE_SYSTEM_PROMPT = `Ты — архитектор сюжетного хребта романтической визуальной новеллы (romance VN) с календарным временем.

Получаешь:
  1. Бриф (brief) — мир, тон, каст LI, профиль концовок (endingsProfile).
  2. Модель мира (worldModel) — реестр локаций с id.
  3. Календарь (calendar) — дни × части дня, границы актов.
  4. Маппинг тегов (tagMap) — где персонажи обычно бывают.
  5. Целевые бюджеты (targets) — число битов, лимит развилок.

Модель времени:
  - Слот = (день, часть дня): slot = day × daypartsPerDay + daypartIndex.
    Нумерация с 0: день 0 утро = слот 0, день 0 день = слот 1, и т.д.
  - Бит НЕ пришпилен к слоту — он несёт ОКНО {fromSlot, toSlot} (включительно),
    внутри которого может произойти. Точный слот назначит планировщик.

Твоя задача — хребет истории: биты (beats) с окнами слотов и концовки (endings).

Жёсткие правила:
  1. Число битов — ровно targets.beatCount (допустимо ±1), ВКЛЮЧАЯ развилки
     и ветвовые биты.
  2. kind каждого бита: "beat" (рядовое событие), "branchPoint" (глобальная
     развилка сюжета), "actGate" (переход акта, ставит ключевой флаг) или
     "finale" (кульминация).
  2a. Развилки: ровно targets.branchPointBudget битов kind="branchPoint"
      (при 0 — ни одного). У каждой развилки поле outcomes — 2-3 исхода:
      [{id, label, setsFlag, summary}], где label — текст ВЫБОРА ИГРОКА в
      сцене развилки, setsFlag — snake_case спайн-флаг ветки (уникален среди
      всех флагов), summary — 1 предложение о последствиях исхода.
      У branchPoint поле establishes — общие флаги (ставятся при ЛЮБОМ
      исходе); ветвовые флаги живут только в outcomes.
  2b. Развилка НЕ может быть в последнем акте и НЕ может быть финалом —
      игрок должен успеть увидеть последствия выбора.
  2c. Ветвовые биты: бит МОЖЕТ требовать (requires) флаг исхода развилки —
      такой бит играется только на этой ветке. Биты, не требующие ни одного
      флага исходов, общие для всех веток. На каждый исход дай 1-3 ветвовых
      бита в последующих актах — ветки обязаны ощущаться по-разному.
  2e. ЛОКАЦИИ ВЕТВЕЙ — ЖЁСТКОЕ ПРАВИЛО, НАРУШЕНИЕ ЛОМАЕТ СБОРКУ.
      Биты разных исходов ОДНОЙ развилки никогда не встречаются в одном
      прохождении, поэтому планировщик кладёт их в ОДИН слот — ветка не
      удлиняет историю. Но только если у них ОДНА И ТА ЖЕ locationId: в слоте
      персонаж стоит ровно в одном месте, и развести такие биты по разным
      локациям — значит потребовать по отдельному слоту на каждый. Слотов в
      акте всего ~3, и акт переполняется: хребет НЕ СОБЕРЁТСЯ.
      ПРАВИЛО: у ВСЕХ ветвовых битов одной развилки — ОДНА locationId. Это
      относится к КАЖДОЙ развилке, а не к одной из них. От ветки к ветке
      меняется смысл сцены, а не место.
      ПРАВИЛЬНО:
        {"id":"asel_duty",   "locationId":"seminar_room","requires":["asel_chose_duty"]}
        {"id":"asel_freedom","locationId":"seminar_room","requires":["asel_chose_freedom"]}
      НЕПРАВИЛЬНО (акт переполнится):
        {"id":"asel_duty",   "locationId":"seminar_room","requires":["asel_chose_duty"]}
        {"id":"asel_freedom","locationId":"dormitory",   "requires":["asel_chose_freedom"]}
      Разные локации допустимы, ТОЛЬКО если у битов нет общих участников.
  2d. Концовки ДОЛЖНЫ различаться по веткам: где это осмысленно сюжетно,
      дай минимум по одной концовке, требующей (requires) флаги конкретной
      терминальной комбинации веток. КАЖДАЯ комбинация исходов обязана иметь
      хотя бы одну выполнимую концовку (флаги которой достижимы на этой ветке).
  3. Ровно ОДИН бит kind="finale": в последнем акте, window.toSlot = последний
     слот календаря (кульминация закрывает историю). Финал ОБЩИЙ и
     БЕЗУСЛОВНЫЙ: requires финала — ПУСТОЙ массив []. Игрок ходит по локациям
     сам и мог пропустить любой бит, поэтому ЛЮБОЙ флаг в requires финала
     (не только флаги исходов развилок) делает финал недостижимым для части
     игроков. Различия веток и судеб выражай в requires КОНЦОВОК, не финала.
     participants финала — ВСЕ LI брифа: финал сводит героев в одну локацию.
  4. Окно каждого бита обязано ЦЕЛИКОМ лежать в диапазоне слотов его акта
     (границы актов в слотах даны в сообщении). fromSlot ≤ toSlot.
  5. Окна не должны быть пережаты: каждому биту должен доставаться свой слот
     (не назначай десяти битам одно и то же окно из двух слотов).
  6. Флаговая логика: establishes — флаги, становящиеся истинными ПОСЛЕ бита
     (snake_case: "met_kira", "secret_revealed"); requires — флаги, обязательные
     для допуска бита. КАЖДЫЙ флаг из requires обязан устанавливаться битом
     с БОЛЕЕ РАННИМ окном (никаких требований в будущее, никаких циклов).
  7. participants — ТОЛЬКО реальные id LI из брифа. Пустой массив = чисто
     сюжетный бит без LI. Каждый LI должен участвовать минимум в 2 битах.
  7a. Порядок битов одного LI движок навязывает САМ (бит не сыграет, пока не
      сыгран предыдущий бит этого же LI), поэтому в requires НЕ нужно дублировать
      последовательность — там только НАСТОЯЩИЕ межарочные зависимости
      (например, бит Киры требует флаг из линии Юки).
  7b. Знакомство с LI — это обычная встреча по расписанию, а НЕ бит хребта:
      движок гейтит первый бит LI на разговор с ним. Поэтому биты пишутся из
      предпосылки «герои уже знакомы», и близость обязана расти по порядку:
      сначала сближение, потом откровенность и признания. Не ставь интимную
      сцену (признание, исповедь, объяснение в чувствах) первым битом LI.
  8. locationId каждого бита — ТОЛЬКО id из worldModel.locations.
  9. endings обязаны покрывать endingsProfile брифа: для "good" — по концовке
     на каждого LI (liId = id этого LI); для "normal"/"bad" — liId: null.
     requires концовки — флаги, устанавливаемые битами (обычно финалом/актгейтами).
  10. summary бита — 1-2 конкретных предложения: что происходит и что меняется.
  11. Все тексты — по-русски (кроме id и флагов).

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "title": "...",
  "logline": "...",
  "beats": [
    {
      "id": "meet_kira",
      "kind": "beat",
      "act": 1,
      "window": { "fromSlot": 0, "toSlot": 2 },
      "locationId": "library",
      "participants": ["kira"],
      "summary": "Первая встреча с Кирой среди стеллажей: столкновение из-за одной книги.",
      "establishes": ["met_kira"],
      "requires": []
    },
    {
      "id": "festival_dilemma",
      "kind": "branchPoint",
      "act": 2,
      "window": { "fromSlot": 3, "toSlot": 5 },
      "locationId": "campus_alley",
      "participants": ["kira"],
      "summary": "Кира просит помочь скрыть провал клуба — или рассказать всё совету.",
      "establishes": ["dilemma_faced"],
      "requires": ["met_kira"],
      "outcomes": [
        {
          "id": "cover_up",
          "label": "Помочь Кире скрыть провал",
          "setsFlag": "chose_cover_up",
          "summary": "Секрет объединяет вас, но ложь начинает расти."
        },
        {
          "id": "tell_truth",
          "label": "Убедить её рассказать правду",
          "setsFlag": "chose_truth",
          "summary": "Кира обижена, но клуб получает шанс на честный перезапуск."
        }
      ]
    },
    {
      "id": "secret_meeting",
      "kind": "beat",
      "act": 3,
      "window": { "fromSlot": 6, "toSlot": 8 },
      "locationId": "library",
      "participants": ["kira"],
      "summary": "Тайная встреча: ложь почти раскрыта, Кира на грани.",
      "establishes": ["lie_strained"],
      "requires": ["chose_cover_up"]
    },
    {
      "id": "final_confession",
      "kind": "finale",
      "act": 4,
      "window": { "fromSlot": 9, "toSlot": 11 },
      "locationId": "campus_alley",
      "participants": ["kira", "yuki"],
      "summary": "Вечер фестиваля: время признаний и решений.",
      "establishes": ["story_resolved"],
      "requires": []
    }
  ],
  "endings": [
    { "id": "ending_good_kira", "kind": "good", "liId": "kira", "requires": ["story_resolved", "chose_truth"] },
    { "id": "ending_normal", "kind": "normal", "liId": null, "requires": ["story_resolved", "chose_cover_up"] },
    { "id": "ending_bad", "kind": "bad", "liId": null, "requires": [] }
  ]
}`;

export async function processSpine(batch: BatchState, body: SpineRequest): Promise<void> {
  const itemId = 'spine';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    // Диапазоны слотов актов считаем здесь и отдаём LLM готовыми — модель
    // стабильно ошибается в арифметике day*daypartsPerDay при пересчёте сама.
    const cal = body.calendar as { days?: number; dayparts?: string[]; actBoundaries?: number[] };
    const perDay = Array.isArray(cal?.dayparts) ? cal.dayparts.length : 0;
    const days = typeof cal?.days === 'number' ? cal.days : 0;
    const boundaries = Array.isArray(cal?.actBoundaries) ? cal.actBoundaries : [];
    const lastSlot = days * perDay - 1;
    const actRanges = boundaries.map((fromDay, i) => {
      const toDay = i + 1 < boundaries.length ? boundaries[i + 1] - 1 : days - 1;
      return `акт ${i + 1}: слоты ${fromDay * perDay}..${toDay * perDay + perDay - 1} (дни ${fromDay}..${toDay})`;
    });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Модель мира (locations)\n${JSON.stringify(body.worldModel, null, 2)}`,
      `## Календарь\n${JSON.stringify(body.calendar, null, 2)}`,
      `## Маппинг агендных тегов\n${body.tagMap ? JSON.stringify(body.tagMap, null, 2) : 'null'}`,
      `## Слоты актов (окна битов обязаны лежать внутри своего акта)\nslot = day × ${perDay} + daypartIndex; последний слот календаря = ${lastSlot}\n${actRanges.join('\n')}`,
      `## Целевые бюджеты\nbeatCount: ${body.targets.beatCount} (допустимо ±1)\nbranchPointBudget: ${body.targets.branchPointBudget} (ровно столько битов kind="branchPoint"${body.targets.branchPointBudget === 0 ? ' — то есть ни одного' : ', не в последнем акте'})`,
    ];

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${JSON.stringify(body.previousAttempt, null, 2)}`);
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${(body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННЫЙ хребет. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Сгенерируй хребет истории (биты с окнами + концовки). Только JSON.');
    }

    logger.log(`[spine] batch=${batch.batchId} — generating (beatCount=${body.targets.beatCount})...`);

    const { text } = await generateText({
      model: resolveModel('spine'),
      system: SPINE_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.beats) || !Array.isArray(parsed.endings)) {
      throw new Error('Invalid response: missing beats or endings');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(
      `[spine] batch=${batch.batchId} — completed (${parsed.beats.length} beats, ${parsed.endings.length} endings)`,
    );
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[spine] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// BEAT PLAN GENERATION
// ============================================================================

const ANCHOR_BEAT_SYSTEM_PROMPT = `Ты — сценарист якорных сцен-событий для романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — мир, тон, протагонист.
  2. anchor — сюжетный якорь: событие (summary), локация, время, act.
  3. actPurpose — функция этого акта в истории (завязка/эскалация/кульминация/развязка).
  4. predecessorBeats — сцены-события, которые игрок УЖЕ видел (в порядке сюжета).
  5. outgoingTargets — якоря, к которым игрок может перейти из этой сцены.

Твоя задача — написать **сцену-событие** и подписи переходов.

Жёсткие правила:
  1. beatText — 3-6 предложений от 2-го лица ("Ты входишь...", "Перед тобой...").
     Событие из anchor.summary происходит НА ЭКРАНЕ, здесь и сейчас — не пересказ,
     не анонс и не воспоминание. Вплети location и timeMarker естественно.
  2. Согласованность: не противоречь predecessorBeats и не повторяй их.
     Факты из anchor.establishes становятся истинными ИМЕННО в этой сцене.
     Если последний predecessorBeat происходит в ТОЙ ЖЕ локации — не начинай
     с "Ты заходишь/входишь": игрок уже там, продолжай на месте.
  2а. НЕ разыгрывай взаимодействия с love interests и не описывай их занятия
     детально — максимум мимолётное упоминание присутствия. Знакомства и
     диалоги происходят ПОСЛЕ этой сцены, внутри этапа.
  3. actPurpose задаёт драматическую функцию сцены — соблюдай тон и накал.
     Для type=climax это пик истории; для type=resolution — развязка.
  4. transitions — РОВНО по одной записи на каждый элемент outgoingTargets.
     label — диегетическое ПЕРЕМЕЩЕНИЕ игрока: 2-6 слов, начинается с глагола
     движения ("Пойти в библиотеку", "Остаться во дворе", "Заглянуть в кофейню").
     ЗАПРЕЩЕНО в label: имена персонажей и глаголы общения ("поговорить",
     "спросить", "обратиться") — переход НЕ запускает встречу, встречи
     происходят внутри следующего этапа. label — это НАМЕРЕНИЕ направиться
     ("Собраться в кофейню", "Направиться к лаборатории"), а не мгновенный
     уход: этап может начаться ещё в текущей локации. Без стрелок, без мета-формулировок
     ("перейти к сцене..."), все labels попарно различимы. label должен
     логично вытекать из beatText и вести к location/timeMarker целевого якоря.
  5. Если outgoingTargets пуст (финальный якорь) — transitions: [].
  6. Все тексты — по-русски.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "anchorId": "school_morning",
  "beatText": "Ты проходишь через школьные ворота, стряхивая капли дождя с зонта...",
  "transitions": [
    { "toAnchorId": "library_noon", "label": "Пойти в библиотеку" },
    { "toAnchorId": "cafe_evening", "label": "Заглянуть в кофейню" }
  ]
}`;

export async function processAnchorBeat(batch: BatchState, body: AnchorBeatRequest): Promise<void> {
  const itemId = 'anchorBeat';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Якорь (событие этой сцены)\n${JSON.stringify(body.anchor, null, 2)}`,
      `## Функция акта\n${body.actPurpose || '(не задана)'}`,
      `## Что игрок уже видел (предыдущие сцены-события)\n${JSON.stringify(body.predecessorBeats, null, 2)}`,
      `## Исходящие переходы (outgoingTargets)\n${JSON.stringify(body.outgoingTargets, null, 2)}`,
    ];

    if (body.location) {
      parts.push(
        `## Локация сцены (из модели мира)\n${JSON.stringify(body.location, null, 2)}${
          body.arrivedVia ? `\n\nИгрок прибывает: ${body.arrivedVia}.` : ''
        }\n\nПаутина уже довела игрока ДО ПОРОГА этой локации — beatText вводит внутрь одним движением (или продолжает на месте, если игрок уже внутри) и разыгрывает событие. НЕ описывай путь и повторное прибытие.`,
      );
    }

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      const prevJson = JSON.stringify(body.previousAttempt, null, 2);
      const issuesList = (body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n');
      parts.push(
        `## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${prevJson}`,
      );
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${issuesList}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННУЮ beat-сцену. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Напиши beat-сцену этого якоря и подписи переходов. Только JSON.');
    }

    const anchorId = (body.anchor as { id?: string })?.id ?? '?';
    logger.log(`[anchorBeat] batch=${batch.batchId} — generating anchor=${anchorId} (${body.outgoingTargets.length} transitions)...`);

    const { text } = await generateText({
      model: resolveModel('anchorBeat'),
      system: ANCHOR_BEAT_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!parsed.beatText || !Array.isArray(parsed.transitions)) {
      throw new Error('Invalid response: missing beatText or transitions');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[anchorBeat] batch=${batch.batchId} — completed (${String(parsed.beatText).length} chars, ${parsed.transitions.length} transitions)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[anchorBeat] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// ENDING GENERATION
// ============================================================================

const ENDING_SYSTEM_PROMPT = `Ты — сценарист эпилогов для романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — мир, тон, протагонист.
  2. outline — заголовок, logline, акты и resolution-якорь истории.
  3. kind — тип концовки: good (с конкретным LI), normal (общая), bad (общая).
  4. liCard + endingTone + liArcSummary + finalEncounterGoal — только для good.
  5. resolutionBeatText — сцена развязки, которую игрок только что видел.

Твоя задача — написать эпилог: 1-3 НАРРАТИВНЫЕ сцены (без выборов).

Жёсткие правила:
  1. scenes — массив из 1-3 сцен: { "id": "...", "narration": "..." }.
     narration — 3-6 предложений от 2-го лица. Без choices, без диалоговых реплик.
  2. Эпилог идёт ПОСЛЕ resolutionBeatText: продолжай, не повторяй и не
     пересказывай её.
  3. kind=good: развязка отношений с этим LI в тоне endingTone. Опирайся на
     liArcSummary (какая была арка) и finalEncounterGoal (последняя встреча).
     LI называй по имени из liCard.
  4. kind=normal: недосказанность/открытый финал без выделенного LI. Итог
     личного пути протагониста, зрелость, дорога дальше.
  5. kind=bad: последствия отчуждения — одиночество или упущенные связи.
     Без нравоучений, без наказания игрока текстом.
  6. Тон мира — из брифа (mood, themes). id сцен — snake_case.
  7. Все тексты — по-русски.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "kind": "good",
  "liId": "kira",
  "scenes": [
    { "id": "ending_good_kira_1", "narration": "Ты стоишь на крыше..." }
  ]
}
Для normal/bad поле liId = null.`;

export async function processEnding(batch: BatchState, body: EndingRequest): Promise<void> {
  const itemId = 'ending';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Outline (контекст истории)\n${JSON.stringify(body.outline, null, 2)}`,
      `## Тип концовки: ${body.kind}`,
    ];
    if (body.liCard) parts.push(`## Карточка LI\n${JSON.stringify(body.liCard, null, 2)}`);
    if (body.endingTone) parts.push(`## Тон концовки\n${body.endingTone}`);
    if (body.liArcSummary) parts.push(`## Арка отношений\n${body.liArcSummary}`);
    if (body.finalEncounterGoal) parts.push(`## Последняя встреча\n${body.finalEncounterGoal}`);
    if (body.resolutionBeatText) {
      parts.push(
        `## Сцена развязки, которую игрок только что видел\n${body.resolutionBeatText}\n\nЭпилог начинается СРАЗУ ПОСЛЕ неё.`,
      );
    }

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${JSON.stringify(body.previousAttempt, null, 2)}`);
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${(body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННЫЙ эпилог. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Напиши эпилог. Только JSON.');
    }

    const liId = (body.liCard as { id?: string })?.id ?? '-';
    logger.log(`[ending] batch=${batch.batchId} — generating kind=${body.kind} li=${liId}...`);

    const { text } = await generateText({
      model: resolveModel('ending'),
      system: ENDING_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error('Invalid response: missing scenes');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[ending] batch=${batch.batchId} — completed (kind=${body.kind}, ${parsed.scenes.length} scenes)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[ending] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// DIALOGUE VARIANT GENERATION
// ============================================================================

const DIALOGUE_UNIT_SYSTEM_PROMPT = `Ты — сценарист диалогов для романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — мир, тон, протагонист.
  2. liCard — карточка love interest (имя, характер, речевой стиль, архетип).
  3. archetypeProfile — профиль архетипа (trajectory, requiredBeats и т.д.).
  4. storyContext — где и когда происходит встреча (location, timeMarker, recentEvents).
  5. bracket — уровень отношений: positive, neutral или negative.
  6. stateRanges — текущие диапазоны state переменных при входе в диалог.

Твоя задача — сгенерировать **диалоговый юнит**: небольшой ГРАФ узлов разговора между протагонистом и LI. Тон и содержание определяются bracket-ом.

Brackets:
  - positive (affection ≥ 0.3) — тёплый, приветливый. Персонаж рад видеть игрока.
  - neutral (affection 0–0.3) — вежливый, нейтральный. Обычное знакомство или дежурный разговор.
  - negative (affection < 0) — холодный, напряжённый. Персонаж недоволен, раздражён или избегает.

Модель юнита:
  - nodes — 4-8 узлов. Каждый узел: narration + реплики LI + choices протагониста.
  - Граф узлов ОБЯЗАН быть DAG (без циклов); каждый узел достижим из entryNodeId.
  - closing-узлы (closing: true, choices: []) — ПАУЗА, а не прощание: тема
    исчерпана, повисает естественная тишина. LI произносит финальную реплику
    ступени. Обязателен хотя бы один closing-узел; каждый путь от entry обязан
    заканчиваться в closing-узле.
    ВАЖНО: разговор может продолжиться следующей ступенью прямо здесь и сейчас —
    поэтому в closing-узле ЗАПРЕЩЕНЫ прощания («до встречи», «увидимся»,
    «спасибо за разговор», «до завтра»). Персонаж, попрощавшийся и оставшийся
    сидеть, выглядит сломанным. Прощальные слова — в поле farewell (см. ниже).
  - У КАЖДОГО choice обязательны два поля:
      kind — тип реплики протагониста:
        ask — вопрос. Следующий узел ОБЯЗАН содержать содержательный ответ LI.
        say — утверждение/предложение, продолжающее разговор.
        react — эмоциональная реакция (улыбнуться, промолчать, нахмуриться).
        farewell — завершение разговора. ЕДИНСТВЕННЫЙ kind, который ведёт в closing-узел.
      next — id следующего узла ВНУТРИ юнита. null/пропуск ЗАПРЕЩЕНЫ:
        выхода "в никуда" не существует, диалог заканчивается только через
        farewell → closing-узел.
  - ask/say/react НИКОГДА не ведут в closing-узел (замаскированный выход запрещён).
    Текст-вопрос обязан иметь kind: "ask". Текст farewell-выбора читается как
    закрытие ("Мне пора", "Спасибо за разговор", прощание).

Жёсткие правила:
  1. narration — от 2-го лица, 2-3 предложения ("Ты подходишь...", "Она поднимает взгляд...").
  2. dialogue — реплики ТОЛЬКО LI (не протагониста). Каждая с emotion из канонических: idle, happy, sad, tense, soft, thoughtful, surprised, angry.
  3. У не-closing узла 2-3 choices. Текст choice — до 12 слов.
  4. choice.effects.stateDeltas — ТОЛЬКО relationship-переменные:
     "relationship[<liId>].affection", "relationship[<liId>].trust", "relationship[<liId>].tension".
     Шаги небольшие: -0.05...+0.1. ЗАПРЕЩЕНЫ ключи slot, phase, met[...],
     beat[...], evt[...], time — перемещением и временем владеет движок снаружи
     диалога.
  4a. ВРЕМЯ СУТОК. storyContext.timeMarker может называть конкретный момент
     («день 1 · вечер») либо сообщать, что время суток РАЗНОЕ. Если разное —
     приветствия и любые привязки к части дня ЗАПРЕЩЕНЫ («Доброе утро», «уже
     поздно», «сегодня вечером»): встреча идёт в разные части дня, и такая
     реплика в половине случаев станет ложью. Пиши время-нейтрально.
     Если момент один — соответствуй ему. И не утверждай, что часть дня только
     началась: разговор мог случиться и на её исходе.
  4b. farewell — ОТДЕЛЬНОЕ поле юнита (не узел графа): короткое прощание,
     которое прозвучит, только если игрок реально решит уйти.
     { "narration": "1 предложение", "dialogue": [{ "speaker": "<liId>", "emotion": "...", "line": "..." }] }
     Именно здесь место словам «до встречи» — и только здесь.
  5. Тон и стиль речи персонажа должны соответствовать liCard.speechPattern и bracket-у.
  6. characterEmotions — ОБЯЗАТЕЛЬНОЕ поле узла. Маппинг id персонажа → эмоция.
  7. Все тексты — по-русски.
  8. Если задан encounterContext:
     - Это встреча №(encounterIndex+1) из totalPlannedEncounters с этим персонажем.
       Первая встреча (index 0) при preExistingRelationship = null — знакомство:
       никаких «как обычно», «снова» и отсылок к прошлым разговорам.
       Последняя — пик арки отношений.
     - stageIndex/stageCount — СТУПЕНЬ БЛИЗОСТИ из stageIndex-й в лестнице из
       stageCount. Это главный регулятор дистанции, важнее bracket-а:
       ступень 1 — герои держатся на расстоянии, разговор вежливый и внешний;
       середина — общее дело, интерес, привычка, первые личные детали;
       предпоследние — доверие и уязвимость;
       последняя — признание/выбор.
       Пиши ровно СВОЮ ступень: не забегай вперёд («я давно хотела сказать…» на
       третьей из пяти) и не отыгрывай назад. Соседние ступени должны читаться
       как соседние, а не как разные истории.
     - stepMeaning — что эта ступень значит ДЛЯ ЭТОГО персонажа: держись его,
       а не общего представления о «сближении».
     - idealRelationship — к чему персонаж стремится. Это горизонт, а не то,
       что он произносит вслух на ранних ступенях.
     - bracket на ранних ступенях НЕ означает близость: positive там — это
       «рад тебя видеть», а не «мы близки». Тёплый тон ≠ пройденная дистанция.
     - goal встречи ОБЯЗАН быть достигнут к концу диалога независимо от
       bracket-а; bracket меняет тон и «цену» достижения, а не сам факт.
     - Если заданы beatType/beatPurpose — диалог реализует именно этот бит арки.
     - anchorBeatText — сцена, которую игрок видел минуту назад: продолжай
       оттуда, не повторяй и не противоречь.
     - priorEncounters: считай, что предыдущие встречи произошли, но НЕ
       пересказывай их сюжетно — опирайся на них степенью близости и тоном,
       без жёстких отсылок к деталям (игрок мог какую-то встречу пропустить).

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "id": "unit_yuki_positive",
  "liId": "yuki",
  "bracket": "positive",
  "entryNodeId": "n1",
  "nodes": [
    {
      "id": "n1",
      "charactersPresent": ["yuki"],
      "characterEmotions": { "yuki": "happy" },
      "narration": "Юки поднимает глаза от книги и улыбается.",
      "dialogue": [
        { "speaker": "yuki", "emotion": "happy", "line": "О, привет! Садись." }
      ],
      "choices": [
        {
          "id": "c1",
          "kind": "ask",
          "text": "Спросить, что она читает",
          "next": "n2",
          "effects": { "stateDeltas": { "relationship[yuki].affection": 0.05 }, "flagSet": [], "flagClear": [] }
        },
        {
          "id": "c2",
          "kind": "farewell",
          "text": "Извиниться и попрощаться",
          "next": "n_bye",
          "effects": { "stateDeltas": { "relationship[yuki].affection": -0.02 }, "flagSet": [], "flagClear": [] }
        }
      ]
    },
    {
      "id": "n2",
      "charactersPresent": ["yuki"],
      "characterEmotions": { "yuki": "soft" },
      "narration": "Она показывает обложку.",
      "dialogue": [
        { "speaker": "yuki", "emotion": "soft", "line": "Сборник старых легенд. Хочешь, почитаю вслух?" }
      ],
      "choices": [
        {
          "id": "c3",
          "kind": "farewell",
          "text": "Поблагодарить за легенду",
          "next": "n_bye",
          "effects": { "stateDeltas": { "relationship[yuki].trust": 0.05 }, "flagSet": [], "flagClear": [] }
        }
      ]
    },
    {
      "id": "n_bye",
      "closing": true,
      "charactersPresent": ["yuki"],
      "characterEmotions": { "yuki": "soft" },
      "narration": "Юки закрывает книгу, придерживая палец между страниц. Повисает уютная тишина.",
      "dialogue": [
        { "speaker": "yuki", "emotion": "soft", "line": "Знаешь, эту легенду мне читала бабушка." }
      ],
      "choices": []
    }
  ],
  "farewell": {
    "narration": "Юки машет тебе рукой.",
    "dialogue": [
      { "speaker": "yuki", "emotion": "happy", "line": "До встречи! Забегай ещё." }
    ]
  }
}

Обрати внимание на пример: closing-узел n_bye — это ПАУЗА (тема закрыта, тишина),
а прощание вынесено в farewell. Так разговор может продолжиться следующей
ступенью, и персонаж не окажется попрощавшимся, но не ушедшим.`;

export async function processDialogueUnit(batch: BatchState, body: DialogueUnitRequest): Promise<void> {
  const itemId = 'dialogueUnit';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Карточка LI\n${JSON.stringify(body.liCard, null, 2)}`,
      `## Профиль архетипа\n${JSON.stringify(body.archetypeProfile, null, 2)}`,
      `## Контекст встречи\n${JSON.stringify(body.storyContext, null, 2)}`,
      `## Bracket: ${body.bracket}`,
      `## Текущие диапазоны state\n${JSON.stringify(body.stateRanges, null, 2)}`,
    ];

    if (body.encounterContext) {
      parts.push(`## Контекст арки (encounterContext)\n${JSON.stringify(body.encounterContext, null, 2)}`);
    }

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      const prevJson = JSON.stringify(body.previousAttempt, null, 2);
      const issuesList = (body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n');
      parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${prevJson}`);
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${issuesList}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push(
        `Сгенерируй ИСПРАВЛЕННЫЙ диалоговый юнит для bracket "${body.bracket}". Те же правила, тот же формат JSON. Только JSON.`,
      );
    } else {
      parts.push(`Сгенерируй диалоговый юнит для bracket "${body.bracket}". Только JSON.`);
    }

    const userMessage = parts.join('\n\n');

    const liId = (body.liCard as { id?: string })?.id ?? '?';
    logger.log(`[dialogueUnit] batch=${batch.batchId} — generating li=${liId} bracket=${body.bracket}...`);

    const { text } = await generateText({
      model: resolveModel('dialogueUnit'),
      system: DIALOGUE_UNIT_SYSTEM_PROMPT,
      prompt: userMessage,
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.nodes) || !parsed.entryNodeId) {
      throw new Error('Invalid response: missing nodes or entryNodeId');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(
      `[dialogueUnit] batch=${batch.batchId} — completed (${parsed.nodes.length} nodes, bracket=${body.bracket})`,
    );
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[dialogueUnit] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// DIALOGUE QA (D1: LLM-критик готового диалогового юнита)
// ============================================================================

const DIALOGUE_QA_SYSTEM_PROMPT = `Ты — редактор-критик диалогов романтической визуальной новеллы (romance VN).

Получаешь:
  1. unit — готовый диалоговый юнит: граф узлов (narration, реплики LI, choices
     с kind: ask|say|react|farewell и переходами next), closing-узлы завершают разговор.
  2. bracket — уровень отношений (positive/neutral/negative), задающий тон.
  3. liCardSummary — выжимка карточки персонажа (имя, характер, речевой стиль).

Твоя задача — проверить КАЧЕСТВО диалога (структуру уже проверил код) и вернуть список проблем.

Проверяй ровно три вещи:
  1. ОТВЕТЫ НА ВОПРОСЫ. Для каждого choice с kind "ask": узел, куда он ведёт (next),
     обязан содержать СОДЕРЖАТЕЛЬНЫЙ ответ LI по смыслу вопроса — не уход от темы,
     не пустую реплику, не ответ на другой вопрос.
  2. ТОН = BRACKET. Реплики LI и narration соответствуют bracket-у:
     positive — тепло и открытость; neutral — вежливая дистанция;
     negative — холод/напряжение. Реплики, выбивающиеся из тона, — проблема.
  3. ЗАВЕРШЁННОСТЬ CLOSING. Каждый closing-узел ЗВУЧИТ как завершение разговора
     (прощание, закрытая тема, естественная точка), а не как обрыв на полуслове
     или незаконченная мысль.

Severity:
  - error — нарушение по существу (вопрос без ответа по смыслу, реплика ломает
    bracket, closing обрывает разговор).
  - warning — шероховатость (ответ формально есть, но куцый; тон слегка плавает).

scope — id узла или id choice, к которому относится проблема ("n2", "c1").
message — 1-2 предложения по-русски: что не так и как исправить.
Если проблем нет — верни {"issues": []}.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "issues": [
    { "severity": "error", "scope": "n2", "message": "Игрок спросил про книгу, а Юки отвечает про погоду — вопрос остался без ответа." }
  ]
}`;

export async function processDialogueQA(batch: BatchState, body: DialogueQARequest): Promise<void> {
  const itemId = 'dialogueQA';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Диалоговый юнит\n${JSON.stringify(body.unit, null, 2)}`,
      `## Bracket: ${body.bracket}`,
      `## Персонаж (выжимка)\n${body.liCardSummary}`,
      'Проверь юнит по трём критериям и верни issues. Только JSON.',
    ];

    logger.log(`[dialogueQA] batch=${batch.batchId} — reviewing bracket=${body.bracket}...`);

    const { text } = await generateText({
      model: resolveModel('dialogueQA'),
      system: DIALOGUE_QA_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.issues)) {
      throw new Error('Invalid response: missing issues array');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[dialogueQA] batch=${batch.batchId} — completed (${parsed.issues.length} issues)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[dialogueQA] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// STORY LEAF QA (D4: LLM-критик сюжета одного листа ветвления)
// ============================================================================

const STORY_LEAF_QA_SYSTEM_PROMPT = `Ты — критик сюжета романтической визуальной новеллы (romance VN).

Получаешь ОДИН лист ветвления истории:
  1. leafLabel — какая комбинация исходов развилок образует этот лист.
  2. beatSummariesOrdered — биты сюжета листа в хронологическом порядке,
     каждый с timeMarker («день N · часть дня»).
  3. endings — доступные концовки (kind: good/normal/bad) с требованиями.
  4. briefTone — тон мира из брифа.

Структуру и достижимость уже проверил код. Твоя задача — проверить СЮЖЕТНУЮ
СВЯЗНОСТЬ ленты и вернуть список проблем.

Проверяй ровно три вещи:
  1. ПРОТИВОРЕЧИЯ МЕЖДУ БИТАМИ. Факты, время и мотивации персонажей не должны
     конфликтовать: событие не может опираться на то, что случится позже
     (timeMarker!); персонаж не может внезапно сменить цель без причины;
     заявленный факт не должен опровергаться следующим битом.
  2. НЕПРЕРЫВНОСТЬ ЗНАНИЙ. Персонажи знают только то, что случилось В ЭТОМ
     листе до текущего бита. Упоминание событий других веток (исходов, не
     выбранных в leafLabel) или ещё не случившихся — проблема.
  3. СОГЛАСОВАННОСТЬ ФИНАЛА. Последние биты листа должны логично подводить
     к перечисленным концовкам; финал, эмоционально или фактически
     несовместимый с ними или с briefTone, — проблема.

Severity:
  - error — противоречие по существу (факт/время/знание ломает сюжет).
  - warning — шероховатость (мотивация слабо обоснована, тон слегка плывёт).

scope — id бита или id концовки, к которому относится проблема.
message — 1-2 предложения по-русски: что не так и как исправить.
Если проблем нет — верни {"issues": []}.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "issues": [
    { "severity": "error", "scope": "beat_confession", "message": "Кира упоминает ссору на фестивале, но в этом листе героиня выбрала исход без фестиваля." }
  ]
}`;

export async function processStoryLeafQA(batch: BatchState, body: StoryLeafQARequest): Promise<void> {
  const itemId = 'storyLeafQA';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const timeline = body.beatSummariesOrdered
      .map((b, i) => `${i + 1}. [${b.timeMarker}] (${b.id}) ${b.summary}`)
      .join('\n');
    const endings = body.endings
      .map(e => `- ${e.id} (${e.kind})${e.summary ? `: ${e.summary}` : ''}`)
      .join('\n');

    const parts: string[] = [
      `## Лист: ${body.leafLabel}`,
      `## Лента битов (хронология)\n${timeline}`,
      `## Концовки\n${endings}`,
      `## Тон брифа\n${body.briefTone}`,
      'Проверь лист по трём критериям и верни issues. Только JSON.',
    ];

    logger.log(`[storyLeafQA] batch=${batch.batchId} — reviewing leaf "${body.leafLabel}"...`);

    const { text } = await generateText({
      model: resolveModel('storyLeafQA'),
      system: STORY_LEAF_QA_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.issues)) {
      throw new Error('Invalid response: missing issues array');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[storyLeafQA] batch=${batch.batchId} — completed (${parsed.issues.length} issues)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[storyLeafQA] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// ANCHOR TRANSITIONS (якорные переходы: диегетическая смена части дня)
// ============================================================================

const ANCHOR_TRANSITION_SYSTEM_PROMPT = `Ты — сценарист романтической визуальной новеллы (romance VN).

Пиши ЯКОРНЫЕ ПЕРЕХОДЫ — короткие сцены, которыми герой сам двигает время вперёд.

КОНТЕКСТ МЕХАНИКИ (важно понять, иначе текст будет мимо):
- Время в игре идёт частями дня (утро/день/вечер). Промотать его нельзя: кнопки
  «подождать» не существует. Время двигают только поступки героя.
- Якорный переход — и есть такой поступок: «пойти на занятия», «вернуться к
  делам», «отправиться домой спать». Игрок жмёт кнопку с твоей подписью и видит
  твою нарацию, после чего наступает следующая часть дня.
- Это НЕ описание сна или лекции целиком. Это один жест перехода: герой решает
  и делает. 1-2 предложения.

ПРАВИЛА:
1. На КАЖДУЮ часть дня из списка — ровно один переход (кроме последней логики
   ниже). daypartIndex — индекс части дня, ИЗ КОТОРОЙ уходим.
2. Последняя часть дня — сон: герой возвращается в домашнюю локацию и ложится
   спать. Наступит утро следующего дня. Упомяни дом по имени, если оно дано.
3. label — подпись кнопки, 2-5 слов, глагол в инфинитиве или повелительном
   («Отправиться на занятия», «Пойти спать»). Без точки в конце.
4. narration — 1-2 предложения от второго лица («ты»), в тоне брифа. Без
   диалогов, без имён других персонажей: их в этот момент рядом может не быть.
5. НЕ упоминай конкретное время суток числами и НЕ здоровайся/прощайся.
6. Пиши по-русски.

ФОРМАТ (только JSON, без markdown):
{
  "transitions": [
    { "daypartIndex": 0, "label": "Отправиться на занятия", "narration": "Ты допиваешь кофе и идёшь к корпусу — утро уже перевалило за середину." }
  ]
}`;

export async function processAnchorTransition(batch: BatchState, body: AnchorTransitionRequest): Promise<void> {
  const itemId = 'anchorTransition';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });
    const last = body.dayparts.length - 1;

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Части дня (по порядку)\n${body.dayparts.map((d, i) => `${i}: ${d}`).join('\n')}`,
      `## Дом героя (куда ведёт сон)\n${body.homeLocationName || '(не задан — напиши нейтрально «домой»)'}`,
      `Нужно ${body.dayparts.length} переходов: daypartIndex от 0 до ${last}. Переход с daypartIndex=${last} — это сон (герой уходит домой, наступает утро следующего дня). Только JSON.`,
    ];

    logger.log(`[anchorTransition] batch=${batch.batchId} — generating ${body.dayparts.length} transitions...`);

    const { text } = await generateText({
      model: resolveModel('anchorTransition'),
      system: ANCHOR_TRANSITION_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.transitions)) throw new Error('Invalid response: missing transitions[]');

    item.status = 'completed';
    item.result = text;
    logger.log(`[anchorTransition] batch=${batch.batchId} — completed (${parsed.transitions.length} transitions)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[anchorTransition] batch=${batch.batchId} — failed: ${item.error}`);
  }
}
