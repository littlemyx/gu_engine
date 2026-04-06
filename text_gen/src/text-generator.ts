import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from './logger.js';
import type { BatchState, StoryMasterPromptRequest } from './types.js';

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
      model: openai('gpt-4o-mini'),
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
