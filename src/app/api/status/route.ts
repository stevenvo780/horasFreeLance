import { NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    const [entries, settings, weekdayAverages, totalHours] = await Promise.all([
      db.getEntries(),
      db.getSettings(),
      db.getWeekdayAverages(),
      db.getTotalHours()
    ]);

    const response: ApiResponse = {
      status: 'ok',
      message: 'Estado obtenido correctamente',
      data: {
        entries,
        settings,
        weekday_averages: weekdayAverages,
        total_hours: totalHours,
        entry_count: entries.length
      }
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