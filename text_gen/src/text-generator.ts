import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from './logger.js';
import type {
  BatchState,
  StoryMasterPromptRequest,
  SceneTextRequest,
  OutlineRequest,
  SegmentRequest,
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
  1. Бриф (brief) — описание мира, тона, протагониста и каста love interests (LI), у каждого из которых есть architypeId.
  2. Профили архетипов (archetypeProfiles) — для каждого использованного archetypeId описаны requiredBeats, obstacleType, endingProfile и trajectory маршрута.

Твоя задача — построить **скелет якорей** для всей игры, не сами сцены. Якорь — это путевая точка маршрута; ветви между якорями LLM-генератор позже заполнит сценами.

Каноническая структура romance VN:
  Common route → branch_point (common_climax) → per-LI routes → endings.

Жёсткие правила:
  1. Один якорь "setup" (act 1) — старт игры.
  2. По одному "li_introduction" на каждого LI в common route, в первом-втором актах.
  3. Один "common_climax" — финал общей ветки. Из него рёбра идут к route_opening каждого LI.
  4. Для КАЖДОГО LI: route_opening → obstacle_reveal → archetype-specific required_beats (по profile) → crisis → endings.
  5. В endings отдельный якорь на каждую концовку из brief.endingsProfile (например good/normal/bad — три якоря на маршрут).
  6. Якоря образуют DAG: рёбра только вперёд; маршруты не сходятся обратно.
  7. routeId: "common" для общей ветки, "<liId>_route" для маршрутов конкретных LI.
  8. id якоря — короткий snake_case, уникальный, читаемый (например "common_setup", "kira_route_opening", "yuki_crisis", "asel_ending_good").
  9. entryStateRequired:
     - для якорей в common route — null
     - для route_opening — flagsRequired: ["common_climax_passed"] + ranges на affection с этим LI согласно archetype.initialState
     - для последующих route-якорей — заполнить на основе trajectory профиля
     Имена ключей в ranges СТРОГО каноничные:
       • для отношений с конкретным LI — "relationship[<liId>].affection",
         "relationship[<liId>].trust", "relationship[<liId>].tension"
         (не "affection_<liId>", не "<liId>_tension", не "affection" без LI).
       • для дополнительных переменных архетипа — ровно тот ключ, что объявлен в
         archetype.additionalStateVars (например "external_pressure",
         "expressed_affection").
     Эти же имена потом будут использованы branch-генератором для stateDeltas, и
     любое отклонение от формата делает сегмент невалидируемым.
  10. establishes — массив строковых "фактов", которые становятся истинными после прохождения этого якоря (например "met_kira", "common_climax_passed").
  11. summary — 1-2 предложения по-русски, что происходит в этом якоре. Конкретно, привязано к карточкам LI и сеттингу из брифа.
  12. characterEmotion — для якорей с characterFocus обязательно укажи одну из канонических эмоций: idle, happy, sad, tense, soft, thoughtful, surprised, angry. Это определяет какой спрайт персонажа будет показан.

Поле acts — массив актов с короткими целевыми описаниями (purpose), 1 предложение на акт.

ВАЖНО: Ответ — СТРОГО валидный JSON, без markdown-обёртки, без \`\`\`json, без комментариев. Структура:
{
  "title": "...",
  "logline": "...",
  "centralConflict": "...",
  "acts": [{ "act": 1, "purpose": "...", "tone": "..." }],
  "anchors": [
    {
      "id": "common_setup",
      "type": "setup",
      "routeId": "common",
      "act": 1,
      "characterFocus": null,
      "summary": "...",
      "establishes": ["..."],
      "entryStateRequired": null
    },
    {
      "id": "kira_route_opening",
      "type": "route_opening",
      "routeId": "kira_route",
      "act": 2,
      "characterFocus": "kira",
      "characterEmotion": "tense",
      "summary": "...",
      "establishes": ["..."],
      "entryStateRequired": {
        "flagsRequired": ["common_climax_passed"],
        "ranges": {
          "relationship[kira].affection": [0.2, 0.4],
          "relationship[kira].trust": [0.2, 0.4],
          "relationship[kira].tension": [0.5, 0.8]
        }
      }
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

    const userMessage = `## Бриф\n${briefJson}\n\n## Профили архетипов (использованные в этом брифе)\n${archetypesJson}\n\nСгенерируй полный скелет якорей по правилам выше. Только JSON.`;

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
