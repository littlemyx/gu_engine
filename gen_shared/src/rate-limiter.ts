/**
 * Token-bucket rate limiter со скользящим окном. Race-free на
 * single-threaded event loop: между prune/check и push нет await.
 */
export function createRateLimiter(opts: {
  maxRequests: number;
  windowMs: number;
  onWait?: (waitMs: number) => void;
}): () => Promise<void> {
  const timestamps: number[] = [];

  async function waitForSlot(): Promise<void> {
    const now = Date.now();
    while (timestamps.length > 0 && timestamps[0] < now - opts.windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= opts.maxRequests) {
      const waitMs = timestamps[0] + opts.windowMs - now + 100;
      opts.onWait?.(waitMs);
      await new Promise(r => setTimeout(r, waitMs));
      return waitForSlot();
    }
    timestamps.push(Date.now());
  }

  return waitForSlot;
}
