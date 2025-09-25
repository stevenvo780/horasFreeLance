import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME, generateToken } from '@/lib/auth';
import { RegisterRequest, AuthResponse } from '@/lib/types';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const allowed = consumeRateLimit(`register:${clientIp}`, { limit: 5, windowMs: 60_000 });
    if (!allowed) {
      return NextResponse.json({
        status: 'error',
        message: 'Demasiados intentos. Inténtalo más tarde.'
      } as AuthResponse, { status: 429 });
    }

    const body: RegisterRequest = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({
        status: 'error',
        message: 'Todos los campos son requeridos'
      } as AuthResponse, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({
        status: 'error',
        message: 'La contraseña debe tener al menos 8 caracteres'
      } as AuthResponse, { status: 400 });
    }

    const db = getDatabase();
    await db.init();

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({
        status: 'error',
        message: 'Este email ya está registrado'
      } as AuthResponse, { status: 409 });
    }

    // Hash password and create user
    const { hashPassword } = await import('@/lib/auth');
    const passwordHash = await hashPassword(password);
    const userId = await db.createUser(email, passwordHash, name);

    // Create default company
    await db.createCompany('Mi empresa', 50.0, userId);

    // Generate JWT token
    const token = generateToken({
      userId: userId,
      email: email
    });

    const response = NextResponse.json({
      status: 'ok',
      message: 'Usuario registrado exitosamente',
      user: {
        id: userId,
        email: email,
        name: name
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
    console.error('Error during registration:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as AuthResponse, { status: 500 });
  }
}