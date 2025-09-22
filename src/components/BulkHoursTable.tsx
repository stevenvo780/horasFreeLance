'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Check, X, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_NAMES_ES } from '@/lib/types';
import { formatHours } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';

interface HourEntry {
  id?: number;
  date: string;
  hours: number;
  weekday: number;
  weekdayName: string;
  isEditing?: boolean;
}

interface BulkHoursTableProps {
  onSave: (entries: Array<{date: string, hours: number}>) => Promise<void>;
  onRefresh: () => void;
  existingEntries: Array<{id?: number, date: string, hours: number}>;
}

export default function BulkHoursTable({ onSave, onRefresh, existingEntries }: BulkHoursTableProps) {
  // Hook de autenticación
  const { getAuthHeaders } = useAuth();
  
  // Filtros y paginación
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Estados CRUD
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<HourEntry | null>(null);
  const [newEntry, setNewEntry] = useState<{ date: string; hours: string }>({ date: '', hours: '' });
  const [loading, setLoading] = useState(false);
  
  // Estado para asignación masiva
  const [showBulkMode, setShowBulkMode] = useState(false);

  // Convertir entradas existentes a formato interno
  useEffect(() => {
    const formattedEntries: HourEntry[] = existingEntries.map((entry, index) => {
      const date = new Date(entry.date + 'T00:00:00');
      const weekday = date.getDay() === 0 ? 6 : date.getDay() - 1;
      
      return {
        id: entry.id ?? index, // Usar el ID real si existe, sino el índice
        date: entry.date,
        hours: entry.hours,
        weekday,
        weekdayName: WEEKDAY_NAMES_ES[weekday],
        isEditing: false
      };
    });
    
    setEntries(formattedEntries);
  }, [existingEntries]);

  // Filtrar entradas por fecha
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];
    
    if (startDate) {
      filtered = filtered.filter(entry => entry.date >= startDate);
    }
    
    if (endDate) {
      filtered = filtered.filter(entry => entry.date <= endDate);
    }
    
    // Ordenar por fecha descendente (más recientes primero)
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    
    return filtered;
  }, [entries, startDate, endDate]);

  // Paginación
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage);

  // Estadísticas
  const stats = useMemo(() => {
    const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalDays = filteredEntries.length;
    const avgHours = totalDays > 0 ? totalHours / totalDays : 0;
    
    return { totalHours, totalDays, avgHours };
  }, [filteredEntries]);

  // Funciones CRUD
  const handleEdit = (entry: HourEntry) => {
    setEditingEntry({ ...entry });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    
    setLoading(true);
    try {
      // Usar el endpoint PUT para actualizar la entrada existente
      const response = await fetch('/api/entries', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: editingEntry.id,
          date: editingEntry.date,
          hours: editingEntry.hours,
          description: ''
        }),
      });

      const data = await response.json();
      
      if (data.status !== 'ok') {
        throw new Error(data.message || 'Error al actualizar la entrada');
      }

      setEditingEntry(null);
      onRefresh(); // Refrescar datos desde el servidor
    } catch (error) {
      alert('Error al actualizar la entrada: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entry: HourEntry) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la entrada del ${entry.date}?`)) {
      return;
    }
    
    setLoading(true);
    try {
      // Usar el endpoint DELETE para eliminar la entrada
      const response = await fetch('/api/entries', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: entry.id
        }),
      });

      const data = await response.json();
      
      if (data.status !== 'ok') {
        throw new Error(data.message || 'Error al eliminar la entrada');
      }

      onRefresh(); // Refrescar datos desde el servidor
    } catch (error) {
      alert('Error al eliminar la entrada: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newEntry.date || !newEntry.hours) {
      alert('Por favor completa todos los campos');
      return;
    }
    
    const hours = parseFloat(newEntry.hours);
    if (hours <= 0) {
      alert('Las horas deben ser mayor que 0');
      return;
    }
    
    setLoading(true);
    try {
      await onSave([{ date: newEntry.date, hours }]);
      setNewEntry({ date: '', hours: '' });
      onRefresh();
    } catch (err) {
      console.error('Error al agregar la entrada:', err);
      alert('Error al agregar la entrada');
    } finally {
      setLoading(false);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, itemsPerPage]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold flex items-center">
          <Calendar className="h-6 w-6 mr-2" />
          Gestión de Registros de Horas
        </h3>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Fecha Inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Fecha Fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Registros por página</label>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="w-full bg-gray-100 text-gray-900 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
          >
            Limpiar Filtros
          </button>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => setShowBulkMode(true)}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
          >
            Asignación Masiva
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="bg-gray-50 p-4 rounded-md grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{stats.totalDays}</div>
              <div className="text-sm text-gray-900">Total registros</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{formatHours(stats.totalHours)}</div>
              <div className="text-sm text-gray-900">Total horas</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{formatHours(stats.avgHours)}</div>
              <div className="text-sm text-gray-900">Promedio horas/día</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{totalPages}</div>
              <div className="text-sm text-gray-900">Páginas</div>
            </div>
          </div>

          {/* Formulario para agregar nueva entrada */}
          <div className="bg-blue-50 p-4 rounded-md mb-6">
            <h4 className="text-md font-semibold mb-3 flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Agregar Nueva Entrada
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Fecha</label>
                <input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Horas</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={newEntry.hours}
                  onChange={(e) => setNewEntry({ ...newEntry, hours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de entradas */}
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Día</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Horas</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntries.map((entry) => (
                  <tr key={entry.id || entry.date} className={`border-b ${entry.weekday >= 5 ? 'bg-blue-50' : ''}`}>
                    <td className="py-3 px-4 font-mono text-sm">{entry.date}</td>
                    <td className="py-3 px-4">
                      <span className={`capitalize font-medium ${
                        entry.weekday >= 5 ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {entry.weekdayName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {editingEntry?.id === entry.id ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={editingEntry?.hours || 0}
                          onChange={(e) => {
                            if (editingEntry) {
                              setEditingEntry({ ...editingEntry, hours: parseFloat(e.target.value) || 0 });
                            }
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{formatHours(entry.hours)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {editingEntry?.id === entry.id ? (
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={loading}
                            className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                            title="Guardar"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={loading}
                            className="text-gray-900 hover:text-gray-900 disabled:text-gray-400"
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleEdit(entry)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-900">
                Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredEntries.length)} de {filteredEntries.length} registros
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="px-3 py-1 text-sm text-gray-900">
                  Página {currentPage} de {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {filteredEntries.length === 0 && (
            <div className="text-center py-8 text-gray-900">
              No hay registros que coincidan con los filtros seleccionados
            </div>
          )}

          {/* Modal de Asignación Masiva */}
          {showBulkMode && (
            <BulkAssignmentModal 
              startDate={startDate}
              endDate={endDate}
              existingEntries={entries}
              onSave={onSave}
              onRefresh={onRefresh}
              onClose={() => setShowBulkMode(false)}
            />
          )}

    </div>
  );
}

// Componente Modal para Asignación Masiva
interface BulkEntry {
  id: number | string;
  date: string;
  hours: number;
  description: string;
  company_id: number;
  hourly_rate: number;
}

interface BulkAssignmentModalProps {
  startDate: string;
  endDate: string;
  existingEntries: HourEntry[];
  onSave: (entries: Array<{date: string, hours: number}>) => Promise<void>;
  onRefresh: () => void;
  onClose: () => void;
}

function BulkAssignmentModal({ 
  startDate, 
  endDate, 
  existingEntries, 
  onSave, 
  onRefresh, 
  onClose 
}: BulkAssignmentModalProps) {
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleBulkSave = async () => {
    setIsLoading(true);
    try {
      const validEntries = bulkEntries.filter(entry => 
        entry.hours > 0 || entry.description.trim() !== ''
      );
      
      if (validEntries.length > 0) {
        // Convertir al formato esperado por onSave
        const saveEntries = validEntries.map(entry => ({
          date: entry.date,
          hours: entry.hours
        }));
        
        await onSave(saveEntries);
        onRefresh();
        onClose();
      }
    } catch (error) {
      console.error('Error saving bulk entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBulkEntry = (index: number, field: keyof BulkEntry, value: string | number) => {
    setBulkEntries(prev => prev.map((entry, i) => 
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const fillAverageHours = () => {
    // Calcular promedio de las entradas existentes
    const existingHours = existingEntries
      .filter(entry => entry.hours > 0)
      .map(entry => entry.hours);
    
    if (existingHours.length > 0) {
      const average = existingHours.reduce((a, b) => a + b, 0) / existingHours.length;
      const roundedAverage = Math.round(average * 2) / 2; // Redondear a 0.5
      
      setBulkEntries(prev => prev.map(entry => ({
        ...entry,
        hours: roundedAverage
      })));
    }
  };

  const regenerateBulkEntries = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const entries: BulkEntry[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // Verificar si ya existe una entrada para esta fecha
      const existingEntry = existingEntries.find(entry => entry.date === dateStr);
      
      if (!existingEntry) {
        entries.push({
          id: '',
          date: dateStr,
          hours: 0,
          description: '',
          company_id: 1,
          hourly_rate: 25
        });
      }
    }
    
    setBulkEntries(entries);
  };

  // Generar entradas al abrir el modal
  React.useEffect(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const entries: BulkEntry[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // Verificar si ya existe una entrada para esta fecha
      const existingEntry = existingEntries.find(entry => entry.date === dateStr);
      
      if (!existingEntry) {
        entries.push({
          id: '',
          date: dateStr,
          hours: 0,
          description: '',
          company_id: 1,
          hourly_rate: 25
        });
      }
    }
    
    setBulkEntries(entries);
  }, [startDate, endDate, existingEntries]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Asignación Masiva de Horas</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={fillAverageHours}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Rellenar con Promedio
          </button>
          <button
            onClick={regenerateBulkEntries}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Regenerar Fechas
          </button>
        </div>

        {bulkEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No hay fechas disponibles para asignación masiva.
            Todas las fechas ya tienen entradas.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {bulkEntries.map((entry, index) => (
                <div key={index} className="border rounded p-3">
                  <div className="font-semibold mb-2">
                    {new Date(entry.date).toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </div>
                  
                  <div className="space-y-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={entry.hours}
                      onChange={(e) => updateBulkEntry(index, 'hours', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border rounded"
                      placeholder="Horas"
                    />
                    
                    <textarea
                      value={entry.description}
                      onChange={(e) => updateBulkEntry(index, 'description', e.target.value)}
                      className="w-full p-2 border rounded resize-none"
                      rows={2}
                      placeholder="Descripción..."
                    />
                    
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.hourly_rate}
                      onChange={(e) => updateBulkEntry(index, 'hourly_rate', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border rounded"
                      placeholder="Tarifa por hora"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkSave}
                disabled={isLoading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {isLoading ? 'Guardando...' : 'Guardar Todo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}