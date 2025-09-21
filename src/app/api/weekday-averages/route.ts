import { NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    const weekdayAverages = await db.getWeekdayAverages();

    const response: ApiResponse = {
      status: 'ok',
      message: 'Promedios por día de la semana obtenidos correctamente',
      data: { weekday_averages: weekdayAverages }
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