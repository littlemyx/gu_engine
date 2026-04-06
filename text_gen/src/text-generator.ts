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

function getActGuidance(depth: number, maxDepth: number): string {
  if (maxDepth <= 0) maxDepth = 10;
  const progress = depth / maxDepth;

  if (progress <= 0.25) {
    return `Это ПЕРВЫЙ АКТ (завязка). Глубина сцены: ${depth} из ~${maxDepth}.
Задача: познакомить игрока с миром, персонажами и намекнуть на конфликт. Тон спокойный, интригующий. Не торопи события — дай игроку освоиться.
Количество выходов: 2–3 (простые, исследовательские выборы).`;
  }
  if (progress <= 0.5) {
    return `Это НАЧАЛО ВТОРОГО АКТА (развитие). Глубина сцены: ${depth} из ~${maxDepth}.
Задача: усложнить ситуацию, ввести препятствия, углубить конфликт. Ставки растут, но до кульминации ещё далеко.
Количество выходов: 3–4 (ветвление, значимые решения).`;
  }
  if (progress <= 0.75) {
    return `Это СЕРЕДИНА/КОНЕЦ ВТОРОГО АКТА (нарастание). Глубина сцены: ${depth} из ~${maxDepth}.
Задача: довести напряжение до пика. Персонажи принимают ключевые решения. Подготовь почву для кульминации.
Количество выходов: 2–4 (критические развилки с последствиями).`;
  }
  if (progress <= 0.9) {
    return `Это ТРЕТИЙ АКТ (кульминация). Глубина сцены: ${depth} из ~${maxDepth}.
Задача: это момент истины. Главное противостояние, раскрытие тайн, поворотный момент. Максимальное напряжение и эмоциональный накал.
Количество выходов: 2 (бинарный, судьбоносный выбор).`;
  }
  return `Это ФИНАЛ (развязка). Глубина сцены: ${depth} из ~${maxDepth}.
Задача: подвести итоги, показать последствия выборов игрока. Дай ощущение завершённости.
Количество выходов: 0–1 (история завершается; если есть эпилог — один выход, если нет — пустой массив).`;
}

const SCENE_SYSTEM_PROMPT = `Ты — опытный сценарист интерактивных визуальных новелл. Твоя задача — написать текст одной сцены и варианты выбора для игрока.

Правила:
1. Пиши от второго лица ("Ты входишь...", "Перед тобой...").
2. Текст сцены: 3–6 предложений. Описывай обстановку, действия, диалоги. Будь конкретен и образен.
3. Варианты выхода (choices): коротких варианта действий для игрока. Каждый выход — одна фраза (до 10 слов). Количество выходов определяй по ситуации и актовой структуре (см. ниже).
4. Каждый выбор должен вести историю в разном направлении.
5. Учитывай актовую структуру: не затягивай, но и не торопи повествование.

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

    parts.push('Напиши следующую сцену и варианты выбора для игрока.');

    const userMessage = parts.join('\n\n');

    logger.log(`[sceneText] batch=${batch.batchId} depth=${body.depth}/${body.maxDepth} chain=${body.sceneChain.length} — generating...`);

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
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
