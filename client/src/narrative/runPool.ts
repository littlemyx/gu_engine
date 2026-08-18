/**
 * Пул воркеров для независимых LLM-задач прогона: элементы берутся из общей
 * очереди, одновременно работает не больше `concurrency`.
 *
 * Появился из живой боли: стадия диалогов гнала 40+ юнитов строго по одному —
 * час-полтора последовательных батчей, хотя юниты друг о друге не знают.
 *
 * Ошибки не обрывают соседей на полуслове: пул ждёт, пока все дорожки
 * остановятся (у остановленного прогона каждая быстро упрётся в свой
 * throwIfStopped), и перебрасывает первую причину — иначе Promise.all ронял
 * бы пул раньше, чем дорожки закончат текущие батчи, и их отказы повисали бы
 * необработанными.
 */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });

  const settled = await Promise.allSettled(lanes);
  const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
}
