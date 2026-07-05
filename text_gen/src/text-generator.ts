import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from './logger.js';
import type {
  BatchState,
  StoryMasterPromptRequest,
  SceneTextRequest,
  OutlineRequest,
  SegmentRequest,
  LiCardsRequest,
  NarrationWebRequest,
  WorldModelRequest,
  AnchorBeatRequest,
  BeatPlanRequest,
  DialogueVariantRequest,
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
      model: openai('gpt-4.1-mini'),
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
      model: openai('gpt-4.1-mini'),
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

const OUTLINE_SYSTEM_PROMPT = `Ты — outline-планировщик романтических визуальных новелл (romance VN).
Ты получаешь:
  1. Бриф (brief) — описание мира, тона, протагониста и каста love interests (LI).
  2. Профили архетипов (archetypeProfiles) — для каждого использованного archetypeId.

Твоя задача — построить **скелет сюжетных якорей** для всей игры. Якорь — это событие/локация повествования; между якорями позже будут сгенерированы «паутины» сцен-исследований.

ВАЖНО: Ты генерируешь ТОЛЬКО повествовательный слой (story layer). НЕ создавай per-LI маршруты, relationship-якоря, route_opening, obstacle_reveal, crisis, endings. Отношения с персонажами развиваются через encounter-ы в паутинах между якорями, а не через заранее спланированные маршруты.

Жёсткие правила:
  1. Один якорь "setup" (act 1) — старт игры, знакомство с миром.
  2. Якоря — это **события повествования**: смена локации, ключевое сюжетное событие, переход времени.
  3. Типы якорей: setup, location_enter, story_beat, climax, resolution.
  4. Каждый якорь ОБЯЗАН иметь:
     - location — конкретное место ("школьная библиотека", "кафе у набережной", "крыша школы")
     - timeMarker — время суток и/или дата ("утро понедельника", "вечер среды", "закат")
  5. availableLIs — массив id персонажей, которые физически могут быть встречены в этой локации.
     - Каждый LI должен быть доступен минимум в 2-3 якорях
     - Привязка LI к локации должна быть естественной (учительница = школа, бариста = кафе и т.д.)
  6. Якоря образуют DAG: рёбра только вперёд. Обычно близкий к цепочке, но допускаются параллельные локации.
  7. id якоря — короткий snake_case, уникальный, читаемый ("school_morning", "cafe_evening", "festival_day").
  8. establishes — массив строковых "фактов", которые становятся истинными после этого якоря ("arrived_at_school", "festival_started").
  9. summary — 1-2 предложения по-русски, что происходит в этом якоре. Конкретно, привязано к сеттингу из брифа.
  10. Число якорей и их распределение по актам задаются блоком «Целевые бюджеты»
      в запросе (anchorCount ± 1, anchorsPerAct по актам). Если бюджеты не
      заданы — 8-15 якорей. Не перегружай — между якорями будут паутины сцен.
  11. Ровно plotOnlyAnchorCount якорей — «чисто сюжетные»: обычные якоря
      (story_beat / location_enter) с ПУСТЫМ массивом availableLIs. Это НЕ
      отдельный тип — поле type всегда одно из пяти перечисленных.
  12. У climax-якоря availableLIs — не более 2 персонажей, иначе развязка
      раздувается встречами.
  13. resolution — РОВНО ОДИН, без исходящих рёбер. setup — ровно один, без
      входящих. Рёбра не понижают act (act цели >= act источника).

Поле acts — массив актов с короткими целевыми описаниями (purpose), 1 предложение на акт.
Число актов = brief.scale.acts.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json, без комментариев. Структура:
{
  "title": "...",
  "logline": "...",
  "acts": [{ "act": 1, "purpose": "...", "tone": "..." }],
  "anchors": [
    {
      "id": "school_morning",
      "type": "location_enter",
      "act": 1,
      "location": "школьный двор",
      "timeMarker": "утро понедельника",
      "summary": "Первый день в новой школе. Двор полон незнакомых лиц.",
      "establishes": ["arrived_at_school"],
      "availableLIs": ["yuki", "kira"]
    }
  ],
  "anchorEdges": [{ "from": "...", "to": "..." }]
}`;

export async function processOutline(
  batch: BatchState,
  body: OutlineRequest,
): Promise<void> {
  const itemId = 'outline';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const openai = createOpenAI({ apiKey });

    const briefJson = JSON.stringify(body.brief, null, 2);
    const archetypesJson = JSON.stringify(body.archetypeProfiles, null, 2);

    const parts: string[] = [
      `## Бриф\n${briefJson}`,
      `## Профили архетипов (для контекста персонажей)\n${archetypesJson}`,
    ];

    if (body.targets) {
      parts.push(
        `## Целевые бюджеты\nanchorCount: ${body.targets.anchorCount} (допустимо ±1)\nanchorsPerAct (акт 1..N): ${body.targets.anchorsPerAct.join(', ')}\nplotOnlyAnchorCount (якорей с пустым availableLIs): ${body.targets.plotOnlyAnchorCount}`,
      );
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
      parts.push('Сгенерируй ИСПРАВЛЕННЫЙ скелет якорей. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Сгенерируй скелет сюжетных якорей (только story layer, без per-LI маршрутов). Только JSON.');
    }

    const userMessage = parts.join('\n\n');

    logger.log(
      `[outline] batch=${batch.batchId} — generating (brief=${briefJson.length}b, profiles=${archetypesJson.length}b)...`,
    );

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      system: OUTLINE_SYSTEM_PROMPT,
      prompt: userMessage,
    });

    // Validate that response parses as JSON with the right shape
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.anchors) || !Array.isArray(parsed.anchorEdges)) {
      throw new Error('Invalid response: missing anchors or anchorEdges');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(
      `[outline] batch=${batch.batchId} — completed (${parsed.anchors.length} anchors, ${parsed.anchorEdges.length} edges)`,
    );
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[outline] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// SEGMENT GENERATION (scenes between two outline anchors)
// ============================================================================

const SEGMENT_SYSTEM_PROMPT = `Ты — branch-генератор сцен для романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — мир, тон, протагонист (blank slate, реплики = выборы игрока), каст LI.
  2. archetypeProfile — профиль архетипа этого маршрута, или null для common-route.
  3. anchorFrom — стартовый якорь сегмента (что игрок только что прошёл).
  4. anchorTo — целевой якорь сегмента, куда сегмент обязан игрока привести.
     Его entryStateRequired (ranges + flags) — это инвариант, который должен
     достигаться как минимум по одному пути выборов.
  5. existingFlags — флаги, уже выставленные предками anchorFrom.

Твоя задача — сгенерировать **локальный DAG из 3-6 сцен**, который соединяет
anchorFrom и anchorTo. Каждая сцена имеет 2-3 выбора. Выборы влияют на state
(stateDeltas + flag set/clear). Хотя бы одна "успешная" ветка через выборы
должна привести state в anchorTo.entryStateRequired.

Жёсткие правила:
  1. Сцен ровно столько, сколько нужно нарративно: 3 — для коротких сегментов
     (li_introduction, route_opening), 4-5 — для средних (obstacle, required_beat),
     5-6 — для крупных (crisis). Не растягивай.
  2. Структура графа — DAG с 1-2 локальными "пузырями": некоторые выборы ведут в
     разные сцены, но к концу сегмента все пути сходятся к anchorTo. Pure линейная
     цепочка тоже допустима для коротких сегментов.
  3. id сцен — короткие snake_case, читаемые ("kira_walk_park", "yuki_cafe_dawn").
  4. nextSceneId выбора:
     - id другой сцены сегмента → структурное ветвление
     - null → ветка ведёт в anchorTo (выход сегмента)
  5. Хотя бы один выбор в сегменте должен иметь nextSceneId === null.
  6. stateDeltas — небольшие шаги (-0.1...+0.15 типично). КЛЮЧИ в stateDeltas
     обязаны посимвольно совпадать с ключами, перечисленными в
     baselineStateRanges и anchorTo.entryStateRequired.ranges — это и есть
     state-схема для этого outline'а. НЕ переименовывай ключи: если в anchor'е
     стоит "relationship[kira].tension", пиши именно его; если стоит
     "tension_kira" — пиши "tension_kira". Любая нормализация формата ломает
     reachability-валидатор. Дополнительно можешь использовать ключи из
     archetypeProfile.additionalStateVars (тоже посимвольно как объявлены).
  7. flagSet включает все required-флаги anchorTo по пути хотя бы одного выбора
     (можно распределить по разным сценам сегмента).
  8. Соответствуй trajectory.shape архетипа: например, для "monotone_gradual" не
     делай резких скачков (max 0.08 за выбор); для "tension_to_affection_pivot"
     один выбор должен быть "переломным" (резкий tension drop + affection jump).
  9. Текст narration — 2-4 предложения, по-русски. От 2-го лица протагонист
     ("Ты входишь...", "Перед тобой..."). Без внутренних монологов.
  10. dialogue — реплики только LI и других NPC, не протагониста (его реплики —
      это choices). emotion на каждой реплике ОБЯЗАТЕЛЕН. Используй ТОЛЬКО канонические
      эмоции: idle, happy, sad, tense, soft, thoughtful, surprised, angry.
  11. choice.text — короткая фраза, что игрок (= протагонист) делает или говорит.
      До 12 слов.
  12. characterEmotions — ОБЯЗАТЕЛЬНОЕ поле в каждой сцене. Маппинг id каждого
      персонажа из charactersPresent → одна каноническая эмоция (idle/happy/sad/tense/
      soft/thoughtful/surprised/angry). Определяет спрайт персонажа в этой сцене,
      даже если персонаж не говорит.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "fromAnchorId": "...",
  "toAnchorId": "...",
  "entrySceneId": "...",
  "scenes": [
    {
      "id": "...",
      "location": "...",
      "timeMarker": "...",
      "charactersPresent": ["kira"],
      "characterEmotions": { "kira": "tense" },
      "narration": "...",
      "dialogue": [
        { "speaker": "kira", "emotion": "tense", "line": "..." }
      ],
      "choices": [
        {
          "id": "scene_id_c1",
          "text": "...",
          "effects": {
            "stateDeltas": { "relationship[kira].affection": 0.1 },
            "flagSet": ["..."],
            "flagClear": []
          },
          "nextSceneId": "next_scene_id_or_null"
        }
      ]
    }
  ]
}`;

export async function processSegment(batch: BatchState, body: SegmentRequest): Promise<void> {
  const itemId = 'segment';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const openai = createOpenAI({ apiKey });

    const briefJson = JSON.stringify(body.brief, null, 2);
    const archetypeJson = body.archetypeProfile ? JSON.stringify(body.archetypeProfile, null, 2) : 'null';
    const fromJson = JSON.stringify(body.anchorFrom, null, 2);
    const toJson = JSON.stringify(body.anchorTo, null, 2);
    const existingFlagsJson = JSON.stringify(body.existingFlags ?? []);
    const baselineRangesJson = JSON.stringify(body.baselineStateRanges ?? {}, null, 2);

    const parts: string[] = [
      `## Бриф\n${briefJson}`,
      `## Профиль архетипа маршрута\n${archetypeJson}`,
      `## Якорь FROM (стартовая точка сегмента)\n${fromJson}`,
      `## Якорь TO (целевая точка, куда обязан привести сегмент)\n${toJson}`,
      `## Уже установленные флаги (из предков)\n${existingFlagsJson}`,
      `## Базовое состояние на входе сегмента (диапазоны)\n${baselineRangesJson}\nСчитай, что игрок входит в anchorFrom со state в этих диапазонах. Сумма твоих stateDeltas по любому "успешному" пути должна сдвинуть state из этих диапазонов в anchorTo.entryStateRequired.ranges и установить все anchorTo.entryStateRequired.flagsRequired.\n\nВАЖНО про ключи: пиши stateDeltas СТРОГО под теми же именами, что использованы в этом блоке и в anchorTo.entryStateRequired.ranges (посимвольно). Не превращай "tension_kira" в "relationship[kira].tension" и наоборот — иначе валидатор не увидит твоих изменений и сегмент будет отклонён.`,
    ];

    // Retry-with-feedback: если есть previousAttempt и previousIssues,
    // показываем LLM-у предыдущую неудачную попытку и список проблем.
    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      const prevJson = JSON.stringify(body.previousAttempt, null, 2);
      const issuesList = (body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n');
      parts.push(
        `## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\nЭтот JSON был сгенерирован ранее, но не удовлетворил требованиям. Используй как референс — что-то можно сохранить, главное исправить ошибки ниже.\n\n${prevJson}`,
      );
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${issuesList}\n\nПри генерации новой версии сегмента ОБЯЗАТЕЛЬНО устрани эти ошибки. Пути в DAG должны суммарно сдвигать state в нужные диапазоны и устанавливать требуемые флаги anchorTo.`,
      );
      parts.push(
        'Сгенерируй ИСПРАВЛЕННУЮ версию scene-DAG. Те же правила, тот же формат JSON. Только JSON.',
      );
    } else {
      parts.push(
        'Сгенерируй scene-DAG между этими якорями по правилам выше. Только JSON.',
      );
    }

    const userMessage = parts.join('\n\n');

    logger.log(
      `[segment] batch=${batch.batchId} — generating (brief=${briefJson.length}b, from=${(body.anchorFrom as { id?: string })?.id ?? '?'}, to=${(body.anchorTo as { id?: string })?.id ?? '?'}${hasFeedback ? `, retry with ${body.previousIssues?.length ?? 0} issue(s)` : ''})...`,
    );

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      system: SEGMENT_SYSTEM_PROMPT,
      prompt: userMessage,
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.scenes) || !parsed.entrySceneId) {
      throw new Error('Invalid response: missing scenes or entrySceneId');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[segment] batch=${batch.batchId} — completed (${parsed.scenes.length} scenes)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[segment] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// LI CARDS GENERATION
// ============================================================================

const LI_CARDS_SYSTEM_PROMPT = `Ты — дизайнер персонажей для романтических визуальных новелл. Ты получаешь описание мира (story master prompt) и должен создать love interest персонажей, которые органично вписываются в этот мир.

Правила:
  1. Каждый персонаж должен быть уникальным — разные personality, внешность, роль в мире.
  2. Персонажи должны быть привязаны к локациям/реалиям мира из master prompt.
  3. Если указаны предпочтительные архетипы — используй их. Иначе подбери подходящие.
  4. Доступные архетипы: slow_burn, enemies_to_lovers, forbidden, mutual_pining.
  5. speechPattern — как персонаж говорит (формально, с сарказмом, тихо и т.д.).
  6. roleInWorld — роль в мире из master prompt (одноклассница, бариста, соседка и т.д.).
  7. personality.traits — 3-5 черт характера.
  8. personality.values — 2-3 ценности.
  9. personality.fears — 1-2 страха.
  10. personality.desires — 1-2 желания.
  11. appearance — описание внешности: волосы, телосложение, характерная деталь.
  12. Все тексты — по-русски.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Массив объектов:
[
  {
    "id": "yuki",
    "name": "Юки Танака",
    "age": 17,
    "roleInWorld": "тихая одноклассница, всегда с книгой",
    "appearance": {
      "hair": "длинные тёмные волосы, часто в хвосте",
      "build": "хрупкая",
      "signatureItem": "потрёпанный томик поэзии"
    },
    "speechPattern": "говорит тихо и обдуманно, часто цитирует книги",
    "personality": {
      "traits": ["задумчивая", "наблюдательная", "застенчивая"],
      "values": ["искренность", "знания"],
      "fears": ["быть непонятой"],
      "desires": ["найти родственную душу"]
    },
    "archetype": "slow_burn",
    "archetypeSpecifics": null,
    "preExistingRelationship": null
  }
]`;

export async function processLiCards(batch: BatchState, body: LiCardsRequest): Promise<void> {
  const itemId = 'liCards';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Мастер-промпт истории\n${body.storyMasterPrompt}`,
      `Сгенерируй ${body.count} love interest персонажей для этого мира.`,
    ];

    if (body.hints?.archetypes?.length) {
      parts.push(`Предпочтительные архетипы: ${body.hints.archetypes.join(', ')}`);
    }
    if (body.hints?.constraints) {
      parts.push(`Дополнительные ограничения: ${body.hints.constraints}`);
    }

    parts.push('Только JSON (массив).');

    logger.log(`[liCards] batch=${batch.batchId} — generating ${body.count} cards...`);

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      system: LI_CARDS_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid response: expected JSON array');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[liCards] batch=${batch.batchId} — completed (${parsed.length} cards)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[liCards] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// NARRATION WEB GENERATION
// ============================================================================

const NARRATION_WEB_SYSTEM_PROMPT = `Ты — сценарист описательных сцен для романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — мир, тон, протагонист.
  2. storyAnchorFrom — откуда начинается паутина (локация, время, что произошло).
  3. storyAnchorTo — куда паутина должна привести.
  4. availableLIs — персонажи, которые могут быть встречены в этой локации.

Твоя задача — сгенерировать **паутину** между двумя якорями: сцены исследования стартовой локации и ПУТЬ к следующей. Игрок осматривается, может встретить персонажа, затем перемещается к цели.

Если задан блок «Маршрут» (route) — это ПРОСТРАНСТВЕННЫЙ КОНТРАКТ паутины:
  - У КАЖДОЙ сцены обязано быть поле locationId — только из локаций маршрута.
  - Первые сцены — в стартовой локации (fromLocation): исследование и встречи.
  - Затем сцены двигаются по маршруту ТОЛЬКО ВПЕРЁД (via подсказывает, как).
  - Encounter-выборы допустимы только в сценах стартовой локации.
  - Обычный выход (nextSceneId: null без encounterTrigger) — только из сцены
    КОНЕЧНОЙ локации маршрута: игрок прибыл к порогу следующего этапа.
    Не вводи игрока внутрь и не разыгрывай прибытие — это сделает следующая
    сцена-событие.
  - Сцена с choices=[] тоже допустима только в конечной локации.

Жёсткие правила:
  1. 3-8 сцен, связанных как DAG (рёбра только вперёд).
  2. Типы сцен:
     - Нарративная (choices = []) — описательный кадр, игрок кликает чтобы продолжить.
     - Навигационная (choices = 2-3) — action-oriented выборы: «подойти к стойке», «сесть у окна», «выйти на улицу».
  3. Текст narration — от 2-го лица, атмосферный ("Ты толкаешь дверь...", "Тёплый воздух пахнет..."). 2-4 предложения.
  4. NPC-диалог допускается (бариста, продавец), но НЕ диалог с love interests — LI появляются только через encounter trigger.
  5. Encounter trigger — choice с полем encounterTrigger = liId. Означает: "игрок подходит к персонажу, запускается диалог". У такого choice nextSceneId может быть null (выход из паутины в диалог-вариант).
  6. Encounter triggers только для персонажей из availableLIs.
  7. КРИТИЧНО (частая ошибка): хотя бы ОДИН choice во всей паутине обязан быть
     обычным выходом — nextSceneId: null И БЕЗ encounterTrigger («выйти к...»,
     «направиться дальше»). Encounter-выходы НЕ считаются: после диалога игрок
     возвращается в ту же сцену. Паутина, где к следующему якорю ведут только
     встречи, НЕВАЛИДНА.
  8. В каждой сцене, где есть encounter-выбор, обязан быть хотя бы один обычный
     выбор (навигация или выход) — встречи одноразовые, и сцена из одних
     encounter-ов останется без активных кнопок.
  9. Минимальные state effects: только flagSet (если нужно пометить "заходил в кафе"), никаких stateDeltas.
  10. id сцен — snake_case, читаемые ("cafe_entrance", "counter_seat", "window_view").
  11. nextSceneId: id другой сцены или null (выход к storyAnchorTo).
  12. Паутина должна ощущаться как исследование: разные уголки локации, мелкие детали, атмосфера.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "fromAnchorId": "...",
  "toAnchorId": "...",
  "entrySceneId": "...",
  "scenes": [
    {
      "id": "cafe_entrance",
      "location": "кафе, вход",
      "locationId": "cafe",
      "narration": "Ты толкаешь дверь кафе...",
      "choices": [
        { "id": "c1", "text": "Подойти к стойке", "nextSceneId": "counter" },
        { "id": "c2", "text": "Подойти к девушке с книгой", "nextSceneId": null, "encounterTrigger": "yuki" },
        { "id": "c3", "text": "Сесть у окна", "nextSceneId": "window_seat" }
      ]
    },
    {
      "id": "counter",
      "location": "кафе, стойка",
      "narration": "Бариста протирает чашку и улыбается...",
      "choices": []
    }
  ]
}`;

export async function processNarrationWeb(batch: BatchState, body: NarrationWebRequest): Promise<void> {
  const itemId = 'narrationWeb';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const briefJson = JSON.stringify(body.brief, null, 2);
    const fromJson = JSON.stringify(body.storyAnchorFrom, null, 2);
    const toJson = JSON.stringify(body.storyAnchorTo, null, 2);
    const lisJson = JSON.stringify(body.availableLIs, null, 2);
    const flagsJson = JSON.stringify(body.existingFlags ?? []);

    const parts: string[] = [
      `## Бриф\n${briefJson}`,
      `## Якорь FROM\n${fromJson}`,
      `## Якорь TO\n${toJson}`,
      `## Доступные LI для encounter\n${lisJson}`,
      `## Уже установленные флаги\n${flagsJson}`,
    ];

    if (body.fromAnchorBeatText) {
      parts.push(
        `## Сцена-событие, которую игрок только что видел\n${body.fromAnchorBeatText}\n\nПаутина начинается СРАЗУ ПОСЛЕ этой сцены. Entry-сцена НЕ переописывает локацию и персонажей заново — игрок уже здесь и всё это видел. Начни с движения, смены фокуса или новой детали ("Ты делаешь шаг вглубь зала...", "Твой взгляд цепляется за..."), а не с "Ты стоишь в...".`,
      );
    }

    if (body.plannedEncounterLIs && body.plannedEncounterLIs.length > 0) {
      parts.push(
        `## Запланированные встречи\nВ этой паутине ОБЯЗАТЕЛЬНО должен быть хотя бы один choice с encounterTrigger для КАЖДОГО из этих liId: ${body.plannedEncounterLIs.join(', ')}. Размести встречи естественно (персонаж виден в локации, к нему можно подойти).`,
      );
    }

    if (body.fromLocation && body.toLocation && body.route && body.route.length > 0) {
      parts.push(
        [
          `## Стартовая локация (fromLocation)\n${JSON.stringify(body.fromLocation, null, 2)}`,
          `## Конечная локация (toLocation)\n${JSON.stringify(body.toLocation, null, 2)}`,
          `## Маршрут (route) — сцены идут по нему только вперёд\n${body.route
            .map((r, i) => `${i + 1}. ${r.locationId} («${r.name}»)${r.via ? ` — попадаем: ${r.via}` : ''}`)
            .join('\n')}`,
        ].join('\n\n'),
      );
    }

    // Retry-with-feedback: показываем предыдущую неудачную попытку и ошибки.
    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      const prevJson = JSON.stringify(body.previousAttempt, null, 2);
      const issuesList = (body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n');
      parts.push(
        `## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\nЭтот JSON был сгенерирован ранее, но не удовлетворил требованиям. Используй как референс — что-то можно сохранить, главное исправить ошибки ниже.\n\n${prevJson}`,
      );
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${issuesList}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННУЮ версию паутины. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Сгенерируй паутину исследования между якорями. Только JSON.');
    }

    const userMessage = parts.join('\n\n');

    const fromId = (body.storyAnchorFrom as { id?: string })?.id ?? '?';
    const toId = (body.storyAnchorTo as { id?: string })?.id ?? '?';
    logger.log(`[narrationWeb] batch=${batch.batchId} — generating ${fromId} -> ${toId}...`);

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      system: NARRATION_WEB_SYSTEM_PROMPT,
      prompt: userMessage,
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.scenes) || !parsed.entrySceneId) {
      throw new Error('Invalid response: missing scenes or entrySceneId');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[narrationWeb] batch=${batch.batchId} — completed (${parsed.scenes.length} scenes)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[narrationWeb] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// WORLD MODEL GENERATION
// ============================================================================

const WORLD_MODEL_SYSTEM_PROMPT = `Ты — картограф мира романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — сеттинг, эпоха, конкретика места.
  2. outline — сюжетные якоря (каждый со свободным текстом location) и рёбра между ними.

Твоя задача — построить РЕЕСТР ЛОКАЦИЙ мира со связностью и замапить каждый якорь на локацию.

Жёсткие правила:
  1. 6-12 локаций. Каждая: id (короткий snake_case: "library", "campus_alley"),
     name (по-русски), description (2-3 предложения, СТАБИЛЬНОЕ описание места —
     его будут использовать все генераторы сцен), pointsOfInterest (2-4 ключевые
     точки: "стол у окна", "стеллажи у входа").
  2. ПЕРЕИСПОЛЬЗУЙ локации: два якоря в библиотеке = ОДНА локация "library".
     Не плоди дубликаты с разными id для одного и того же места.
  3. adjacent — физическая связность: из какой локации в какую можно пройти
     и КАК ("via": "через аллею кампуса", "по коридору второго этажа").
     Мир должен быть связным: между локациями любых двух соседних по сюжету
     якорей должен существовать путь по adjacency (напрямую или через
     промежуточные локации). Добавляй промежуточные "транзитные" локации
     (аллея, коридор, двор), если они нужны для естественных путей.
  4. anchorLocations — маппинг id КАЖДОГО якоря outline на id локации.
  5. Все тексты — по-русски (кроме id).
  6. mood — доминирующее НАСТРОЕНИЕ локации (для подбора фоновой музыки-эмбиента).
     Ровно одно значение из фиксированного набора:
       neutral_calm (нейтральная/спокойная), cheerful_warm (весёлая/тёплая),
       cozy_tender (уютная/нежная), romantic (романтическая),
       melancholic_sad (грустная/меланхоличная), wistful_nostalgic (ностальгическая),
       tense_anxious (тревожная/напряжённая), ominous_mysterious (зловещая/таинственная),
       tragic_heavy (трагическая/тяжёлая).
     Выбирай по атмосфере места и его роли в сюжете (дождливый пустой универ → melancholic_sad,
     тёплое кафе свиданий → cozy_tender). Если сомневаешься — neutral_calm.
  7. specialKind — ТОЛЬКО для локаций с характерным собственным звуком; одно из:
     bar_tavern, party_club, sports_stadium, market_street, ceremony. Для обычных
     локаций поле опусти или поставь null.

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
    },
    {
      "id": "campus_bar",
      "name": "студенческий бар",
      "description": "Полутёмный бар с барной стойкой и гулом голосов...",
      "pointsOfInterest": ["барная стойка", "угловой диван"],
      "adjacent": [{ "locationId": "campus_alley", "via": "с аллеи через боковую дверь" }],
      "mood": "cheerful_warm",
      "specialKind": "bar_tavern"
    }
  ],
  "anchorLocations": { "library_first_encounter": "library" }
}`;

export async function processWorldModel(batch: BatchState, body: WorldModelRequest): Promise<void> {
  const itemId = 'worldModel';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Outline (якоря и рёбра)\n${JSON.stringify(body.outline, null, 2)}`,
    ];

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${JSON.stringify(body.previousAttempt, null, 2)}`);
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${(body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННУЮ модель мира. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Построй модель мира. Только JSON.');
    }

    logger.log(`[worldModel] batch=${batch.batchId} — mapping world...`);

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      system: WORLD_MODEL_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.locations) || !parsed.anchorLocations) {
      throw new Error('Invalid response: missing locations or anchorLocations');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[worldModel] batch=${batch.batchId} — completed (${parsed.locations.length} locations)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[worldModel] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// BEAT PLAN GENERATION
// ============================================================================

const BEAT_PLAN_SYSTEM_PROMPT = `Ты — планировщик романтических арок поверх готового сюжетного скелета (romance VN).

Получаешь:
  1. Бриф (brief) — мир, тон, каст LI с архетипами.
  2. outline — сюжетные якоря в порядке сюжета (акты, локации, события).
  3. archetypeProfiles — профили архетипов; их requiredBeats нужно разместить.
  4. encounterSlots — допустимые пары: в каком якоре какие LI доступны.

Твоя задача — назначить каждому LI последовательность встреч и разложить
обязательные биты его архетипа по этим встречам.

Жёсткие правила:
  1. Используй ТОЛЬКО пары (liId, anchorId) из encounterSlots. Ничего не выдумывай.
  2. Каждому LI назначь 3-5 встреч (минимум 2), по возрастанию актов;
     не более одной встречи одного LI на якорь.
  3. Для каждого LI размести ВСЕ requiredBeats его архетипа, ровно по одному разу.
     Соблюдай position: 'obstacle_reveal' и 'after_obstacle_reveal' — середина
     арки (примерно акт 2 из 4); 'before_crisis' — предпоследняя встреча;
     'crisis' — последняя встреча перед climax-якорем. beatType бери из профиля.
  4. Встречи без required beat получают goal-прогрессию по стадиям:
     знакомство → узнавание → сближение → уязвимость. Первая встреча LI
     без preExistingRelationship — всегда знакомство.
  5. goal — 1 конкретное предложение по-русски: что должно произойти между
     героями в эту встречу. Привяжи к location якоря. НЕ пересказывай
     requiredBeat.purpose дословно.
  6. liArcs — 1-2 предложения на LI: общая линия отношений от первой до
     последней встречи.
  7. Не сваливай биты всех LI в один якорь; в финальном акте не более
     1 встречи на LI.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json. Структура:
{
  "encounters": [
    { "liId": "kira", "anchorId": "school_morning", "beatType": null, "goal": "Первое настороженное знакомство у расписания." }
  ],
  "liArcs": [
    { "liId": "kira", "arcSummary": "От соперничества через уязвимость к признанию." }
  ]
}`;

export async function processBeatPlan(batch: BatchState, body: BeatPlanRequest): Promise<void> {
  const itemId = 'beatPlan';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const parts: string[] = [
      `## Бриф\n${JSON.stringify(body.brief, null, 2)}`,
      `## Outline (якоря в порядке сюжета)\n${JSON.stringify(body.outline, null, 2)}`,
      `## Профили архетипов (requiredBeats)\n${JSON.stringify(body.archetypeProfiles, null, 2)}`,
      `## Допустимые encounter-слоты\n${JSON.stringify(body.encounterSlots, null, 2)}`,
    ];

    const hasFeedback =
      body.previousAttempt && Array.isArray(body.previousIssues) && body.previousIssues.length > 0;
    if (hasFeedback) {
      const prevJson = JSON.stringify(body.previousAttempt, null, 2);
      const issuesList = (body.previousIssues ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n');
      parts.push(`## ПРЕДЫДУЩАЯ ПОПЫТКА (не прошла валидацию)\n${prevJson}`);
      parts.push(
        `## ОШИБКИ ВАЛИДАЦИИ ПРЕДЫДУЩЕЙ ПОПЫТКИ\n${issuesList}\n\nПри генерации новой версии ОБЯЗАТЕЛЬНО устрани эти ошибки.`,
      );
      parts.push('Сгенерируй ИСПРАВЛЕННЫЙ план битов. Те же правила, тот же формат JSON. Только JSON.');
    } else {
      parts.push('Составь план битов отношений. Только JSON.');
    }

    logger.log(`[beatPlan] batch=${batch.batchId} — planning (slots=${body.encounterSlots.length})...`);

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      system: BEAT_PLAN_SYSTEM_PROMPT,
      prompt: parts.join('\n\n'),
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.encounters) || !Array.isArray(parsed.liArcs)) {
      throw new Error('Invalid response: missing encounters or liArcs');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[beatPlan] batch=${batch.batchId} — completed (${parsed.encounters.length} encounters)`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[beatPlan] batch=${batch.batchId} — failed: ${item.error}`);
  }
}

// ============================================================================
// ANCHOR BEAT GENERATION
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
      model: openai('gpt-4.1-mini'),
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
      model: openai('gpt-4.1-mini'),
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

const DIALOGUE_VARIANT_SYSTEM_PROMPT = `Ты — сценарист диалогов для романтической визуальной новеллы (romance VN).

Получаешь:
  1. Бриф (brief) — мир, тон, протагонист.
  2. liCard — карточка love interest (имя, характер, речевой стиль, архетип).
  3. archetypeProfile — профиль архетипа (trajectory, requiredBeats и т.д.).
  4. storyContext — где и когда происходит встреча (location, timeMarker, recentEvents).
  5. bracket — уровень отношений: positive, neutral или negative.
  6. stateRanges — текущие диапазоны state переменных при входе в диалог.

Твоя задача — сгенерировать **короткий диалог** (2-4 сцены) между протагонистом и LI. Тон и содержание определяются bracket-ом.

Brackets:
  - positive (affection ≥ 0.3) — тёплый, приветливый. Персонаж рад видеть игрока.
  - neutral (affection 0–0.3) — вежливый, нейтральный. Обычное знакомство или дежурный разговор.
  - negative (affection < 0) — холодный, напряжённый. Персонаж недоволен, раздражён или избегает.

Жёсткие правила:
  1. 2-4 сцены с диалогом. Формат DraftScene.
  2. narration — от 2-го лица, 2-3 предложения ("Ты подходишь...", "Она поднимает взгляд...").
  3. dialogue — реплики ТОЛЬКО LI (не протагониста). Каждая с emotion из канонических: idle, happy, sad, tense, soft, thoughtful, surprised, angry.
  4. choices — 2-3 варианта ответа протагониста. До 12 слов.
  5. choice.effects.stateDeltas — изменения relationship vars. Каноничный формат: "relationship[<liId>].affection", "relationship[<liId>].trust", "relationship[<liId>].tension".
     Шаги небольшие: -0.05...+0.1.
  6. nextSceneId: id следующей сцены в диалоге, или null (конец диалога, возврат в паутину).
  7. Хотя бы один choice должен иметь nextSceneId === null (выход из диалога).
  7а. Выходной choice (nextSceneId = null) — это ЗАВЕРШЕНИЕ разговора: его текст
      обязан читаться как закрытие ("Мне пора", "Спасибо за разговор", принятая
      мысль, прощание). Реплика-ВОПРОС никогда не бывает выходом — вопрос ВСЕГДА
      ведёт к следующей сцене, где персонаж отвечает. Это касается и выборов-
      намерений: "Спросить...", "Уточнить...", "Поинтересоваться...", "Узнать..."
      — такие выборы тоже обязаны вести к сцене с ответом (nextSceneId != null).
      В последней сцене диалога все выборы — только завершающие формулировки.
  8. Тон и стиль речи персонажа должны соответствовать liCard.speechPattern и bracket-у.
  9. characterEmotions — ОБЯЗАТЕЛЬНОЕ поле. Маппинг id персонажа → эмоция.
  10. Все тексты — по-русски.
  11. Если задан encounterContext:
      - Это встреча №(encounterIndex+1) из totalPlannedEncounters с этим персонажем.
        Первая встреча (index 0) при preExistingRelationship = null — знакомство:
        никаких «как обычно», «снова» и отсылок к прошлым разговорам.
        Последняя — пик арки отношений.
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
  "bracket": "positive",
  "liId": "yuki",
  "entrySceneId": "yuki_warm_1",
  "scenes": [
    {
      "id": "yuki_warm_1",
      "location": "кафе, дальний столик",
      "timeMarker": "день",
      "charactersPresent": ["yuki"],
      "characterEmotions": { "yuki": "happy" },
      "narration": "Юки поднимает глаза от книги и улыбается.",
      "dialogue": [
        { "speaker": "yuki", "emotion": "happy", "line": "О, привет! Садись." }
      ],
      "choices": [
        {
          "id": "c1",
          "text": "Сесть рядом",
          "effects": { "stateDeltas": { "relationship[yuki].affection": 0.05 }, "flagSet": [], "flagClear": [] },
          "nextSceneId": "yuki_warm_2"
        },
        {
          "id": "c2",
          "text": "Извиниться и уйти",
          "effects": { "stateDeltas": { "relationship[yuki].affection": -0.02 }, "flagSet": [], "flagClear": [] },
          "nextSceneId": null
        }
      ]
    }
  ]
}`;

export async function processDialogueVariant(batch: BatchState, body: DialogueVariantRequest): Promise<void> {
  const itemId = 'dialogueVariant';
  const item = batch.items[itemId];
  item.status = 'processing';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = createOpenAI({ apiKey });

    const briefJson = JSON.stringify(body.brief, null, 2);
    const liJson = JSON.stringify(body.liCard, null, 2);
    const archJson = JSON.stringify(body.archetypeProfile, null, 2);
    const ctxJson = JSON.stringify(body.storyContext, null, 2);
    const rangesJson = JSON.stringify(body.stateRanges, null, 2);

    const parts: string[] = [
      `## Бриф\n${briefJson}`,
      `## Карточка LI\n${liJson}`,
      `## Профиль архетипа\n${archJson}`,
      `## Контекст встречи\n${ctxJson}`,
      `## Bracket: ${body.bracket}`,
      `## Текущие диапазоны state\n${rangesJson}`,
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
        `Сгенерируй ИСПРАВЛЕННУЮ версию диалога для bracket "${body.bracket}". Те же правила, тот же формат JSON. Только JSON.`,
      );
    } else {
      parts.push(`Сгенерируй диалог для bracket "${body.bracket}". Только JSON.`);
    }

    const userMessage = parts.join('\n\n');

    const liId = (body.liCard as { id?: string })?.id ?? '?';
    logger.log(`[dialogueVariant] batch=${batch.batchId} — generating li=${liId} bracket=${body.bracket}...`);

    const { text } = await generateText({
      model: openai('gpt-4.1-mini'),
      system: DIALOGUE_VARIANT_SYSTEM_PROMPT,
      prompt: userMessage,
    });

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.scenes) || !parsed.entrySceneId) {
      throw new Error('Invalid response: missing scenes or entrySceneId');
    }

    item.status = 'completed';
    item.result = text;
    logger.log(`[dialogueVariant] batch=${batch.batchId} — completed (${parsed.scenes.length} scenes, bracket=${body.bracket})`);
  } catch (err) {
    item.status = 'failed';
    item.error = err instanceof Error ? err.message : String(err);
    logger.error(`[dialogueVariant] batch=${batch.batchId} — failed: ${item.error}`);
  }
}
