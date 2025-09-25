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

    const url = new URL(request.url);
    const companyIdParam = url.searchParams.get('company_id');
    const companyId = companyIdParam ? Number(companyIdParam) : undefined;

    if (companyId) {
      const company = await db.getCompanyById(companyId);
      if (!company || company.user_id !== userId) {
        return NextResponse.json({
          status: 'error',
          message: 'Empresa no encontrada o sin permisos'
        } as ApiResponse, { status: 404 });
      }

      const projects = await db.getCompanyProjects(companyId);
      return NextResponse.json({
        status: 'ok',
        message: 'Proyectos obtenidos correctamente',
        data: projects
      } as ApiResponse);
    }

    const projects = await db.getUserProjects(userId);
    return NextResponse.json({
      status: 'ok',
      message: 'Proyectos obtenidos correctamente',
      data: projects
    } as ApiResponse);
  } catch (error) {
    console.error('Error getting projects:', error);
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

    await initializeDatabase();
    const db = getDatabase();

    const body = await request.json();
    const { name, company_id } = body ?? {};

    if (!name || !company_id) {
      return NextResponse.json({
        status: 'error',
        message: 'Faltan campos requeridos: name, company_id'
      } as ApiResponse, { status: 400 });
    }

    const company = await db.getCompanyById(company_id);
    if (!company || company.user_id !== userId) {
      return NextResponse.json({
        status: 'error',
        message: 'Empresa no encontrada o sin permisos'
      } as ApiResponse, { status: 404 });
    }

    const projectId = await db.createProject(name, company_id, userId);
    const project = await db.getProjectById(projectId);

    return NextResponse.json({
      status: 'ok',
      message: 'Proyecto creado correctamente',
      data: project
    } as ApiResponse, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Error interno del servidor'
    } as ApiResponse, { status: 500 });
  }
}
