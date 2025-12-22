import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse, InvoiceStatus } from '@/lib/types';

// GET - Obtener una cuenta de cobro específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const { invoiceId } = await params;
    const invoiceIdNum = parseInt(invoiceId);

    if (isNaN(invoiceIdNum)) {
      return NextResponse.json({
        status: 'error',
        message: 'ID de cuenta de cobro inválido'
      } as ApiResponse, { status: 400 });
    }

    await initializeDatabase();
    const db = getDatabase();

    const invoice = await db.getInvoiceById(invoiceIdNum);

    if (!invoice || invoice.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Cuenta de cobro no encontrada'
      } as ApiResponse, { status: 404 });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Cuenta de cobro obtenida',
      data: invoice
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}

// PATCH - Actualizar estado de la cuenta de cobro
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const { invoiceId } = await params;
    const invoiceIdNum = parseInt(invoiceId);

    if (isNaN(invoiceIdNum)) {
      return NextResponse.json({
        status: 'error',
        message: 'ID de cuenta de cobro inválido'
      } as ApiResponse, { status: 400 });
    }

    const body = await request.json();
    const newStatus = body.status as InvoiceStatus;

    if (!newStatus || !['draft', 'sent', 'paid', 'cancelled'].includes(newStatus)) {
      return NextResponse.json({
        status: 'error',
        message: 'Estado inválido. Valores permitidos: draft, sent, paid, cancelled'
      } as ApiResponse, { status: 400 });
    }

    await initializeDatabase();
    const db = getDatabase();

    // Verificar propiedad
    const invoice = await db.getInvoiceById(invoiceIdNum);
    if (!invoice || invoice.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Cuenta de cobro no encontrada'
      } as ApiResponse, { status: 404 });
    }

    await db.updateInvoiceStatus(invoiceIdNum, newStatus);

    const updated = await db.getInvoiceById(invoiceIdNum);

    return NextResponse.json({
      status: 'ok',
      message: 'Estado actualizado',
      data: updated
    } as ApiResponse);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}

// DELETE - Eliminar una cuenta de cobro
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const { invoiceId } = await params;
    const invoiceIdNum = parseInt(invoiceId);

    if (isNaN(invoiceIdNum)) {
      return NextResponse.json({
        status: 'error',
        message: 'ID de cuenta de cobro inválido'
      } as ApiResponse, { status: 400 });
    }

    await initializeDatabase();
    const db = getDatabase();

    // Verificar propiedad
    const invoice = await db.getInvoiceById(invoiceIdNum);
    if (!invoice || invoice.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Cuenta de cobro no encontrada'
      } as ApiResponse, { status: 404 });
    }

    // Solo permitir eliminar borradores
    if (invoice.status !== 'draft') {
      return NextResponse.json({
        status: 'error',
        message: 'Solo se pueden eliminar cuentas en estado borrador'
      } as ApiResponse, { status: 400 });
    }

    await db.deleteInvoice(invoiceIdNum);

    return NextResponse.json({
      status: 'ok',
      message: 'Cuenta de cobro eliminada'
    } as ApiResponse);
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}
