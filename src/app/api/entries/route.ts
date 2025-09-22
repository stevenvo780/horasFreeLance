import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/turso-db';
import { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    const body = await request.json();
    const { date, hours, mode = 'set' } = body;

    if (!date || typeof hours !== 'number') {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: date, hours'
      } as ApiResponse, { status: 400 });
    }

    if (hours < 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Las horas deben ser positivas'
      } as ApiResponse, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({
        status: 'error',
        message: 'Formato de fecha inválido, usa YYYY-MM-DD'
      } as ApiResponse, { status: 400 });
    }

    // Validate mode
    if (!['set', 'accumulate', 'error'].includes(mode)) {
      return NextResponse.json({
        status: 'error',
        message: 'Modo inválido, usa: set, accumulate, error'
      } as ApiResponse, { status: 400 });
    }

    const change = await db.addEntry(date, hours, mode);

    const response: ApiResponse = {
      status: 'ok',
      message: `Entrada ${change.old_value ? 'actualizada' : 'creada'} para ${date}`,
      changes: [change]
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}