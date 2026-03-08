# Image Generation Server

Веб-сервер для батчевой генерации изображений через Google Nano Banana 2 (Gemini 3.1 Flash Image) API.

## Установка

```bash
cd image_gen
npm install
```

## Настройка

Скопируй `.env.example` в `.env` и укажи свой API-ключ:

```bash
cp .env.example .env
```

API-ключ можно получить в [Google AI Studio](https://aistudio.google.com).

## Запуск

```bash
npm run dev
```

Сервер запустится на `http://localhost:3100`. Порт можно изменить через переменную `PORT` в `.env`.

## API

### POST /generate

Запускает батчевую генерацию изображений.

```json
{
  "masterPrompt": "Photorealistic, high detail, 4K",
  "negativePrompt": "blurry, low quality, text watermark",
  "items": [
    {
      "id": "hero-banner",
      "description": "A futuristic city skyline at sunset",
      "referenceImages": ["https://example.com/ref1.png"]
    },
    {
      "id": "product-shot",
      "description": "A sleek laptop on a wooden desk"
    }
  ]
}
```

Ответ:

```json
{ "batchId": "uuid...", "itemIds": ["hero-banner", "product-shot"] }
```

### GET /status/:batchId

Возвращает статус генерации конкретного батча.

```json
{
  "batchId": "uuid...",
  "total": 2,
  "completed": ["hero-banner"],
  "pending": ["product-shot"],
  "failed": [],
  "done": false
}
```

### GET /status

Список всех батчей с краткой статистикой.

## Результат

Сгенерированные изображения сохраняются в `result_images/{id}.png`.
