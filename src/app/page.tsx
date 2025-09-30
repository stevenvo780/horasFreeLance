'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Clock, DollarSign, TrendingUp,
  BarChart3, AlertCircle, CheckCircle,
  ArrowUp, ArrowDown, Minus, LogOut,
  Building2, Plus, Target, Zap
} from 'lucide-react';
import { HourEntry, Company, WeekdayAverage, Project } from '@/lib/types';
import { formatPrice, formatHours } from '@/lib/formatters';
import { 
  analyzeTrends, getMissingDaysThisWeek, getProductivityByWeekday, 
  formatHoursDiff 
} from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';
import BulkHoursTable from '@/components/BulkHoursTable';
import MonthlyReport from '@/components/MonthlyReport';

interface AppData {
  entries: HourEntry[];
  companies: Company[];
  projects: Project[];
  weekday_averages: WeekdayAverage[];
  total_hours: number;
  entry_count: number;
}

type ProjectHoursMetric = {
  projectId: number | null;
  name: string;
  hours: number;
  entries: number;
  percentage: number;
};

export default function Dashboard() {
  const { user, logout, authFetch, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bulk-table' | 'reports'>('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyRate, setNewCompanyRate] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [dashboardStartDate, setDashboardStartDate] = useState('');
  const [dashboardEndDate, setDashboardEndDate] = useState('');

  const selectedCompany = useMemo(() => {
    if (!data?.companies || selectedCompanyId == null) return null;
    return data.companies.find(company => company.id === selectedCompanyId) ?? null;
  }, [data?.companies, selectedCompanyId]);

  const projects = useMemo(() => data?.projects ?? [], [data?.projects]);

  const activeProjects = useMemo(() => {
    if (selectedCompanyId == null) return projects;
    return projects.filter(project => project.company_id === selectedCompanyId);
  }, [projects, selectedCompanyId]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    let entries = [...data.entries];

    if (dashboardStartDate) {
      entries = entries.filter(entry => entry.date >= dashboardStartDate);
    }

    if (dashboardEndDate) {
      entries = entries.filter(entry => entry.date <= dashboardEndDate);
    }

    return entries;
  }, [data?.entries, dashboardStartDate, dashboardEndDate]);

  const totalHours = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [filteredEntries]);

  const totalEntries = filteredEntries.length;

  const totalEarnings = selectedCompany?.hourly_rate
    ? filteredEntries.reduce((sum, entry) => sum + entry.hours * selectedCompany.hourly_rate, 0)
    : 0;

  const analytics = useMemo(() => {
    if (!filteredEntries.length || !selectedCompany?.hourly_rate) return null;
    return analyzeTrends(filteredEntries, selectedCompany.hourly_rate);
  }, [filteredEntries, selectedCompany?.hourly_rate]);

  const missingDays = useMemo(() => {
    if (!filteredEntries.length) return [];
    return getMissingDaysThisWeek(filteredEntries);
  }, [filteredEntries]);

  const productivityByWeekday = useMemo(() => {
    if (!filteredEntries.length) return [];
    return getProductivityByWeekday(filteredEntries);
  }, [filteredEntries]);

  const hasCustomDateRange = dashboardStartDate !== '' || dashboardEndDate !== '';

  const { items: projectHoursMetrics, totalHours: projectHoursTotal } = useMemo(() => {
    const summary: { items: ProjectHoursMetric[]; totalHours: number } = {
      items: [],
      totalHours: 0,
    };

    if (!filteredEntries.length) {
      return summary;
    }

    let effectiveEntries = filteredEntries;

    if (!hasCustomDateRange) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const cutoff = new Date(today);
      cutoff.setMonth(cutoff.getMonth() - 1);
      cutoff.setHours(0, 0, 0, 0);

      effectiveEntries = filteredEntries.filter(entry => {
        const entryDate = new Date(`${entry.date}T00:00:00`);
        return entryDate >= cutoff && entryDate <= today;
      });
    }

    if (!effectiveEntries.length) {
      return summary;
    }

    const projectLookup = new Map(projects.map(project => [project.id, project]));
    const totals = new Map<string, Omit<ProjectHoursMetric, 'percentage'>>();

    for (const entry of effectiveEntries) {
      const key = entry.project_id != null ? entry.project_id.toString() : 'none';
      let bucket = totals.get(key);

      if (!bucket) {
        const projectName = entry.project_id != null
          ? projectLookup.get(entry.project_id)?.name ?? `Proyecto #${entry.project_id}`
          : 'Sin proyecto';

        bucket = {
          projectId: entry.project_id ?? null,
          name: projectName,
          hours: 0,
          entries: 0,
        };
      }

      bucket.hours += entry.hours;
      bucket.entries += 1;
      totals.set(key, bucket);
    }

    const totalHours = effectiveEntries.reduce((sum, entry) => sum + entry.hours, 0);

    const items: ProjectHoursMetric[] = Array.from(totals.values())
      .map(item => ({
        ...item,
        percentage: totalHours > 0 ? (item.hours / totalHours) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    return { items, totalHours };
  }, [filteredEntries, hasCustomDateRange, projects]);

  const projectHoursPeriodLabel = hasCustomDateRange ? 'Periodo filtrado' : 'Últimos 30 días';

  const fetchData = useCallback(async (companyIdOverride?: number | null) => {
    try {
      if (!isAuthenticated) return;

      setLoading(true);

      const effectiveCompanyId = companyIdOverride ?? selectedCompanyId ?? null;
      const url = effectiveCompanyId
        ? `/api/status?company_id=${effectiveCompanyId}`
        : '/api/status';

      const response = await authFetch(url);

      if (response.status === 401) {
        logout();
        return;
      }

      const result = await response.json();

      if (result.status === 'ok') {
        const payload: AppData = result.data;
        setData(payload);
        setError(null);

        const availableCompanies = payload.companies ?? [];
        let nextCompanyId = selectedCompanyId;

        if (availableCompanies.length === 0) {
          nextCompanyId = null;
        } else if (effectiveCompanyId && availableCompanies.some(company => company.id === effectiveCompanyId)) {
          nextCompanyId = effectiveCompanyId;
        } else if (nextCompanyId == null || !availableCompanies.some(company => company.id === nextCompanyId)) {
          nextCompanyId = availableCompanies[0]?.id ?? null;
        }

        if (nextCompanyId !== selectedCompanyId) {
          setSelectedCompanyId(nextCompanyId);
        }

        const availableProjects = payload.projects ?? [];
        const currentProject = selectedProjectId != null
          ? availableProjects.find(project => project.id === selectedProjectId)
          : null;

        let nextProjectId = selectedProjectId;

        if (!currentProject || (nextCompanyId != null && currentProject.company_id !== nextCompanyId)) {
          const fallbackProject = nextCompanyId != null
            ? availableProjects.find(project => project.company_id === nextCompanyId)
            : availableProjects[0];
          nextProjectId = fallbackProject?.id ?? null;
        }

        if (nextProjectId !== selectedProjectId) {
          setSelectedProjectId(nextProjectId);
        }
      } else {
        setError(result.message);
      }
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAuthenticated, logout, selectedCompanyId, selectedProjectId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [fetchData, isAuthenticated, selectedCompanyId]);

  const createCompany = async () => {
    if (!newCompanyName) return;
    
    try {
      const response = await authFetch('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ 
          name: newCompanyName,
          hourly_rate: newCompanyRate ? parseFloat(newCompanyRate) : undefined
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const createdCompanyId: number | null = result?.data?.id ?? null;
        setNewCompanyName('');
        setNewCompanyRate('');
        setShowNewCompanyForm(false);
        if (createdCompanyId != null) {
          setSelectedCompanyId(createdCompanyId);
        }
        await fetchData(createdCompanyId ?? undefined);
      }
    } catch (error) {
      console.error('Error creating company:', error);
    }
  };

  const createProject = async () => {
    const targetCompanyId = selectedCompany?.id ?? selectedCompanyId;
    if (!newProjectName.trim() || targetCompanyId == null) {
      return;
    }

    try {
      const response = await authFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjectName.trim(),
          company_id: targetCompanyId
        })
      });

      if (response.ok) {
        const result = await response.json();
        const createdProjectId: number | null = result?.data?.id ?? null;

        setNewProjectName('');
        setShowNewProjectForm(false);

        if (createdProjectId != null) {
          setSelectedProjectId(createdProjectId);
        }

        await fetchData(targetCompanyId);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleBulkSave = async (entries: Array<{date: string, hours: number, companyId: number, projectId: number | null, description?: string}>) => {
    if (!entries.length) {
      return;
    }

    try {
      // Procesar cada entrada individualmente con mejor manejo de errores
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const entry of entries) {
        try {
          const response = await authFetch('/api/entries', {
            method: 'POST',
            body: JSON.stringify({
              date: entry.date,
              hours: entry.hours,
              company_id: entry.companyId,
              project_id: entry.projectId,
              description: entry.description ?? ''
            })
          });
          
          const data = await response.json();
          
          if (response.ok && data.status === 'ok') {
            successCount++;
          } else {
            console.error('Error en entrada individual:', data);
            errorCount++;
          }
          
          results.push({ entry, response: data, success: response.ok });
        } catch (error) {
          console.error('Error procesando entrada:', entry, error);
          errorCount++;
          results.push({ entry, error, success: false });
        }
      }
      
      console.log(`Resultados del guardado masivo: ${successCount} exitosos, ${errorCount} errores`);
      
      if (errorCount > 0) {
        throw new Error(`Se guardaron ${successCount} de ${entries.length} entradas. ${errorCount} fallaron.`);
      }
      
      await fetchData();
    } catch (error) {
      console.error('Error en handleBulkSave:', error);
      throw error;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-800">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-800">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Función para renderizar icono de tendencia
  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-700" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-100 via-white to-gray-50 border-b border-gray-200 py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                }}
              >
                Panel de Control
              </h1>
              <p className="text-gray-800">
                Bienvenido, {user?.name}
                {selectedCompany && (
                  <span className="ml-2 text-gray-900">• {selectedCompany.name}</span>
                )}
              </p>
            </div>
            <button
              onClick={logout}
              className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Panel de Control
            </button>
            <button
              onClick={() => setActiveTab('bulk-table')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bulk-table'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Gestión de Registros
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Reportes PDF
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Filtros del Dashboard */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={dashboardStartDate}
                    onChange={(e) => setDashboardStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    max={dashboardEndDate || undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={dashboardEndDate}
                    onChange={(e) => setDashboardEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={dashboardStartDate || undefined}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setDashboardStartDate('');
                      setDashboardEndDate('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                    disabled={!dashboardStartDate && !dashboardEndDate}
                  >
                    Limpiar filtros
                  </button>
                </div>
                <div className="flex items-end">
                  <div className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 bg-gray-50">
                    <span className="font-semibold text-gray-900">{totalEntries}</span> {totalEntries === 1 ? 'registro' : 'registros'}
                    <span className="ml-2">· {formatHours(totalHours)} horas</span>
                  </div>
                </div>
                <div className="flex items-end">
                  <div className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 bg-gray-50">
                    Ingresos estimados: <span className="font-semibold text-gray-900">{formatPrice(totalEarnings)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen Principal */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-800">Total Horas</p>
                      <p className="text-2xl font-bold text-gray-900">{formatHours(totalHours)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-800">Días Registrados</p>
                      <p className="text-2xl font-bold text-gray-900">{totalEntries}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-yellow-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-800">Tarifa/Hora</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPrice(selectedCompany?.hourly_rate || 0, true)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-800">Ingresos Totales</p>
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(totalEarnings)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Horas por Proyecto */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center">
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                    <h3 className="ml-2 text-lg font-semibold text-gray-900">Horas por proyecto</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{projectHoursPeriodLabel}</p>
                </div>
                <div className="text-sm text-gray-700">
                  Total periodo:{' '}
                  <span className="font-semibold text-gray-900">{formatHours(projectHoursTotal)}</span>
                </div>
              </div>

              {projectHoursMetrics.length > 0 ? (
                <div className="space-y-4">
                  {projectHoursMetrics.map(metric => {
                    const isSelected = selectedProjectId != null && metric.projectId === selectedProjectId;
                    const widthPercentage = Math.min(100, metric.percentage > 0 ? Math.max(metric.percentage, 4) : 0);

                    return (
                      <div
                        key={`project-metric-${metric.projectId ?? 'none'}`}
                        className={`p-4 rounded-lg border transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50/80' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{metric.name}</p>
                            <p className="text-xs text-gray-600">
                              {metric.entries} {metric.entries === 1 ? 'registro' : 'registros'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">{formatHours(metric.hours)}</p>
                            <p className="text-xs text-gray-600">{metric.percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-indigo-400'}`}
                            style={{ width: `${widthPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6">
                  <AlertCircle className="h-5 w-5 text-gray-500 mr-3" />
                  <span>
                    No hay horas registradas {hasCustomDateRange ? 'para el periodo seleccionado' : 'en los últimos 30 días'}.
                  </span>
                </div>
              )}
            </div>

            {/* Análisis de Tendencias */}
            {analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Esta Semana vs Semana Pasada */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Análisis Semanal</h3>
                    <TrendIcon trend={analytics.weeklyTrend} />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">Esta semana</span>
                      <span className="font-bold text-blue-600">{formatHours(analytics.thisWeek.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">Semana pasada</span>
                      <span className="font-bold text-gray-700">{formatHours(analytics.lastWeek.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-gray-800">Diferencia</span>
                      <span className={`font-bold ${
                        analytics.weeklyTrend === 'up' ? 'text-green-600' : 
                        analytics.weeklyTrend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatHoursDiff(analytics.thisWeek.totalHours - analytics.lastWeek.totalHours)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">Días trabajados</span>
                      <span className="font-medium">
                        {analytics.thisWeek.workingDays} de 7 días
                      </span>
                    </div>
                  </div>
                </div>

                {/* Este Mes vs Mes Pasado */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Análisis Mensual</h3>
                    <TrendIcon trend={analytics.monthlyTrend} />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">Este mes</span>
                      <span className="font-bold text-blue-600">{formatHours(analytics.thisMonth.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">Mes pasado</span>
                      <span className="font-bold text-gray-700">{formatHours(analytics.lastMonth.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-gray-800">Diferencia</span>
                      <span className={`font-bold ${
                        analytics.monthlyTrend === 'up' ? 'text-green-600' : 
                        analytics.monthlyTrend === 'down' ? 'text-red-600' : 'text-gray-800'
                      }`}>
                        {formatHoursDiff(analytics.thisMonth.totalHours - analytics.lastMonth.totalHours)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">Promedio por día trabajado</span>
                      <span className="font-medium">
                        {formatHours(analytics.thisMonth.avgHoursPerWorkingDay)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Alertas y Recordatorios */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-orange-500" />
                  Alertas
                </h3>
                <div className="space-y-3">
                  {missingDays.length > 0 ? (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                      <p className="text-sm font-medium text-gray-900">
                        Días sin registrar esta semana: {missingDays.length}
                      </p>
                      <p className="text-xs text-gray-900 mt-1">
                        {missingDays.slice(0, 3).join(', ')}
                        {missingDays.length > 3 && ` y ${missingDays.length - 3} más`}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <p className="text-sm font-medium text-green-800">
                          ¡Todos los días registrados esta semana!
                        </p>
                      </div>
                    </div>
                  )}

                  {analytics && analytics.thisWeek.avgHoursPerWorkingDay < 6 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm font-medium text-yellow-800">
                        Promedio bajo esta semana
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        {formatHours(analytics.thisWeek.avgHoursPerWorkingDay)} por día trabajado
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Gestión de Empresas */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Building2 className="h-5 w-5 mr-2 text-gray-600" />
                    Empresas
                  </h3>
                  <button
                    onClick={() => setShowNewCompanyForm(!showNewCompanyForm)}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* Company Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Empresa Activa
                    </label>
                    <select
                      value={selectedCompanyId ?? ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : Number(e.target.value);
                        setSelectedCompanyId(value);

                        if (value != null) {
                          const projectsForCompany = (data?.projects ?? []).filter(project => project.company_id === value);
                          setSelectedProjectId(prev => {
                            if (prev != null && projectsForCompany.some(project => project.id === prev)) {
                              return prev;
                            }
                            return projectsForCompany[0]?.id ?? null;
                          });
                        } else {
                          setSelectedProjectId(null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Seleccionar empresa...</option>
                      {data?.companies?.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name} {company.hourly_rate ? `($${company.hourly_rate}/h)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* New Company Form */}
                  {showNewCompanyForm && (
                    <div className="border-t pt-4 space-y-3">
                      <input
                        type="text"
                        placeholder="Nombre de la empresa"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Tarifa por hora (opcional)"
                        value={newCompanyRate}
                        onChange={(e) => setNewCompanyRate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={createCompany}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                        >
                          Crear
                        </button>
                        <button
                          onClick={() => setShowNewCompanyForm(false)}
                          className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedCompany && (
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-800">
                          Proyectos de {selectedCompany.name}
                        </h4>
                        <button
                          onClick={() => {
                            if (!selectedCompany?.id) {
                              alert('Crea o selecciona una empresa antes de agregar proyectos.');
                              return;
                            }
                            setShowNewProjectForm(prev => !prev);
                          }}
                          className="px-3 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Nuevo proyecto
                        </button>
                      </div>

                      {activeProjects.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No hay proyectos registrados para esta empresa. Crea uno para poder asignar horas.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {activeProjects.map(project => (
                            <button
                              key={project.id}
                              onClick={() => {
                                if (project.id != null) {
                                  setSelectedProjectId(project.id);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                selectedProjectId === project.id
                                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200'
                              }`}
                            >
                              {project.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {showNewProjectForm && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
                          <div className="text-xs text-gray-600">
                            Empresa seleccionada: <span className="font-semibold text-gray-800">{selectedCompany.name}</span>
                          </div>
                          <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Nombre del proyecto"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={createProject}
                              disabled={!newProjectName.trim()}
                              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                              Crear proyecto
                            </button>
                            <button
                              onClick={() => {
                                setShowNewProjectForm(false);
                                setNewProjectName('');
                              }}
                              className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="pt-2 border-t">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setActiveTab('bulk-table')}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Gestionar Registros
                      </button>
                      <button
                        onClick={logout}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm flex items-center"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Salir
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estadísticas Rápidas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-purple-600" />
                  Estadísticas
                </h3>
                <div className="space-y-3">
                  {analytics && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-800">Ingresos esta semana</span>
                        <span className="font-bold text-green-600">
                          {formatPrice(analytics.thisWeek.totalEarnings)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-800">Ingresos este mes</span>
                        <span className="font-bold text-blue-600">
                          {formatPrice(analytics.thisMonth.totalEarnings)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-gray-800">Promedio diario</span>
                        <span className="font-medium">
                          {formatHours(analytics.thisMonth.avgHoursPerWorkingDay)}
                        </span>
                      </div>
                    </>
                  )}
                  {data && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-800">Total registros</span>
                      <span className="font-medium">{totalEntries}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Productividad por Día de la Semana */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                Productividad por Día de la Semana
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {productivityByWeekday.map((day, index) => {
                  const maxHours = Math.max(...productivityByWeekday.map(d => d.avgHours));
                  const heightPercentage = maxHours > 0 ? (day.avgHours / maxHours) * 100 : 0;
                  
                  return (
                    <div key={index} className="text-center">
                      <div className="h-24 flex items-end justify-center mb-2">
                        <div 
                          className="w-8 bg-indigo-500 rounded-t transition-all duration-300"
                          style={{ height: `${Math.max(heightPercentage, 5)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs font-medium text-gray-700 capitalize">
                        {WEEKDAY_NAMES_ES[index].slice(0, 3)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatHours(day.avgHours)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'bulk-table' && (
          <BulkHoursTable
            onSave={handleBulkSave}
            onRefresh={fetchData}
            existingEntries={data?.entries || []}
            companies={data?.companies || []}
            defaultCompanyId={selectedCompany?.id}
            projects={projects}
            defaultProjectId={selectedProjectId}
          />
        )}

        {activeTab === 'reports' && (
          <MonthlyReport
            companies={data?.companies || []}
          />
        )}
      </div>
    </div>
  );
}

const WEEKDAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];