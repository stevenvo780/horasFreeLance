import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { RegisterRequest, AuthResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json({
      status: 'ok',
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: userId,
        email: email,
        name: name
      }
    } as AuthResponse);

  } catch (error) {
    console.error('Error during registration:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as AuthResponse, { status: 500 });
  }
}