import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_SAME_SITE, AUTH_COOKIE_SECURE } from '@/lib/auth';
import { AuthResponse } from '@/lib/types';

export async function POST() {
  const response = NextResponse.json({
    status: 'ok',
    message: 'Sesión cerrada'
  } as AuthResponse);

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: AUTH_COOKIE_SAME_SITE,
    secure: AUTH_COOKIE_SECURE,
    maxAge: 0,
    path: '/',
  });

  return response;
}
