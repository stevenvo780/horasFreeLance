import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWTPayload } from './types';

type GlobalWithJwtDevSecret = typeof globalThis & {
  __HOURS_APP_JWT_DEV_SECRET__?: string;
};

const globalWithJwtSecret = globalThis as GlobalWithJwtDevSecret;
const nodeEnv = process.env.NODE_ENV ?? 'development';
const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';

let rawSecret = process.env.JWT_SECRET;

if (!rawSecret) {
  if (!isDevOrTest) {
    throw new Error('JWT_SECRET environment variable is required for authentication.');
  }

  if (!globalWithJwtSecret.__HOURS_APP_JWT_DEV_SECRET__) {
    globalWithJwtSecret.__HOURS_APP_JWT_DEV_SECRET__ = crypto
      .randomBytes(32)
      .toString('hex');
    console.warn(
      '[auth] JWT_SECRET no está definido. Se generó un secreto temporal para desarrollo; los tokens se invalidarán al reiniciar.'
    );
  }

  rawSecret = globalWithJwtSecret.__HOURS_APP_JWT_DEV_SECRET__;
}

const JWT_SECRET: string = rawSecret;

const JWT_EXPIRES_IN = '7d';
const allowInsecureCookie = process.env.ALLOW_INSECURE_AUTH_COOKIE === 'true';

export const AUTH_COOKIE_NAME = allowInsecureCookie ? 'hours-token' : '__Host-hours-token';
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export const AUTH_COOKIE_SAME_SITE = 'strict' as const;
export const AUTH_COOKIE_SECURE = !allowInsecureCookie;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export function getUserIdFromRequest(req: Request): number | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const payload = verifyToken(token);
  return payload?.userId || null;
}

export function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  const headerToken = extractTokenFromHeader(authHeader || undefined);
  if (headerToken) {
    return headerToken;
  }

  const cookieHeader = req.headers.get('cookie');
  const cookieToken = extractTokenFromCookies(cookieHeader || undefined);
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export function extractTokenFromCookies(cookieHeader?: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  return cookies.get(AUTH_COOKIE_NAME) ?? null;
}

function parseCookies(header: string): Map<string, string> {
  return header.split(';').reduce((acc, part) => {
    const [rawName, ...rest] = part.split('=');
    const name = rawName?.trim();
    if (!name) {
      return acc;
    }
    const value = rest.join('=').trim();
    acc.set(name, decodeURIComponent(value));
    return acc;
  }, new Map<string, string>());
}