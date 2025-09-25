type RateLimitBucket = {
  count: number;
  expiresAt: number;
};

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, RateLimitBucket>();

export function consumeRateLimit(key: string, options: RateLimitOptions): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt <= now) {
    buckets.set(key, {
      count: 1,
      expiresAt: now + options.windowMs,
    });
    return true;
  }

  if (existing.count >= options.limit) {
    return false;
  }

  existing.count += 1;
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const [first] = forwarded.split(',');
    if (first) {
      return first.trim();
    }
  }

  const ip = (request as unknown as { ip?: string }).ip;
  if (ip) {
    return ip;
  }

  return 'unknown';
}
