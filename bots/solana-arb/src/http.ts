import { log } from "./logger.js";

/** Serialises requests so the client never exceeds a fixed rate. */
export class Throttle {
  private next = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const start = Math.max(now, this.next);
    this.next = start + this.minIntervalMs;
    if (start > now) {
      await new Promise((resolve) => setTimeout(resolve, start - now));
    }
  }

  /** Pushes the next allowed slot out, e.g. after a 429. */
  backoff(ms: number): void {
    this.next = Math.max(this.next, Date.now() + ms);
  }
}

export class RateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("rate limited");
    this.name = "RateLimitError";
  }
}

function retryAfterMs(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 30_000);
}

/**
 * Fetches with backoff on 429 and 5xx. The public Jupiter and RPC endpoints
 * rate-limit aggressively, so this is the normal path, not an edge case.
 */
export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  opts: { throttle: Throttle; label: string; maxAttempts?: number },
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 4;
  let lastDelay = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await opts.throttle.wait();
    const res = await fetch(input, init);
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) {
      throw new Error(`${opts.label} ${res.status}: ${await res.text()}`);
    }

    lastDelay = retryAfterMs(res, attempt);
    opts.throttle.backoff(lastDelay);
    if (attempt === maxAttempts - 1) break;
    log.debug(
      `${opts.label} ${res.status}, retrying in ${lastDelay}ms (attempt ${attempt + 1}/${maxAttempts})`,
    );
  }

  throw new RateLimitError(lastDelay);
}
