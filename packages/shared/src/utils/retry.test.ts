import { withRetry } from './retry';

describe('withRetry', () => {
  it('resolves immediately when fn succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { attempts: 3, delayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and resolves when subsequent attempt succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { attempts: 3, delayMs: 10, backoffMultiplier: 1.5 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error when all attempts are exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(withRetry(fn, { attempts: 3, delayMs: 5 })).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
