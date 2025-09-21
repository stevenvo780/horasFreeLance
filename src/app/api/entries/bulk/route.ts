import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { ApiResponse, BulkAddRequest, WEEKDAY_ALIASES } from '@/lib/types';

function parseWeekdays(weekdayStrings: string[]): number[] {
  const weekdays: number[] = [];
  
  for (const weekdayStr of weekdayStrings) {
    const normalized = weekdayStr.toLowerCase().trim();
    const weekday = WEEKDAY_ALIASES[normalized];
    
    if (weekday !== undefined) {
      weekdays.push(weekday);
    } else {
      throw new Error(`Día de la semana inválido: ${weekdayStr}`);
    }
  }
  
  return [...new Set(weekdays)]; // Remove duplicates
}

function bulkAddEntries(
  startDate: string,
  endDate: string,
  hours: number,
  weekdays?: number[],
  skipExisting = false,
  mode: 'set' | 'accumulate' | 'error' = 'set'
) {
  const entries: Array<{ date: string; hours: number; mode: typeof mode }> = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1; // Convert to ISO weekday
    
    if (!weekdays || weekdays.includes(weekday)) {
      const dateStr = current.toISOString().split('T')[0];
      entries.push({ date: dateStr, hours, mode: skipExisting ? 'error' : mode });
    }
  }
  
  return entries;
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    const body: BulkAddRequest = await request.json();
    const { start_date, end_date, hours, weekdays: weekdayStrings, mode = 'set', skip_existing = false } = body;

    if (!start_date || !end_date || typeof hours !== 'number') {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: start_date, end_date, hours'
      } as ApiResponse, { status: 400 });
    }

    if (hours < 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Las horas deben ser positivas'
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

    // Validate mode
    if (!['set', 'accumulate', 'error'].includes(mode)) {
      return NextResponse.json({
        status: 'error',
        message: 'Modo inválido, usa: set, accumulate, error'
      } as ApiResponse, { status: 400 });
    }

    // Parse weekdays if provided
    let weekdays: number[] | undefined;
    if (weekdayStrings && weekdayStrings.length > 0) {
      try {
        weekdays = parseWeekdays(weekdayStrings);
      } catch (error) {
        return NextResponse.json({
          status: 'error',
          message: error instanceof Error ? error.message : 'Error parsing weekdays'
        } as ApiResponse, { status: 400 });
      }
    }

    // Generate entries for the date range
    const entriesToAdd = bulkAddEntries(start_date, end_date, hours, weekdays, skip_existing, mode);
    
    if (entriesToAdd.length === 0) {
      return NextResponse.json({
        status: 'ok',
        message: 'No se encontraron días que coincidan con los criterios',
        changes: []
      } as ApiResponse);
    }

    // Process each entry
    const changes = [];
    const errors = [];

    for (const entry of entriesToAdd) {
      try {
        const change = await db.addEntry(entry.date, entry.hours, entry.mode);
        changes.push(change);
      } catch (error) {
        if (skip_existing && error instanceof Error && error.message.includes('Ya existe')) {
          continue; // Skip existing entries when skip_existing is true
        }
        errors.push(`${entry.date}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }

    if (errors.length > 0 && changes.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: `Errores en todas las entradas: ${errors.join(', ')}`
      } as ApiResponse, { status: 400 });
    }

    const response: ApiResponse = {
      status: 'ok',
      message: `Se procesaron ${changes.length} días${errors.length > 0 ? ` (${errors.length} errores)` : ''}`,
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