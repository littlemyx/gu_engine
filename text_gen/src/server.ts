import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { processStoryMasterPrompt, processSceneText, processOutline, processSegment, processLiCards, processNarrationWeb, processAnchorBeat, processBeatPlan, processWorldModel, processWorldCalendar, processSpine, processDialogueVariant, processDialogueUnit, processDialogueQA, processEnding } from './text-generator.js';
import type {
  StoryMasterPromptRequest,
  SceneTextRequest,
  OutlineRequest,
  SegmentRequest,
  LiCardsRequest,
  NarrationWebRequest,
  AnchorBeatRequest,
  BeatPlanRequest,
  WorldModelRequest,
  WorldCalendarRequest,
  SpineRequest,
  DialogueVariantRequest,
  DialogueUnitRequest,
  DialogueQARequest,
  EndingRequest,
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

app.post('/generate/liCards', (req, res) => {
  const body = req.body as LiCardsRequest;

  const batchId = randomUUID();
  const itemId = 'liCards';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/liCards] batch=${batchId} count=${body.count}`);

  processLiCards(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/narrationWeb', (req, res) => {
  const body = req.body as NarrationWebRequest;

  const batchId = randomUUID();
  const itemId = 'narrationWeb';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  const fromId = (body.storyAnchorFrom as { id?: string })?.id ?? '?';
  const toId = (body.storyAnchorTo as { id?: string })?.id ?? '?';
  logger.log(`[POST /generate/narrationWeb] batch=${batchId} ${fromId} -> ${toId} availableLIs=${body.availableLIs?.length ?? 0}`);

  processNarrationWeb(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/worldModel', (req, res) => {
  const body = req.body as WorldModelRequest;

  const batchId = randomUUID();
  const itemId = 'worldModel';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/worldModel] batch=${batchId}`);

  processWorldModel(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/worldCalendar', (req, res) => {
  const body = req.body as WorldCalendarRequest;

  const batchId = randomUUID();
  const itemId = 'worldCalendar';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/worldCalendar] batch=${batchId} days=${body.targets?.days ?? '?'} acts=${body.targets?.acts ?? '?'}`);

  processWorldCalendar(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/spine', (req, res) => {
  const body = req.body as SpineRequest;

  const batchId = randomUUID();
  const itemId = 'spine';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/spine] batch=${batchId} beatCount=${body.targets?.beatCount ?? '?'}`);

  processSpine(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/beatPlan', (req, res) => {
  const body = req.body as BeatPlanRequest;

  const batchId = randomUUID();
  const itemId = 'beatPlan';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/beatPlan] batch=${batchId} slots=${body.encounterSlots?.length ?? 0}`);

  processBeatPlan(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/anchorBeat', (req, res) => {
  const body = req.body as AnchorBeatRequest;

  const batchId = randomUUID();
  const itemId = 'anchorBeat';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  const anchorId = (body.anchor as { id?: string })?.id ?? '?';
  logger.log(`[POST /generate/anchorBeat] batch=${batchId} anchor=${anchorId} outgoing=${body.outgoingTargets?.length ?? 0}`);

  processAnchorBeat(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/dialogueVariant', (req, res) => {
  const body = req.body as DialogueVariantRequest;

  const batchId = randomUUID();
  const itemId = 'dialogueVariant';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  const liId = (body.liCard as { id?: string })?.id ?? '?';
  logger.log(`[POST /generate/dialogueVariant] batch=${batchId} li=${liId} bracket=${body.bracket}`);

  processDialogueVariant(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/dialogueUnit', (req, res) => {
  const body = req.body as DialogueUnitRequest;

  const batchId = randomUUID();
  const itemId = 'dialogueUnit';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  const liId = (body.liCard as { id?: string })?.id ?? '?';
  logger.log(`[POST /generate/dialogueUnit] batch=${batchId} li=${liId} bracket=${body.bracket}`);

  processDialogueUnit(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/dialogueQA', (req, res) => {
  const body = req.body as DialogueQARequest;

  const batchId = randomUUID();
  const itemId = 'dialogueQA';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/dialogueQA] batch=${batchId} bracket=${body.bracket}`);

  processDialogueQA(batch, body);

  res.json({ batchId, itemIds: [itemId] });
});

app.post('/generate/ending', (req, res) => {
  const body = req.body as EndingRequest;

  const batchId = randomUUID();
  const itemId = 'ending';

  const itemStates: Record<string, ItemState> = {
    [itemId]: { id: itemId, status: 'pending' },
  };

  const batch: BatchState = {
    batchId,
    createdAt: new Date().toISOString(),
    items: itemStates,
  };
  batches.set(batchId, batch);

  logger.log(`[POST /generate/ending] batch=${batchId} kind=${body.kind}`);

  processEnding(batch, body);

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
