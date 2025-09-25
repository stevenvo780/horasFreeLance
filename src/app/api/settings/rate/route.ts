import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
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

    const db = getDatabase();
    await db.init();

    const body = await request.json();
    const { rate, company_id } = body ?? {};

    if (typeof rate !== 'number' || !company_id) {
      return NextResponse.json({
        status: 'error',
        message: 'Campos requeridos: company_id, rate (number)'
      } as ApiResponse, { status: 400 });
    }

    if (rate < 0) {
      return NextResponse.json({
        status: 'error',
        message: 'La tarifa debe ser positiva'
      } as ApiResponse, { status: 400 });
    }

    const company = await db.getCompanyById(company_id);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    await db.updateCompanyRate(company_id, rate);

    const response: ApiResponse = {
      status: 'ok',
      message: 'Tarifa actualizada correctamente',
      data: { rate, company_id }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating company rate:', error);
    const response: ApiResponse = {
      status: 'error',
      message: 'Error interno del servidor'
    };

    return NextResponse.json(response, { status: 500 });
  }
}