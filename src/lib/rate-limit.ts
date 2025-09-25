type RateLimitBucket = {
  count: number;
  expiresAt: number;
};

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

const globalBucketsKey = Symbol.for('__hours_freelance_rate_limit_buckets__');
const globalCleanupKey = Symbol.for('__hours_freelance_rate_limit_cleanup__');

type GlobalScope = typeof globalThis & {
  [globalBucketsKey]?: Map<string, RateLimitBucket>;
  [globalCleanupKey]?: ReturnType<typeof setInterval>;
};

const scope = globalThis as GlobalScope;

const buckets = scope[globalBucketsKey] ?? new Map<string, RateLimitBucket>();
scope[globalBucketsKey] = buckets;

const CLEANUP_INTERVAL_MS = 60_000;

if (!scope[globalCleanupKey]) {
  scope[globalCleanupKey] = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.expiresAt <= now) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Prevent the interval from keeping the process alive in Node environments
  scope[globalCleanupKey]?.unref?.();
}

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

const TRUST_PROXY_HEADER = process.env.RATE_LIMIT_TRUST_FORWARD_HEADER === 'true';

const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^[0-9a-f:]+$/i;

function sanitizeIp(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (IPV4_REGEX.test(trimmed)) {
    const segments = trimmed.split('.').map(Number);
    if (segments.every((segment) => Number.isInteger(segment) && segment >= 0 && segment <= 255)) {
      return trimmed;
    }
    return null;
  }
  if (IPV6_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function getClientIp(request: Request): string {
  const requestIp = sanitizeIp((request as unknown as { ip?: string | null }).ip ?? null);
  if (requestIp) {
    return requestIp;
  }

  if (TRUST_PROXY_HEADER) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const candidates = forwarded.split(',');
      for (const candidate of candidates) {
        const valid = sanitizeIp(candidate);
        if (valid) {
          return valid;
        }
      }
    }

    const realIp = sanitizeIp(request.headers.get('x-real-ip'));
    if (realIp) {
      return realIp;
    }
  }

  return 'unknown';
}
