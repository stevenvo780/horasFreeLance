import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { AuthResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as AuthResponse, { status: 401 });
    }

    const db = getDatabase();
    await db.init();
    const user = await db.getUserById(userId);

    if (!user) {
      return NextResponse.json({
        status: 'error',
        message: 'Usuario no encontrado'
      } as AuthResponse, { status: 404 });
    }

    const { password_hash: _passwordHash, ...safeUser } = user;
    void _passwordHash;

    return NextResponse.json({
      status: 'ok',
      message: 'Sesión válida',
      user: safeUser,
    } as AuthResponse);
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as AuthResponse, { status: 500 });
  }
}
