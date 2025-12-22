import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse, UpdateCompanyBillingInfoRequest } from '@/lib/types';

// GET - Obtener datos de facturación de la empresa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const { companyId } = await params;
    const companyIdNum = parseInt(companyId);

    if (isNaN(companyIdNum)) {
      return NextResponse.json({
        status: 'error',
        message: 'ID de empresa inválido'
      } as ApiResponse, { status: 400 });
    }

    await initializeDatabase();
    const db = getDatabase();

    // Verificar que la empresa pertenece al usuario
    const company = await db.getCompanyById(companyIdNum);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada'
      } as ApiResponse, { status: 404 });
    }

    const billingInfo = await db.getCompanyBillingInfo(companyIdNum);

    return NextResponse.json({
      status: 'ok',
      message: 'Datos de facturación obtenidos',
      data: {
        company,
        billing_info: billingInfo
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching company billing info:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}

// POST - Crear o actualizar datos de facturación de la empresa
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const { companyId } = await params;
    const companyIdNum = parseInt(companyId);

    if (isNaN(companyIdNum)) {
      return NextResponse.json({
        status: 'error',
        message: 'ID de empresa inválido'
      } as ApiResponse, { status: 400 });
    }

    const body: Omit<UpdateCompanyBillingInfoRequest, 'company_id'> = await request.json();

    await initializeDatabase();
    const db = getDatabase();

    // Verificar que la empresa pertenece al usuario
    const company = await db.getCompanyById(companyIdNum);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada'
      } as ApiResponse, { status: 404 });
    }

    await db.upsertCompanyBillingInfo(companyIdNum, {
      legal_name: body.legal_name,
      nit: body.nit,
      address: body.address,
      city: body.city,
      contact_name: body.contact_name,
      contact_phone: body.contact_phone,
      contact_email: body.contact_email
    });

    const updated = await db.getCompanyBillingInfo(companyIdNum);

    return NextResponse.json({
      status: 'ok',
      message: 'Datos de facturación de empresa actualizados',
      data: updated
    } as ApiResponse);
  } catch (error) {
    console.error('Error updating company billing info:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}
