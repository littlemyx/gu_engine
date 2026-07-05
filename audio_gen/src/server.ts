import 'dotenv/config';
import express from 'express';
import { createBatchRegistry } from 'gu-engine-gen-shared';
import { processMelodyBatch, processVariationBatch, processSfxBatch } from './audio-generator.js';
import type { GenerateMelodyRequest, GenerateVariationRequest, GenerateSfxRequest } from './types.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT) || 3200;

// Ленивая TTL-очистка внутри registry: батчи старше суток вычищаются
// при создании нового.
const registry = createBatchRegistry({ ttlMs: 24 * 60 * 60 * 1000 });

const app = express();
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: '50mb' }));

app.post('/generate/melody', (req, res) => {
  const body = req.body as GenerateMelodyRequest;

  if (!body.style) {
    logger.warn('[POST /generate/melody] 400 — style is required');
    res.status(400).json({ error: 'style is required' });
    return;
  }
  if (typeof body.instrumental !== 'boolean') {
    logger.warn('[POST /generate/melody] 400 — instrumental must be boolean');
    res.status(400).json({ error: 'instrumental must be a boolean' });
    return;
  }

  const batch = registry.create(['variant_1', 'variant_2']);

  logger.log(`[POST /generate/melody] batch=${batch.batchId} style="${body.style}"`);
  processMelodyBatch(batch, body);

  res.json({ batchId: batch.batchId, itemIds: ['variant_1', 'variant_2'] });
});

app.post('/generate/variation', (req, res) => {
  const body = req.body as GenerateVariationRequest;

  if (!body.baseAudioName || !body.toneStyle || !body.variationType) {
    logger.warn('[POST /generate/variation] 400 — missing required fields');
    res.status(400).json({ error: 'baseAudioName, toneStyle, and variationType are required' });
    return;
  }
  if (body.variationType !== 'positive' && body.variationType !== 'negative') {
    logger.warn(`[POST /generate/variation] 400 — invalid variationType: ${body.variationType}`);
    res.status(400).json({ error: `variationType must be 'positive' or 'negative'` });
    return;
  }

  const batch = registry.create(['variant_1', 'variant_2']);

  logger.log(`[POST /generate/variation] batch=${batch.batchId} base=${body.baseAudioName} type=${body.variationType}`);
  processVariationBatch(batch, body);

  res.json({ batchId: batch.batchId, itemIds: ['variant_1', 'variant_2'] });
});

app.post('/generate/sfx', (req, res) => {
  const body = req.body as GenerateSfxRequest;

  if (!body.items?.length) {
    logger.warn('[POST /generate/sfx] 400 — items array is empty or missing');
    res.status(400).json({ error: 'items array is required and must not be empty' });
    return;
  }
  for (const item of body.items) {
    if (!item.id || !item.prompt) {
      logger.warn(`[POST /generate/sfx] 400 — invalid item: ${JSON.stringify(item)}`);
      res.status(400).json({ error: `Each item must have 'id' and 'prompt'` });
      return;
    }
  }

  const itemIds = body.items.map(i => i.id);
  const batch = registry.create(itemIds);

  logger.log(`[POST /generate/sfx] batch=${batch.batchId} items=[${itemIds.join(', ')}]`);
  processSfxBatch(batch, body);

  res.json({ batchId: batch.batchId, itemIds });
});

app.get('/status/:batchId', (req, res) => {
  const batch = registry.get(req.params.batchId);
  if (!batch) {
    logger.warn(`[GET /status/${req.params.batchId}] 404 — batch not found`);
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  res.json(registry.statusPayload(batch));
});

app.get('/status', (_req, res) => {
  res.json(registry.summaries());
});

app.listen(PORT, () => {
  logger.log(`Audio generation server running on http://localhost:${PORT}`);
});
