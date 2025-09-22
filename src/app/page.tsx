'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Clock, DollarSign, TrendingUp, TrendingDown, 
  BarChart3, AlertCircle, CheckCircle, ExternalLink,
  Settings, Target, Zap, ArrowUp, ArrowDown, Minus, LogOut,
  Building2, Plus, Users
} from 'lucide-react';
import { HourEntry, Company, WeekdayAverage } from '@/lib/types';
import { formatPrice, formatHours } from '@/lib/formatters';
import { 
  analyzeTrends, getMissingDaysThisWeek, getProductivityByWeekday, 
  formatHoursDiff, formatPercentageDiff, TrendAnalysis 
} from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';
import BulkHoursTable from '@/components/BulkHoursTable';

interface AppData {
  entries: HourEntry[];
  companies: Company[];
  weekday_averages: WeekdayAverage[];
  total_hours: number;
  entry_count: number;
}

export default function Dashboard() {
  const { user, token, logout, getAuthHeaders, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bulk-table'>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyRate, setNewCompanyRate] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Calcular analytics con useMemo para optimizar rendimiento
  const analytics = useMemo(() => {
    if (!data?.entries || !selectedCompany?.hourly_rate) return null;
    return analyzeTrends(data.entries, selectedCompany.hourly_rate);
  }, [data?.entries, selectedCompany?.hourly_rate]);

  const missingDays = useMemo(() => {
    if (!data?.entries) return [];
    return getMissingDaysThisWeek(data.entries);
  }, [data?.entries]);

  const productivityByWeekday = useMemo(() => {
    if (!data?.entries) return [];
    return getProductivityByWeekday(data.entries);
  }, [data?.entries]);

  const fetchData = async () => {
    try {
      if (!isAuthenticated) return;
      
      const url = selectedCompany 
        ? `/api/status?company_id=${selectedCompany.id}`
        : '/api/status';
        
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        logout();
        return;
      }
      
      const result = await response.json();
      
      if (result.status === 'ok') {
        setData(result.data);
        
        // Set default company if none selected and companies exist
        if (!selectedCompany && result.data.companies?.length > 0) {
          setSelectedCompany(result.data.companies[0]);
        }
      } else {
        setError(result.message);
      }
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, selectedCompany]);

  const createCompany = async () => {
    if (!newCompanyName) return;
    
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          name: newCompanyName,
          hourly_rate: newCompanyRate ? parseFloat(newCompanyRate) : undefined
        })
      });
      
      if (response.ok) {
        setNewCompanyName('');
        setNewCompanyRate('');
        setShowNewCompanyForm(false);
        await fetchData();
      }
    } catch (error) {
      console.error('Error creating company:', error);
    }
  };

  const updateRate = async () => {
    if (!selectedCompany) return;
    
    try {
      // Here we would update the company's hourly rate
      // For now, we'll just refresh the data
      await fetchData();
    } catch {
      alert('Error al actualizar tarifa');
    }
  };

  const handleBulkSave = async (entries: Array<{date: string, hours: number}>) => {
    if (!selectedCompany) {
      throw new Error('Selecciona una empresa primero');
    }
    
    try {
      // Usar el endpoint de bulk entries pero enviando directamente las entradas
      const promises = entries.map(entry => 
        fetch('/api/entries', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...entry,
            company_id: selectedCompany.id
          })
        })
      );
      
      await Promise.all(promises);
      fetchData();
    } catch (error) {
      throw new Error('Error al guardar entradas masivas');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
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
          <p className="mt-4 text-gray-600">Cargando...</p>
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

  const totalEarnings = selectedCompany?.hourly_rate && data?.total_hours ? data.total_hours * selectedCompany.hourly_rate : 0;

  // Función para renderizar icono de tendencia
  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-700 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Panel de Control</h1>
              <p className="text-gray-300">
                Bienvenido, {user?.first_name} {user?.last_name}
                {selectedCompany && (
                  <span className="ml-2 text-blue-200">• {selectedCompany.name}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('bulk-table')}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              Ir a Gestión de Registros
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
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Panel de Control
            </button>
            <button
              onClick={() => setActiveTab('bulk-table')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bulk-table'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Gestión de Registros
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Resumen Principal */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Horas</p>
                      <p className="text-2xl font-bold text-gray-900">{formatHours(data?.total_hours || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Días Registrados</p>
                      <p className="text-2xl font-bold text-gray-900">{data?.entry_count || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-yellow-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Tarifa/Hora</p>
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
                      <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(totalEarnings)}</p>
                    </div>
                  </div>
                </div>
              </div>
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
                      <span className="text-gray-600">Esta semana</span>
                      <span className="font-bold text-blue-600">{formatHours(analytics.thisWeek.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Semana pasada</span>
                      <span className="font-bold text-gray-500">{formatHours(analytics.lastWeek.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-gray-600">Diferencia</span>
                      <span className={`font-bold ${
                        analytics.weeklyTrend === 'up' ? 'text-green-600' : 
                        analytics.weeklyTrend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatHoursDiff(analytics.thisWeek.totalHours - analytics.lastWeek.totalHours)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Días trabajados</span>
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
                      <span className="text-gray-600">Este mes</span>
                      <span className="font-bold text-blue-600">{formatHours(analytics.thisMonth.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Mes pasado</span>
                      <span className="font-bold text-gray-500">{formatHours(analytics.lastMonth.totalHours)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-gray-600">Diferencia</span>
                      <span className={`font-bold ${
                        analytics.monthlyTrend === 'up' ? 'text-green-600' : 
                        analytics.monthlyTrend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatHoursDiff(analytics.thisMonth.totalHours - analytics.lastMonth.totalHours)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Promedio por día trabajado</span>
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
                      <p className="text-sm font-medium text-orange-800">
                        Días sin registrar esta semana: {missingDays.length}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
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
                      value={selectedCompany?.id || ''}
                      onChange={(e) => {
                        const company = data?.companies.find(c => c.id === parseInt(e.target.value));
                        setSelectedCompany(company || null);
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
                        <span className="text-sm text-gray-600">Ingresos esta semana</span>
                        <span className="font-bold text-green-600">
                          {formatPrice(analytics.thisWeek.totalEarnings)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Ingresos este mes</span>
                        <span className="font-bold text-blue-600">
                          {formatPrice(analytics.thisMonth.totalEarnings)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-gray-600">Promedio diario</span>
                        <span className="font-medium">
                          {formatHours(analytics.thisMonth.avgHoursPerWorkingDay)}
                        </span>
                      </div>
                    </>
                  )}
                  {data && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total registros</span>
                      <span className="font-medium">{data.entry_count}</span>
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
          />
        )}
      </div>
    </div>
  );
}

const WEEKDAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];