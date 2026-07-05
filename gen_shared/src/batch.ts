import { randomUUID } from 'node:crypto';

export type ItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ItemState {
  id: string;
  status: ItemStatus;
  fileName?: string;
  error?: string;
}

export interface BatchState {
  batchId: string;
  createdAt: string;
  items: Record<string, ItemState>;
  /** id внешней задачи (например, Suno taskId) — для восстановимости. */
  taskId?: string;
}

export type BatchStatusPayload = {
  batchId: string;
  createdAt: string;
  total: number;
  completed: Array<{ id: string; file: string }>;
  pending: string[];
  failed: Array<{ id: string; error?: string }>;
  done: boolean;
};

export type BatchSummary = {
  batchId: string;
  createdAt: string;
  total: number;
  completed: number;
  pending: number;
  failed: number;
};

/**
 * In-memory реестр батчей с ленивой TTL-очисткой: протухшие батчи
 * вычищаются при создании нового (клиентский поллинг мёртвого батча
 * получает 404 и корректно завершается).
 */
export function createBatchRegistry(opts: { ttlMs: number }) {
  const batches = new Map<string, BatchState>();

  function prune(): void {
    const cutoff = Date.now() - opts.ttlMs;
    for (const [id, batch] of batches) {
      if (new Date(batch.createdAt).getTime() < cutoff) {
        batches.delete(id);
      }
    }
  }

  function create(itemIds: string[]): BatchState {
    prune();
    const items: Record<string, ItemState> = {};
    for (const id of itemIds) {
      items[id] = { id, status: 'pending' };
    }
    const batch: BatchState = {
      batchId: randomUUID(),
      createdAt: new Date().toISOString(),
      items,
    };
    batches.set(batch.batchId, batch);
    return batch;
  }

  function get(batchId: string): BatchState | undefined {
    return batches.get(batchId);
  }

  function statusPayload(batch: BatchState): BatchStatusPayload {
    const items = Object.values(batch.items);
    const completed = items
      .filter(i => i.status === 'completed')
      .map(i => ({ id: i.id, file: i.fileName ?? '' }));
    const pending = items.filter(i => i.status === 'pending' || i.status === 'processing').map(i => i.id);
    const failed = items.filter(i => i.status === 'failed').map(i => ({ id: i.id, error: i.error }));
    return {
      batchId: batch.batchId,
      createdAt: batch.createdAt,
      total: items.length,
      completed,
      pending,
      failed,
      done: pending.length === 0,
    };
  }

  function summaries(): BatchSummary[] {
    return Array.from(batches.values()).map(batch => {
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
  }

  return { create, get, statusPayload, summaries, prune };
}
