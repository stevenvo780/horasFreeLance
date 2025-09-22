import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/turso-db';
import { ApiResponse, FillAverageRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    const body: FillAverageRequest = await request.json();
    const { start_date, end_date, overwrite = false } = body;

    if (!start_date || !end_date) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: start_date, end_date'
      } as ApiResponse, { status: 400 });
    }

    // Validate date formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return NextResponse.json({
        status: 'error',
        message: 'Formato de fecha inválido, usa YYYY-MM-DD'
      } as ApiResponse, { status: 400 });
    }

    if (start_date > end_date) {
      return NextResponse.json({
        status: 'error',
        message: 'La fecha inicial debe ser menor o igual que la final'
      } as ApiResponse, { status: 400 });
    }

    const changes = await db.fillWithAverages(start_date, end_date, overwrite);

    const response: ApiResponse = {
      status: 'ok',
      message: `Se completaron ${changes.length} días con promedios`,
      changes
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