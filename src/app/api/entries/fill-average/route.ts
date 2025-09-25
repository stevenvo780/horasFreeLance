import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse, FillAverageRequest } from '@/lib/types';

const MAX_FILL_RANGE_DAYS = 31;

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

    const body: FillAverageRequest & { company_id?: number } = await request.json();
    const { start_date, end_date, overwrite = false, company_id } = body;

    if (!start_date || !end_date || !company_id) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: start_date, end_date, company_id'
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

    const start = new Date(start_date + 'T00:00:00Z');
    const end = new Date(end_date + 'T00:00:00Z');
    const rangeDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (!Number.isFinite(rangeDays) || rangeDays <= 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Rango de fechas inválido'
      } as ApiResponse, { status: 400 });
    }

    if (rangeDays > MAX_FILL_RANGE_DAYS) {
      return NextResponse.json({
        status: 'error',
        message: `El rango de fechas no puede exceder ${MAX_FILL_RANGE_DAYS} días`
      } as ApiResponse, { status: 400 });
    }

    const company = await db.getCompanyById(company_id);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    const changes = await db.fillWithAverages(start_date, end_date, company_id, overwrite);

    const response: ApiResponse = {
      status: 'ok',
      message: `Se completaron ${changes.length} días con promedios`,
      changes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error filling averages:', error);
    const response: ApiResponse = {
      status: 'error',
      message: 'Error interno del servidor'
    };

    return NextResponse.json(response, { status: 500 });
  }
}