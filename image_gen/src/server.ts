import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { processBatch } from './image-generator.js';
import type { GenerateRequest, ItemState, BatchState } from './types.js';

const PORT = Number(process.env.PORT) || 3100;

const batches = new Map<string, BatchState>();

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/generate', (req, res) => {
  const body = req.body as GenerateRequest;

  if (!body.items?.length) {
    res.status(400).json({ error: 'items array is required and must not be empty' });
    return;
  }

  const batchId = randomUUID();
  const itemStates: Record<string, ItemState> = {};
  for (const item of body.items) {
    if (!item.id || !item.description) {
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

  processBatch(batch, body.items, body.masterPrompt, body.negativePrompt);

  res.json({ batchId, itemIds: body.items.map(i => i.id) });
});

app.get('/status/:batchId', (req, res) => {
  const batch = batches.get(req.params.batchId);
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  const items = Object.values(batch.items);
  const completed = items.filter(i => i.status === 'completed').map(i => i.id);
  const pending = items.filter(i => i.status === 'pending' || i.status === 'processing').map(i => i.id);
  const failed = items.filter(i => i.status === 'failed').map(i => ({ id: i.id, error: i.error }));

  res.json({
    batchId: batch.batchId,
    createdAt: batch.createdAt,
    total: items.length,
    completed,
    pending,
    failed,
    done: pending.length === 0,
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
  console.log(`Image generation server running on http://localhost:${PORT}`);
});
