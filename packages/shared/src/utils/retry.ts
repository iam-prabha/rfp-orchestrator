function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  attempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let delay = opts.delayMs;
  let lastError: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < opts.attempts - 1) await sleep(delay);
      delay = Math.round(delay * (opts.backoffMultiplier ?? 2));
    }
  }
  throw lastError;
}
