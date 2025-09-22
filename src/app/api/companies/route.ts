import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { CreateCompanyRequest, ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const db = getDatabase();
    await db.initialize();

    const companies = await db.getCompaniesByUserId(userId);

    return NextResponse.json({
      status: 'ok',
      message: 'Empresas obtenidas exitosamente',
      data: companies
    } as ApiResponse);

  } catch (error) {
    console.error('Error getting companies:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
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

    const body: CreateCompanyRequest = await request.json();
    const { name, description, hourly_rate } = body;

    if (!name) {
      return NextResponse.json({
        status: 'error',
        message: 'El nombre de la empresa es requerido'
      } as ApiResponse, { status: 400 });
    }

    const db = getDatabase();
    await db.initialize();

    const company = await db.createCompany(name, description, hourly_rate, userId);

    return NextResponse.json({
      status: 'ok',
      message: 'Empresa creada exitosamente',
      data: company
    } as ApiResponse);

  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}