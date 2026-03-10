import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { processBatch, processCharacterBatch, processRegeneratePose, processBackgroundBatch } from './image-generator.js';
import type { GenerateRequest, CharacterGenerateRequest, RegeneratePoseRequest, BackgroundGenerateRequest, ItemState, BatchState } from './types.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT) || 3100;

const batches = new Map<string, BatchState>();

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

app.post('/generate', (req, res) => {
  const body = req.body as GenerateRequest;

  if (!body.items?.length) {
    logger.warn('[POST /generate] 400 — items array is empty or missing');
    res.status(400).json({ error: 'items array is required and must not be empty' });
    return;
  }

  const batchId = randomUUID();
  const itemStates: Record<string, ItemState> = {};
  for (const item of body.items) {
    if (!item.id || !item.description) {
      logger.warn(`[POST /generate] 400 — invalid item: ${JSON.stringify(item)}`);
      res
        .status(400)
        .json({ error: `Each item must have 'id' and 'description'. Problem with: ${JSON.stringify(item)}` });
      return;
    }
    itemStates[item.id] = { id: item.id, status: 'pending' };
  }

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  const itemIds = body.items.map(i => i.id);
  logger.log(`[POST /generate] batch=${batchId} items=[${itemIds.join(', ')}]`);

  processBatch(batch, body.items, body.masterPrompt, body.negativePrompt);

  res.json({ batchId, itemIds });
});

app.post('/generate/character', (req, res) => {
  const body = req.body as CharacterGenerateRequest;

  if (!body.masterPrompt || !body.characterDescription) {
    logger.warn('[POST /generate/character] 400 — missing masterPrompt or characterDescription');
    res.status(400).json({ error: 'masterPrompt and characterDescription are required' });
    return;
  }

  const batchId = randomUUID();

  // Deduplicate and normalize poses, filter out empty; always include idle
  const rawPoses = body.poses ?? ['idle'];
  const normalized = rawPoses.map(p => p.toLowerCase().trim()).filter(p => p);
  const allPoses = [...new Set(['idle', ...normalized])];

  const itemStates: Record<string, ItemState> = {};
  for (const pose of allPoses) {
    itemStates[pose] = { id: pose, status: 'pending' };
  }

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/character] batch=${batchId} poses=[${allPoses.join(', ')}]`);

  processCharacterBatch(batch, body);

  res.json({ batchId, itemIds: allPoses });
});

app.post('/generate/character/pose', (req, res) => {
  const body = req.body as RegeneratePoseRequest;

  if (!body.masterPrompt || !body.characterDescription || !body.pose || !body.referenceImageUrl) {
    logger.warn('[POST /generate/character/pose] 400 — missing required fields');
    res.status(400).json({ error: 'masterPrompt, characterDescription, pose, and referenceImageUrl are required' });
    return;
  }

  const batchId = randomUUID();
  const poseId = body.pose.toLowerCase().trim();

  const itemStates: Record<string, ItemState> = {
    [poseId]: { id: poseId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/character/pose] batch=${batchId} pose=${poseId} (using reference: ${body.referenceImageUrl})`);

  processRegeneratePose(batch, body);

  res.json({ batchId, itemIds: [poseId] });
});

app.post('/generate/background', (req, res) => {
  const body = req.body as BackgroundGenerateRequest;

  if (!body.masterPrompt || !body.sceneDescription) {
    logger.warn('[POST /generate/background] 400 — missing masterPrompt or sceneDescription');
    res.status(400).json({ error: 'masterPrompt and sceneDescription are required' });
    return;
  }

  const batchId = randomUUID();
  const itemStates: Record<string, ItemState> = {
    background: { id: 'background', status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/background] batch=${batchId}`);

  processBackgroundBatch(batch, body);

  res.json({ batchId, itemIds: ['background'] });
});

app.get('/status/:batchId', (req, res) => {
  const batch = batches.get(req.params.batchId);
  if (!batch) {
    logger.warn(`[GET /status/${req.params.batchId}] 404 — batch not found`);
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  const items = Object.values(batch.items);
  const completed = items
    .filter(i => i.status === 'completed')
    .map(i => ({ id: i.id, file: i.filePath ? path.basename(i.filePath) : '' }));
  const pending = items.filter(i => i.status === 'pending' || i.status === 'processing').map(i => i.id);
  const failed = items.filter(i => i.status === 'failed').map(i => ({ id: i.id, error: i.error }));
  const done = pending.length === 0;

  res.json({
    batchId: batch.batchId,
    createdAt: batch.createdAt,
    total: items.length,
    completed,
    pending,
    failed,
    done,
  });
});

app.get('/status', (_req, res) => {
  const result = Array.from(batches.values()).map(batch => {
    const items = Object.values(batch.items);
    return {
      batchId: batch.batchId,
      createdAt: batch.createdAt,
      total: items.length,
      completed: items.filter(i => i.status === 'completed').length,
      pending: items.filter(i => i.status === 'pending' || i.status === 'processing').length,
      failed: items.filter(i => i.status === 'failed').length,
    };
  });
  res.json(result);
});

app.listen(PORT, () => {
  logger.log(`Image generation server running on http://localhost:${PORT}`);
});
