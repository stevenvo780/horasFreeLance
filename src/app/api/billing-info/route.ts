import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse, UpdateUserBillingInfoRequest } from '@/lib/types';

// GET - Obtener datos de facturación del usuario
export async function GET(request: NextRequest) {
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

    const billingInfo = await db.getUserBillingInfo(userId);

    return NextResponse.json({
      status: 'ok',
      message: 'Datos de facturación obtenidos',
      data: billingInfo
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching billing info:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}

// POST/PUT - Crear o actualizar datos de facturación del usuario
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const body: UpdateUserBillingInfoRequest = await request.json();

    // Validación básica
    if (!body.name || !body.id_type || !body.id_number) {
      return NextResponse.json({
        status: 'error',
        message: 'Nombre, tipo de identificación y número son obligatorios'
      } as ApiResponse, { status: 400 });
    }

    await initializeDatabase();
    const db = getDatabase();

    await db.upsertUserBillingInfo(userId, {
      name: body.name,
      id_type: body.id_type,
      id_number: body.id_number,
      address: body.address,
      city: body.city,
      phone: body.phone,
      bank_name: body.bank_name,
      account_type: body.account_type,
      account_number: body.account_number,
      signature_image: body.signature_image,
      declaration: body.declaration
    });

    const updated = await db.getUserBillingInfo(userId);

    return NextResponse.json({
      status: 'ok',
      message: 'Datos de facturación actualizados',
      data: updated
    } as ApiResponse);
  } catch (error) {
    console.error('Error updating billing info:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}
