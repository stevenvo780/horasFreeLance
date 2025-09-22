'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Check, X, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_NAMES_ES } from '@/lib/types';
import { formatHours } from '@/lib/formatters';

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
  existingEntries: Array<{date: string, hours: number}>;
}

export default function BulkHoursTable({ onSave, onRefresh, existingEntries }: BulkHoursTableProps) {
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
  
  // Modo de vista
  const [viewMode, setViewMode] = useState<'list' | 'bulk'>('list');

  // Convertir entradas existentes a formato interno
  useEffect(() => {
    const formattedEntries: HourEntry[] = existingEntries.map((entry, index) => {
      const date = new Date(entry.date + 'T00:00:00');
      const weekday = date.getDay() === 0 ? 6 : date.getDay() - 1;
      
      return {
        id: index,
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
      // Aquí iría la llamada a la API para actualizar
      await onSave([{ date: editingEntry.date, hours: editingEntry.hours }]);
      setEditingEntry(null);
      onRefresh();
    } catch (error) {
      alert('Error al actualizar la entrada');
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
      // Aquí iría la llamada a la API para eliminar
      // Por ahora simularemos eliminando con horas = 0
      await onSave([{ date: entry.date, hours: 0 }]);
      onRefresh();
    } catch (error) {
      alert('Error al eliminar la entrada');
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
    } catch (error) {
      alert('Error al agregar la entrada');
    } finally {
      setLoading(false);
    }
  };

  // Función para modo bulk (asignación masiva)
  const generateBulkEntries = () => {
    if (!startDate || !endDate) {
      alert('Por favor selecciona un rango de fechas');
      return;
    }
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    if (start > end) {
      alert('La fecha inicial debe ser anterior a la fecha final');
      return;
    }
    
    // Cambiar a modo bulk y generar entradas para el rango
    setViewMode('bulk');
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
        
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('bulk')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'bulk' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Asignación Masiva
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Registros por página</label>
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
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
          >
            Limpiar Filtros
          </button>
        </div>
        {viewMode === 'list' && (
          <div className="flex items-end">
            <button
              onClick={generateBulkEntries}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
            >
              Asignación Masiva
            </button>
          </div>
        )}
      </div>

      {viewMode === 'list' && (
        <>
          {/* Estadísticas */}
          <div className="bg-gray-50 p-4 rounded-md grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{stats.totalDays}</div>
              <div className="text-sm text-gray-600">Total registros</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{formatHours(stats.totalHours)}</div>
              <div className="text-sm text-gray-600">Total horas</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{formatHours(stats.avgHours)}</div>
              <div className="text-sm text-gray-600">Promedio horas/día</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{totalPages}</div>
              <div className="text-sm text-gray-600">Páginas</div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
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
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Día</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Horas</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Acciones</th>
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
                            className="text-gray-600 hover:text-gray-800 disabled:text-gray-400"
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
              <div className="text-sm text-gray-600">
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
                
                <span className="px-3 py-1 text-sm text-gray-600">
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
            <div className="text-center py-8 text-gray-500">
              No hay registros que coincidan con los filtros seleccionados
            </div>
          )}
        </>
      )}

      {viewMode === 'bulk' && (
        <BulkAssignmentMode 
          startDate={startDate}
          endDate={endDate}
          existingEntries={existingEntries}
          onSave={onSave}
          onRefresh={onRefresh}
          onBack={() => setViewMode('list')}
        />
      )}
    </div>
  );
}

// Componente separado para el modo de asignación masiva
interface BulkAssignmentModeProps {
  startDate: string;
  endDate: string;
  existingEntries: Array<{date: string, hours: number}>;
  onSave: (entries: Array<{date: string, hours: number}>) => Promise<void>;
  onRefresh: () => void;
  onBack: () => void;
}

function BulkAssignmentMode({ startDate, endDate, existingEntries, onSave, onRefresh, onBack }: BulkAssignmentModeProps) {
  const [dateRows, setDateRows] = useState<Array<{date: string, weekday: number, weekdayName: string, hours: number | null, isExisting: boolean}>>([]);
  const [defaultHours, setDefaultHours] = useState<number>(8);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (startDate && endDate) {
      generateDateRows();
    }
  }, [startDate, endDate, existingEntries]);

  const generateDateRows = () => {
    if (!startDate || !endDate) return;
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    const rows: Array<{date: string, weekday: number, weekdayName: string, hours: number | null, isExisting: boolean}> = [];
    const existingMap = new Map(existingEntries.map(e => [e.date, e.hours]));
    
    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const dateStr = current.toISOString().split('T')[0];
      const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1;
      const existingHours = existingMap.get(dateStr);
      
      rows.push({
        date: dateStr,
        weekday,
        weekdayName: WEEKDAY_NAMES_ES[weekday],
        hours: existingHours ?? defaultHours,
        isExisting: existingHours !== undefined
      });
    }
    
    setDateRows(rows);
  };

  const applyDefaultToAll = () => {
    setDateRows(rows => 
      rows.map(row => ({ ...row, hours: defaultHours }))
    );
  };

  const applyToWeekdays = () => {
    setDateRows(rows => 
      rows.map(row => ({
        ...row,
        hours: row.weekday < 5 ? defaultHours : 0
      }))
    );
  };

  const clearAll = () => {
    setDateRows(rows => 
      rows.map(row => ({ ...row, hours: 0 }))
    );
  };

  const updateRowHours = (index: number, hours: number) => {
    setDateRows(rows => {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], hours };
      return newRows;
    });
  };

  const handleSave = async () => {
    const entriesToSave = dateRows
      .filter(row => row.hours !== null && row.hours > 0)
      .map(row => ({ date: row.date, hours: row.hours! }));
    
    if (entriesToSave.length === 0) {
      alert('No hay entradas válidas para guardar');
      return;
    }
    
    setLoading(true);
    try {
      await onSave(entriesToSave);
      onRefresh();
      alert(`Se guardaron ${entriesToSave.length} entradas`);
      onBack();
    } catch (error) {
      alert('Error al guardar las entradas');
    } finally {
      setLoading(false);
    }
  };

  const totalHours = dateRows.reduce((sum, row) => sum + (row.hours || 0), 0);
  const workingDays = dateRows.filter(row => row.hours && row.hours > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Asignación Masiva de Horas</h4>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          ← Volver a Lista
        </button>
      </div>

      {/* Controles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Horas por defecto</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={defaultHours}
            onChange={(e) => setDefaultHours(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={generateDateRows}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Regenerar Tabla
          </button>
        </div>
      </div>

      {/* Botones de acción rápida */}
      {dateRows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={applyDefaultToAll}
            className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-sm"
          >
            Aplicar {defaultHours}h a todos
          </button>
          <button
            onClick={applyToWeekdays}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm"
          >
            Solo días laborables
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Estadísticas */}
      {dateRows.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-md grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{workingDays}</div>
            <div className="text-sm text-gray-600">Días con horas</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{formatHours(totalHours)}</div>
            <div className="text-sm text-gray-600">Total horas</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{dateRows.length}</div>
            <div className="text-sm text-gray-600">Días en rango</div>
          </div>
        </div>
      )}

      {/* Tabla de asignación masiva */}
      {dateRows.length > 0 && (
        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Fecha</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Día</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Horas</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {dateRows.map((row, index) => (
                <tr key={row.date} className={`border-b ${row.weekday >= 5 ? 'bg-blue-50' : ''}`}>
                  <td className="py-2 px-3 font-mono text-sm">{row.date}</td>
                  <td className="py-2 px-3">
                    <span className={`capitalize font-medium ${
                      row.weekday >= 5 ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {row.weekdayName}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={row.hours || ''}
                      onChange={(e) => updateRowHours(index, parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    {row.isExisting ? (
                      <span className="inline-flex items-center text-amber-600">
                        <Clock className="h-4 w-4 mr-1" />
                        <span className="text-xs">Existe</span>
                      </span>
                    ) : row.hours && row.hours > 0 ? (
                      <span className="inline-flex items-center text-green-600">
                        <Check className="h-4 w-4 mr-1" />
                        <span className="text-xs">Nuevo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-gray-400">
                        <X className="h-4 w-4 mr-1" />
                        <span className="text-xs">Vacío</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Botón guardar */}
      {dateRows.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading || workingDays === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
            Guardar {workingDays} entradas
          </button>
        </div>
      )}

      {!startDate || !endDate ? (
        <div className="text-center py-8 text-gray-500">
          Por favor selecciona un rango de fechas en los filtros superiores para generar la tabla de asignación masiva
        </div>
      ) : null}
    </div>
  );
}