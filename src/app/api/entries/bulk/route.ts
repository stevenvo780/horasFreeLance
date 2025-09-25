import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
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

function buildDateRange(
  startDate: string,
  endDate: string,
  weekdays?: number[],
) {
  const entries: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1; // Convert to ISO weekday
    
    if (!weekdays || weekdays.includes(weekday)) {
      const dateStr = current.toISOString().split('T')[0];
      entries.push(dateStr);
    }
  }
  
  return entries;
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const db = getDatabase();
    await db.init();

    const body: BulkAddRequest = await request.json();
    const {
      start_date,
      end_date,
      hours,
      weekdays: weekdayStrings,
      mode = 'set',
      skip_existing = false,
      company_id,
      project_id = null,
    } = body;

    if (!start_date || !end_date || typeof hours !== 'number' || !company_id) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: start_date, end_date, hours, company_id'
      } as ApiResponse, { status: 400 });
    }

    if (hours < 0 || hours > 24) {
      return NextResponse.json({
        status: 'error',
        message: 'Las horas deben ser un número entre 0 y 24'
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

    const company = await db.getCompanyById(company_id);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    const hasProjectId = Object.prototype.hasOwnProperty.call(body, 'project_id');
    let projectIdToUse: number | null = null;
    if (hasProjectId && project_id != null) {
      const project = await db.getProjectById(project_id);
      if (!project || project.user_id !== userId || project.company_id !== company_id) {
        return NextResponse.json({
          status: 'error',
          message: 'Proyecto no encontrado o sin permisos'
        } as ApiResponse, { status: 404 });
      }
      projectIdToUse = project.id ?? null;
    } else if (hasProjectId && project_id == null) {
      projectIdToUse = null;
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
    const dates = buildDateRange(start_date, end_date, weekdays);
    
    if (dates.length === 0) {
      return NextResponse.json({
        status: 'ok',
        message: 'No se encontraron días que coincidan con los criterios',
        changes: []
      } as ApiResponse);
    }

    // Process each entry
  const changes: NonNullable<ApiResponse['changes']> = [];
    const errors: string[] = [];

    for (const date of dates) {
      try {
        const existingEntry = await db.getEntryByDate(company_id, date, projectIdToUse ?? null);

        if (existingEntry) {
          if (skip_existing) {
            continue;
          }

          if (mode === 'error') {
            errors.push(`${date}: Ya existe una entrada`);
            continue;
          }

          const newHours = mode === 'accumulate' ? existingEntry.hours + hours : hours;
          if (newHours < 0 || newHours > 24) {
            errors.push(`${date}: Las horas resultantes deben estar entre 0 y 24`);
            continue;
          }

          const nextDescription = existingEntry.description || 'Carga masiva';
          await db.updateEntry(existingEntry.id!, date, newHours, nextDescription, projectIdToUse ?? existingEntry.project_id ?? null);
          changes.push({
            date,
            old_value: existingEntry.hours,
            new_value: newHours,
          });
          continue;
        }

        await db.addEntry(date, hours, 'Carga masiva', company_id, projectIdToUse ?? null);
        changes.push({
          date,
          old_value: 0,
          new_value: hours,
        });
      } catch (error) {
        errors.push(`${date}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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