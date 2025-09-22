'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, DollarSign, TrendingUp, Plus } from 'lucide-react';
import { HourEntry, Settings, WeekdayAverage, WEEKDAY_NAMES_ES } from '@/lib/types';
import { formatPrice, formatHours } from '@/lib/formatters';
import BulkHoursTable from '@/components/BulkHoursTable';

interface AppData {
  entries: HourEntry[];
  settings: Settings;
  weekday_averages: WeekdayAverage[];
  total_hours: number;
  entry_count: number;
}

export default function Dashboard() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bulk-table'>('dashboard');

  // Form states
  const [newEntry, setNewEntry] = useState({ date: '', hours: '' });
  const [hourlyRate, setHourlyRate] = useState('');

  const fetchData = async () => {
    try {
      const response = await fetch('/api/status');
      const result = await response.json();
      
      if (result.status === 'ok') {
        setData(result.data);
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
    fetchData();
  }, []);

  const addEntry = async () => {
    if (!newEntry.date || !newEntry.hours) return;
    
    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newEntry.date,
          hours: parseFloat(newEntry.hours)
        })
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        setNewEntry({ date: '', hours: '' });
        fetchData();
      } else {
        alert(result.message);
      }
    } catch {
      alert('Error al agregar entrada');
    }
  };

  const updateRate = async () => {
    if (!hourlyRate) return;
    
    try {
      const response = await fetch('/api/settings/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: parseFloat(hourlyRate) })
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        setHourlyRate('');
        fetchData();
      } else {
        alert(result.message);
      }
    } catch {
      alert('Error al actualizar tarifa');
    }
  };

  const handleBulkSave = async (entries: Array<{date: string, hours: number}>) => {
    try {
      // Usar el endpoint de bulk entries pero enviando directamente las entradas
      const promises = entries.map(entry => 
        fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        })
      );
      
      await Promise.all(promises);
      fetchData();
    } catch (error) {
      throw new Error('Error al guardar entradas masivas');
    }
  };

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

  const totalEarnings = data?.settings.hourly_rate ? data.total_hours * data.settings.hourly_rate : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-700 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">Horas Freelance</h1>
          <p className="text-gray-300">Registra jornadas, rellena olvidos con promedios y calcula el ingreso estimado.</p>
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
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('bulk-table')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bulk-table'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tabla Masiva
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Horas</p>
                <p className="text-2xl font-bold text-gray-900">{formatHours(data?.total_hours || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Días Registrados</p>
                <p className="text-2xl font-bold text-gray-900">{data?.entry_count || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tarifa/Hora</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(data?.settings.hourly_rate || 0, true)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ingresos Estimados</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(totalEarnings)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Add Single Entry */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Registrar Horas
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newEntry.hours}
                    onChange={(e) => setNewEntry({...newEntry, hours: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={addEntry}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Agregar Entrada
                </button>
              </div>
            </div>

            {/* Set Hourly Rate */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Configurar Tarifa
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa por Hora ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder={data?.settings.hourly_rate?.toString() || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={updateRate}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Actualizar Tarifa
                </button>
              </div>
            </div>

            {/* Weekday Averages */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Promedios por Día</h3>
              <div className="space-y-2">
                {WEEKDAY_NAMES_ES.map((dayName, index) => {
                  const average = data?.weekday_averages.find(avg => avg.weekday === index);
                  return (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <span className="capitalize font-medium">{dayName}</span>
                      <span className="text-gray-600">
                        {average ? `${average.average}h (${average.entry_count} días)` : 'Sin datos'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Entries */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Entradas Recientes</h3>
              <div className="max-h-64 overflow-y-auto">
                {data?.entries.slice(-10).reverse().map((entry, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="font-medium">{entry.date}</span>
                    <span className="text-gray-600">{entry.hours}h</span>
                  </div>
                ))}
                {!data?.entries.length && (
                  <p className="text-gray-500 text-center py-4">No hay entradas registradas</p>
                )}
              </div>
            </div>
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