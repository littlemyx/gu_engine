import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { processStoryMasterPrompt, processSceneText, processOutline, processSegment } from './text-generator.js';
import type {
  StoryMasterPromptRequest,
  SceneTextRequest,
  OutlineRequest,
  SegmentRequest,
  ItemState,
  BatchState,
} from './types.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT) || 3200;

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
app.use(express.json({ limit: '1mb' }));

app.post('/generate/storyMasterPrompt', (req, res) => {
  const body = req.body as StoryMasterPromptRequest;

  const batchId = randomUUID();
  const itemId = 'storyMasterPrompt';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/storyMasterPrompt] batch=${batchId} userHint=${body.userHint ? '"' + body.userHint.substring(0, 50) + '..."' : '(none)'}`);

  processStoryMasterPrompt(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/sceneText', (req, res) => {
  const body = req.body as SceneTextRequest;

  const batchId = randomUUID();
  const itemId = 'sceneText';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/sceneText] batch=${batchId} depth=${body.depth}/${body.maxDepth} chain=${body.sceneChain?.length ?? 0}`);

  processSceneText(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/outline', (req, res) => {
  const body = req.body as OutlineRequest;

  const batchId = randomUUID();
  const itemId = 'outline';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  const liCount = Array.isArray((body.brief as { loveInterests?: unknown[] })?.loveInterests)
    ? (body.brief as { loveInterests: unknown[] }).loveInterests.length
    : 0;
  logger.log(`[POST /generate/outline] batch=${batchId} liCount=${liCount}`);

  processOutline(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/segment', (req, res) => {
  const body = req.body as SegmentRequest;

  const batchId = randomUUID();
  const itemId = 'segment';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  const fromId = (body.anchorFrom as { id?: string })?.id ?? '?';
  const toId = (body.anchorTo as { id?: string })?.id ?? '?';
  logger.log(`[POST /generate/segment] batch=${batchId} ${fromId} -> ${toId}`);

  processSegment(batch, body);

  res.json({ batchId, itemIds: [itemId] });
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
    .map(i => ({ id: i.id, result: i.result }));
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
  logger.log(`Text generation server running on http://localhost:${PORT}`);
});
