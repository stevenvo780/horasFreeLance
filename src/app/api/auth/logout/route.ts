import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
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
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  return response;
}
