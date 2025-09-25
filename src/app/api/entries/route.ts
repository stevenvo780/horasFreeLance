import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, initializeDatabase } from '@/lib/db';
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

    await initializeDatabase();
    const db = getDatabase();
    
  const body = await request.json();
  const { date, hours, mode = 'set', company_id, project_id = null, description = '' } = body;

    if (!date || typeof hours !== 'number' || !company_id) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: date, hours, company_id'
      } as ApiResponse, { status: 400 });
    }

    if (hours < 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Las horas deben ser positivas'
      } as ApiResponse, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({
        status: 'error',
        message: 'Formato de fecha inválido, usa YYYY-MM-DD'
      } as ApiResponse, { status: 400 });
    }

    // Validate mode
    if (!['set', 'accumulate', 'error'].includes(mode)) {
      return NextResponse.json({
        status: 'error',
        message: 'Modo inválido, usa: set, accumulate, error'
      } as ApiResponse, { status: 400 });
    }

    // Verify company ownership
    const company = await db.getCompanyById(company_id);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    let projectIdToUse: number | null = null;
    if (project_id != null) {
      const project = await db.getProjectById(project_id);
      if (!project || project.user_id !== userId || project.company_id !== company_id) {
        return NextResponse.json({
          status: 'error',
          message: 'Proyecto no encontrado o sin permisos'
        } as ApiResponse, { status: 404 });
      }
      projectIdToUse = project.id ?? null;
    }

    await db.addEntry(date, hours, description, company_id, projectIdToUse);

    const response: ApiResponse = {
      status: 'ok',
      message: `Entrada creada para ${date}`,
      changes: [{
        date,
        old_value: 0,
        new_value: hours
      }]
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

export async function PUT(request: NextRequest) {
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
    
    const body = await request.json();
    const { id, date, hours, description = '' } = body;
    const hasProjectId = Object.prototype.hasOwnProperty.call(body, 'project_id');
    const projectId = hasProjectId ? body.project_id : undefined;

    if (!id || !date || hours === undefined) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan parámetros requeridos: id, date, hours'
      } as ApiResponse, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json({
        status: 'error',
        message: 'Formato de fecha inválido, usa YYYY-MM-DD'
      } as ApiResponse, { status: 400 });
    }

    // Validate hours
    if (typeof hours !== 'number' || hours < 0 || hours > 24) {
      return NextResponse.json({
        status: 'error',
        message: 'Las horas deben ser un número entre 0 y 24'
      } as ApiResponse, { status: 400 });
    }

    // Verify entry exists and user has permission by getting all companies and their entries
    const companies = await db.getUserCompanies(userId);
    let targetEntry = null;
    let targetCompany = null;
    
    for (const company of companies) {
      if (company.id) {
        const entries = await db.getEntries(company.id);
        const entry = entries.find(e => e.id === id);
        if (entry) {
          targetEntry = entry;
          targetCompany = company;
          break;
        }
      }
    }
    
    if (!targetEntry || !targetCompany) {
      return NextResponse.json({
        status: 'error',
        message: 'Entrada no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    let projectIdToUse: number | null | undefined = projectId;
    if (hasProjectId) {
      if (projectId != null) {
        const project = await db.getProjectById(projectId);
        if (!project || project.user_id !== userId || project.company_id !== targetCompany.id) {
          return NextResponse.json({
            status: 'error',
            message: 'Proyecto no encontrado o sin permisos'
          } as ApiResponse, { status: 404 });
        }
        projectIdToUse = project.id ?? null;
      } else {
        projectIdToUse = null;
      }
    }

    await db.updateEntry(id, date, hours, description, projectIdToUse);

    const response: ApiResponse = {
      status: 'ok',
      message: `Entrada actualizada para ${date}`,
      changes: [{
        date,
        old_value: targetEntry.hours,
        new_value: hours
      }]
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

export async function DELETE(request: NextRequest) {
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
    
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({
        status: 'error',
        message: 'Falta parámetro requerido: id'
      } as ApiResponse, { status: 400 });
    }

    // Verify entry exists and user has permission by getting all companies and their entries
    const companies = await db.getUserCompanies(userId);
    let targetEntry = null;
    let targetCompany = null;
    
    for (const company of companies) {
      if (company.id) {
        const entries = await db.getEntries(company.id);
        const entry = entries.find(e => e.id === id);
        if (entry) {
          targetEntry = entry;
          targetCompany = company;
          break;
        }
      }
    }
    
    if (!targetEntry || !targetCompany) {
      return NextResponse.json({
        status: 'error',
        message: 'Entrada no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    await db.deleteEntry(id);

    const response: ApiResponse = {
      status: 'ok',
      message: `Entrada eliminada para ${targetEntry.date}`,
      changes: [{
        date: targetEntry.date,
        old_value: targetEntry.hours,
        new_value: 0
      }]
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