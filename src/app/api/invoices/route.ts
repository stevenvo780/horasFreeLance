import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse, CreateInvoiceFromHoursRequest, Invoice } from '@/lib/types';

// GET - Listar todas las cuentas de cobro del usuario
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

    // Obtener company_id del query param si existe
    const url = new URL(request.url);
    const companyIdParam = url.searchParams.get('company_id');
    const companyId = companyIdParam ? parseInt(companyIdParam) : undefined;

    // Verificar propiedad de la empresa si se especifica
    if (companyId) {
      const company = await db.getCompanyById(companyId);
      if (!company || company.user_id !== userId) {
        return NextResponse.json({
          status: 'error',
          message: 'Empresa no encontrada'
        } as ApiResponse, { status: 404 });
      }
    }

    const invoices = await db.getUserInvoices(userId, companyId);

    return NextResponse.json({
      status: 'ok',
      message: 'Cuentas de cobro obtenidas',
      data: invoices
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}

// POST - Crear cuenta de cobro desde horas registradas
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        message: 'No autorizado'
      } as ApiResponse, { status: 401 });
    }

    const body: CreateInvoiceFromHoursRequest = await request.json();

    // Validación
    if (!body.company_id || !body.period_start || !body.period_end) {
      return NextResponse.json({
        status: 'error',
        message: 'company_id, period_start y period_end son obligatorios'
      } as ApiResponse, { status: 400 });
    }

    await initializeDatabase();
    const db = getDatabase();

    // Verificar que la empresa pertenece al usuario
    const company = await db.getCompanyById(body.company_id);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada'
      } as ApiResponse, { status: 404 });
    }

    // Obtener datos de facturación del usuario
    const userBillingInfo = await db.getUserBillingInfo(userId);
    if (!userBillingInfo) {
      return NextResponse.json({
        status: 'error',
        message: 'Primero debes configurar tus datos de facturación'
      } as ApiResponse, { status: 400 });
    }

    // Obtener datos de facturación de la empresa
    const companyBillingInfo = await db.getCompanyBillingInfo(body.company_id);

    // Obtener entradas de horas en el periodo
    let entries = await db.getEntriesByDateRange(body.company_id, body.period_start, body.period_end);

    // Filtrar por proyecto si se especifica
    if (body.project_id !== undefined && body.project_id !== null) {
      entries = entries.filter(entry => entry.project_id === body.project_id);
    }

    if (entries.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'No hay horas registradas en el periodo especificado'
      } as ApiResponse, { status: 400 });
    }

    // Calcular totales
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = totalHours * company.hourly_rate;

    // Obtener nombre del proyecto si aplica
    let projectName: string | undefined;
    if (body.project_id) {
      const project = await db.getProjectById(body.project_id);
      projectName = project?.name;
    }

    // Obtener siguiente número de cuenta
    const invoiceNumber = await db.getNextInvoiceNumber(userId);

    // Crear la cuenta de cobro
    const invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      company_id: body.company_id,
      number: invoiceNumber,
      issue_date: body.issue_date || new Date().toISOString().split('T')[0],
      period_start: body.period_start,
      period_end: body.period_end,
      project_name: projectName,
      status: 'draft',
      issuer_name: userBillingInfo.name,
      issuer_id_type: userBillingInfo.id_type,
      issuer_id_number: userBillingInfo.id_number,
      issuer_address: userBillingInfo.address,
      issuer_city: userBillingInfo.city,
      issuer_phone: userBillingInfo.phone,
      issuer_bank_name: userBillingInfo.bank_name,
      issuer_account_type: userBillingInfo.account_type,
      issuer_account_number: userBillingInfo.account_number,
      issuer_signature_image: userBillingInfo.signature_image,
      issuer_declaration: userBillingInfo.declaration,
      client_name: companyBillingInfo?.legal_name || company.name,
      client_nit: companyBillingInfo?.nit,
      client_address: companyBillingInfo?.address,
      client_city: companyBillingInfo?.city,
      total_hours: totalHours,
      total_amount: totalAmount
    };

    const invoiceId = await db.createInvoice(invoice);

    // Crear el item de la cuenta (línea de conceptos)
    await db.addInvoiceItem({
      invoice_id: invoiceId,
      concept: body.concept || 'Servicios de Desarrollo',
      hours: totalHours,
      rate: company.hourly_rate,
      total: totalAmount,
      project_id: body.project_id ?? null
    });

    // Obtener la cuenta creada completa
    const createdInvoice = await db.getInvoiceById(invoiceId);

    return NextResponse.json({
      status: 'ok',
      message: 'Cuenta de cobro creada exitosamente',
      data: createdInvoice
    } as ApiResponse, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}
