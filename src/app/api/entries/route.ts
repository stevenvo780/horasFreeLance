import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    await initializeDatabase();
    const db = getDatabase();
    
    const body = await request.json();
    const { date, hours, mode = 'set', company_id } = body;

    if (!date || typeof hours !== 'number' || !company_id) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: date, hours, company_id'
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

    // Verify company ownership
    const company = await db.getCompanyById(company_id);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    const entryId = await db.addEntry(date, hours, '', company_id);

    const response: ApiResponse = {
      status: 'ok',
      message: `Entrada creada para ${date}`,
      changes: [{
        date,
        old_value: 0,
        new_value: hours
      }]
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