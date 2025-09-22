'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Check, X } from 'lucide-react';
import { WEEKDAY_NAMES_ES } from '@/lib/types';
import { formatHours } from '@/lib/formatters';

interface DateRow {
  date: string;
  weekday: number;
  weekdayName: string;
  hours: number | null;
  isExisting: boolean;
}

interface BulkHoursTableProps {
  onSave: (entries: Array<{date: string, hours: number}>) => Promise<void>;
  onRefresh: () => void;
  existingEntries: Array<{date: string, hours: number}>;
}

export default function BulkHoursTable({ onSave, onRefresh, existingEntries }: BulkHoursTableProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRows, setDateRows] = useState<DateRow[]>([]);
  const [defaultHours, setDefaultHours] = useState<number>(8);
  const [loading, setLoading] = useState(false);

  // Generar filas de fechas
  const generateDateRows = () => {
    if (!startDate || !endDate) return;
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    if (start > end) {
      alert('La fecha inicial debe ser anterior a la fecha final');
      return;
    }
    
    const rows: DateRow[] = [];
    const existingMap = new Map(existingEntries.map(e => [e.date, e.hours]));
    
    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const dateStr = current.toISOString().split('T')[0];
      const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1; // Convert to ISO weekday
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

  // Aplicar horas por defecto a todos los días
  const applyDefaultToAll = () => {
    setDateRows(rows => 
      rows.map(row => ({ ...row, hours: defaultHours }))
    );
  };

  // Aplicar horas solo a días laborables (lunes a viernes)
  const applyToWeekdays = () => {
    setDateRows(rows => 
      rows.map(row => ({
        ...row,
        hours: row.weekday < 5 ? defaultHours : 0 // Lunes=0 a Viernes=4
      }))
    );
  };

  // Limpiar todos los valores
  const clearAll = () => {
    setDateRows(rows => 
      rows.map(row => ({ ...row, hours: 0 }))
    );
  };

  // Actualizar horas de una fila específica
  const updateRowHours = (index: number, hours: number) => {
    setDateRows(rows => {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], hours };
      return newRows;
    });
  };

  // Guardar todas las entradas
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
    } catch (error) {
      alert('Error al guardar las entradas');
    } finally {
      setLoading(false);
    }
  };

  const totalHours = dateRows.reduce((sum, row) => sum + (row.hours || 0), 0);
  const workingDays = dateRows.filter(row => row.hours && row.hours > 0).length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold mb-6 flex items-center">
        <Calendar className="h-6 w-6 mr-2" />
        Asignación Masiva de Horas
      </h3>
      
      {/* Controles de fecha */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            Generar Tabla
          </button>
        </div>
      </div>

      {/* Botones de acción rápida */}
      {dateRows.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
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

      {/* Tabla de fechas */}
      {dateRows.length > 0 && (
        <div className="space-y-4">
          {/* Resumen */}
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

          {/* Tabla */}
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

          {/* Botón guardar */}
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
        </div>
      )}
    </div>
  );
}