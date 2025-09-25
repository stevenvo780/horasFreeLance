import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const url = new URL(request.url);
    const companyIdParam = url.searchParams.get('company_id');
    if (!companyIdParam) {
      return NextResponse.json({
        status: 'error',
        message: 'Parámetro requerido: company_id'
      } as ApiResponse, { status: 400 });
    }

    const companyId = Number(companyIdParam);
    if (Number.isNaN(companyId)) {
      return NextResponse.json({
        status: 'error',
        message: 'company_id debe ser numérico'
      } as ApiResponse, { status: 400 });
    }

    const db = getDatabase();
    await db.init();

    const company = await db.getCompanyById(companyId);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    const weekdayAverages = await db.getWeekdayAverages(companyId);

    const response: ApiResponse = {
      status: 'ok',
      message: 'Promedios por día de la semana obtenidos correctamente',
      data: { weekday_averages: weekdayAverages }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching weekday averages:', error);
    const response: ApiResponse = {
      status: 'error',
      message: 'Error interno del servidor'
    };

    return NextResponse.json(response, { status: 500 });
  }
}