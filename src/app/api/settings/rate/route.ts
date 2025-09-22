import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/turso-db';
import { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    const body = await request.json();
    const { rate } = body;

    if (typeof rate !== 'number') {
      return NextResponse.json({
        status: 'error',
        message: 'Campo requerido: rate (number)'
      } as ApiResponse, { status: 400 });
    }

    if (rate < 0) {
      return NextResponse.json({
        status: 'error',
        message: 'La tarifa debe ser positiva'
      } as ApiResponse, { status: 400 });
    }

    await db.setHourlyRate(rate);

    const response: ApiResponse = {
      status: 'ok',
      message: 'Tarifa actualizada correctamente',
      data: { rate }
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