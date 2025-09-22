import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { RegisterRequest, AuthResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { email, password, first_name, last_name } = body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
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
    await db.initialize();

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({
        status: 'error',
        message: 'Este email ya está registrado'
      } as AuthResponse, { status: 409 });
    }

    // Create user
    const user = await db.createUser(email, password, first_name, last_name);

    // Create default company
    await db.createCompany('Mi empresa', 'Empresa por defecto', undefined, user.id!);

    // Generate JWT token
    const token = generateToken({
      userId: user.id!,
      email: user.email
    });

    return NextResponse.json({
      status: 'ok',
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        updated_at: user.updated_at
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