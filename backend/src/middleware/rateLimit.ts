import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

function pruneExpired(map: Map<string, Bucket>, now: number): void {
  if (map.size < 1000) return;
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
}

export function createHttpRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    pruneExpired(hits, now);
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ ok: false, error: "Too many requests. Please slow down." });
      return;
    }

    entry.count += 1;
    next();
  };
}

export class SocketRateLimiter {
  private buckets = new Map<string, Bucket>();

  allow(socketId: string, action: string, maxEvents: number, windowMs: number): boolean {
    const now = Date.now();
    pruneExpired(this.buckets, now);
    const key = `${socketId}:${action}`;
    const entry = this.buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= maxEvents) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  clear(socketId: string): void {
    const prefix = `${socketId}:`;
    for (const key of this.buckets.keys()) {
      if (key.startsWith(prefix)) this.buckets.delete(key);
    }
  }
}

export const socketLimiter = new SocketRateLimiter();
