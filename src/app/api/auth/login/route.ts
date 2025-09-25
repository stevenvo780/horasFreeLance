import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME, generateToken, verifyPassword } from '@/lib/auth';
import { LoginRequest, AuthResponse } from '@/lib/types';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const allowed = consumeRateLimit(`login:${clientIp}`, { limit: 10, windowMs: 60_000 });
    if (!allowed) {
      return NextResponse.json({
        status: 'error',
        message: 'Demasiados intentos. Inténtalo más tarde.'
      } as AuthResponse, { status: 429 });
    }

    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json({
        status: 'error',
        message: 'Email y contraseña son requeridos'
      } as AuthResponse, { status: 400 });
    }

    const db = getDatabase();
    await db.init();

    // Find user by email
    const user = await db.getUserByEmail(email);
    if (!user) {
      return NextResponse.json({
        status: 'error',
        message: 'Credenciales inválidas'
      } as AuthResponse, { status: 401 });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({
        status: 'error',
        message: 'Credenciales inválidas'
      } as AuthResponse, { status: 401 });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id!,
      email: user.email
    });

    const response = NextResponse.json({
      status: 'ok',
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      }
    } as AuthResponse);

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as AuthResponse, { status: 500 });
  }
}