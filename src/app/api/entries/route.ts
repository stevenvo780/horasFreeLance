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
    const { date, hours, mode = 'set', company_id, project_id = null, description = '' } = body;

    if (!date || typeof hours !== 'number' || !company_id) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: date, hours, company_id'
      } as ApiResponse, { status: 400 });
    }

    if (hours < 0 || hours > 24) {
      return NextResponse.json({
        status: 'error',
        message: 'Las horas deben ser un número entre 0 y 24'
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

    const hasProjectId = Object.prototype.hasOwnProperty.call(body, 'project_id');
    let projectIdToUse: number | null = null;

    if (hasProjectId && project_id != null) {
      const project = await db.getProjectById(project_id);
      if (!project || project.user_id !== userId || project.company_id !== company_id) {
        return NextResponse.json({
          status: 'error',
          message: 'Proyecto no encontrado o sin permisos'
        } as ApiResponse, { status: 404 });
      }
      projectIdToUse = project.id ?? null;
    } else if (hasProjectId && project_id == null) {
      projectIdToUse = null;
    }

    const normalizedDescription = description?.toString() ?? '';
    const existingEntry = await db.getEntryByDate(company_id, date, projectIdToUse ?? null);

    if (existingEntry) {
      if (mode === 'error') {
        return NextResponse.json({
          status: 'error',
          message: 'Ya existe una entrada para ese día'
        } as ApiResponse, { status: 409 });
      }

      const newHours = mode === 'accumulate' ? existingEntry.hours + hours : hours;
      if (newHours < 0 || newHours > 24) {
        return NextResponse.json({
          status: 'error',
          message: 'Las horas resultantes deben estar entre 0 y 24'
        } as ApiResponse, { status: 400 });
      }

      const nextDescription = normalizedDescription || existingEntry.description || '';
      await db.updateEntry(existingEntry.id!, date, newHours, nextDescription, projectIdToUse ?? existingEntry.project_id ?? null);

      return NextResponse.json({
        status: 'ok',
        message: `Entrada actualizada para ${date}`,
        changes: [{
          date,
          old_value: existingEntry.hours,
          new_value: newHours
        }]
      } as ApiResponse);
    }

    await db.addEntry(date, hours, normalizedDescription, company_id, projectIdToUse ?? null);

    return NextResponse.json({
      status: 'ok',
      message: `Entrada creada para ${date}`,
      changes: [{
        date,
        old_value: 0,
        new_value: hours
      }]
    } as ApiResponse);
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

  const db = getDatabase();
  await db.init();

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

    const targetEntry = await db.getEntryById(id);
    if (!targetEntry) {
      return NextResponse.json({
        status: 'error',
        message: 'Entrada no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    const targetCompany = await db.getCompanyById(targetEntry.company_id);
    if (!targetCompany || targetCompany.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Entrada no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    let projectIdToUse: number | null | undefined = undefined;
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

    const nextDescription = description?.toString() ?? targetEntry.description ?? '';
    await db.updateEntry(id, date, hours, nextDescription, projectIdToUse);

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

  const db = getDatabase();
  await db.init();

  const body = await request.json();
  const { id } = body;

    if (!id) {
      return NextResponse.json({
        status: 'error',
        message: 'Falta parámetro requerido: id'
      } as ApiResponse, { status: 400 });
    }

    const targetEntry = await db.getEntryById(id);
    if (!targetEntry) {
      return NextResponse.json({
        status: 'error',
        message: 'Entrada no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    const targetCompany = await db.getCompanyById(targetEntry.company_id);
    if (!targetCompany || targetCompany.user_id !== userId) {
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