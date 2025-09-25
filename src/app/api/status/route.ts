import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
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

    await initializeDatabase();
    const db = getDatabase();
    
    // Get query parameters
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id');
    const companyIdNum = companyId ? parseInt(companyId) : undefined;

    // Verify company ownership if company_id is provided
    if (companyIdNum) {
      const company = await db.getCompanyById(companyIdNum);
      if (!company || company.user_id !== userId) {
        return NextResponse.json({
          status: 'error',
          message: 'Empresa no encontrada o sin permisos'
        } as ApiResponse, { status: 404 });
      }
    }
    
    // Get companies first
  const companies = await db.getUserCompanies(userId);
  const projects = await db.getUserProjects(userId);
    
    // If no company specified but user has companies, use the first one
    let selectedCompanyId = companyIdNum;
    if (!selectedCompanyId && companies.length > 0) {
      selectedCompanyId = companies[0].id!;
    }
    
    const [entries, weekdayAverages, totalHours] = selectedCompanyId ? await Promise.all([
      db.getEntries(selectedCompanyId),
      db.getWeekdayAverages(selectedCompanyId),
      db.getTotalHours(selectedCompanyId)
    ]) : [[], [], 0];

    const response: ApiResponse = {
      status: 'ok',
      message: 'Estado obtenido correctamente',
      data: {
        entries,
        companies,
        projects,
        weekday_averages: weekdayAverages,
        total_hours: totalHours,
        entry_count: entries.length
      }
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