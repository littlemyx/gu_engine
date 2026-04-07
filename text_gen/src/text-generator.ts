import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from './logger.js';
import type { BatchState, StoryMasterPromptRequest, SceneTextRequest } from './types.js';

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
