import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { ApiResponse, HourEntry } from '@/lib/types';

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

    const { companyId: companyIdParam } = await params;
    const companyId = parseInt(companyIdParam);
    if (isNaN(companyId)) {
      return NextResponse.json({
        status: 'error',
        message: 'ID de empresa inválido'
      } as ApiResponse, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan parámetros: startDate y endDate son requeridos'
      } as ApiResponse, { status: 400 });
    }

    // Validar formato de fecha YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json({
        status: 'error',
        message: 'Formato de fecha inválido, usa YYYY-MM-DD'
      } as ApiResponse, { status: 400 });
    }

    const db = getDatabase();
    await db.init();

    // Verificar que la empresa pertenece al usuario
    const company = await db.getCompanyById(companyId);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    // Obtener tarifa de la empresa
    const hourlyRate = company.hourly_rate || 0;

    // Obtener todos los proyectos de la empresa
    const projects = await db.getCompanyProjects(companyId);

    // Obtener entradas de horas en el rango de fechas
    const entries = await db.getEntriesByDateRange(companyId, startDate, endDate);

    // Agrupar entradas por proyecto
    const projectSummaries = [];
    let totalHours = 0;
    let totalAmount = 0;

    // Procesar proyecto sin asignar (project_id = null)
    const unassignedEntries = entries.filter((entry: HourEntry) => entry.project_id === null);
    if (unassignedEntries.length > 0) {
      const projectHours = unassignedEntries.reduce((sum: number, entry: HourEntry) => sum + entry.hours, 0);
      const projectAmount = projectHours * hourlyRate;
      
      projectSummaries.push({
        project_id: null,
        project_name: 'Sin proyecto asignado',
        hours: projectHours,
        amount: projectAmount,
        descriptions: unassignedEntries
          .filter((entry: HourEntry) => entry.description && entry.description.trim())
          .map((entry: HourEntry) => `${entry.date}: ${entry.description}`)
      });
      
      totalHours += projectHours;
      totalAmount += projectAmount;
    }

    // Procesar proyectos específicos
    for (const project of projects) {
      const projectEntries = entries.filter((entry: HourEntry) => entry.project_id === project.id);
      if (projectEntries.length > 0) {
        const projectHours = projectEntries.reduce((sum: number, entry: HourEntry) => sum + entry.hours, 0);
        const projectAmount = projectHours * hourlyRate;
        
        projectSummaries.push({
          project_id: project.id,
          project_name: project.name,
          hours: projectHours,
          amount: projectAmount,
          descriptions: projectEntries
            .filter((entry: HourEntry) => entry.description && entry.description.trim())
            .map((entry: HourEntry) => `${entry.date}: ${entry.description}`)
        });
        
        totalHours += projectHours;
        totalAmount += projectAmount;
      }
    }

    const reportData = {
      company: {
        id: company.id,
        name: company.name
      },
      period: {
        start_date: startDate,
        end_date: endDate
      },
      projects: projectSummaries,
      summary: {
        total_hours: totalHours,
        total_amount: totalAmount,
        hourly_rate: hourlyRate
      }
    };

    return NextResponse.json({
      status: 'ok',
      data: reportData
    } as ApiResponse);

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}