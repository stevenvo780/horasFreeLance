'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Check, X, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_NAMES_ES, Company, Project } from '@/lib/types';
import { formatHours } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';

interface HourEntry {
  id?: number;
  date: string;
  hours: number;
  weekday: number;
  weekdayName: string;
  isEditing?: boolean;
  description?: string;
  companyId?: number | null;
  projectId?: number | null;
}

interface BulkHoursTableProps {
  onSave: (entries: Array<{date: string, hours: number, companyId: number, projectId: number | null, description?: string}>) => Promise<void>;
  onRefresh: () => void;
  existingEntries: Array<{id?: number, date: string, hours: number, description?: string, company_id?: number, project_id?: number | null}>;
  companies: Company[];
  defaultCompanyId?: number;
  projects: Project[];
  defaultProjectId?: number | null;
}

const normalizeStartOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toISODate = (value: Date) => normalizeStartOfDay(value).toISOString().split('T')[0];

const getMonday = (value: Date) => {
  const date = normalizeStartOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Ajustar para lunes como inicio
  date.setDate(date.getDate() + diff);
  return date;
};

const getSunday = (value: Date) => {
  const monday = getMonday(value);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return normalizeStartOfDay(sunday);
};

export default function BulkHoursTable({ onSave, onRefresh, existingEntries, companies, defaultCompanyId, projects, defaultProjectId }: BulkHoursTableProps) {
  // Hook de autenticación
  const { authFetch } = useAuth();
  
  // Filtros y paginación
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Estados CRUD
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<HourEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState<{ hours: string; projectId: number | ''; description: string }>({
    hours: '',
    projectId: '',
    description: ''
  });
  const [newEntry, setNewEntry] = useState<{ date: string; hours: string; projectId: number | '' }>({
    date: '',
    hours: '',
    projectId: defaultProjectId ?? ''
  });
  const [loading, setLoading] = useState(false);
  
  // Estado para asignación masiva
  const [showBulkMode, setShowBulkMode] = useState(false);

  const projectById = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((project) => {
      if (project.id != null) {
        map.set(project.id, project);
      }
    });
    return map;
  }, [projects]);

  const projectOptions = useMemo<Project[]>(() => projects.filter((project) => project.id != null), [projects]);

  const companyNameById = useMemo(() => {
    const map = new Map<number, string>();
    companies.forEach((company) => {
      if (company.id != null) {
        map.set(company.id, company.name);
      }
    });
    return map;
  }, [companies]);

  const effectiveDefaultProjectId = useMemo(() => {
    if (defaultProjectId != null) {
      return defaultProjectId;
    }
    const firstProject = projects.find((project) => project.id != null);
    return firstProject?.id ?? null;
  }, [defaultProjectId, projects]);

  useEffect(() => {
    setNewEntry((prev) => ({
      ...prev,
      projectId: prev.projectId === '' ? (effectiveDefaultProjectId ?? '') : prev.projectId
    }));
  }, [effectiveDefaultProjectId]);

  const effectiveDefaultCompanyId = useMemo(() => {
    if (defaultCompanyId) {
      return defaultCompanyId;
    }

    if (effectiveDefaultProjectId != null) {
      const project = projects.find((item) => item.id === effectiveDefaultProjectId);
      if (project) {
        return project.company_id;
      }
    }

    const fallbackProject = projects.find((project) => project.id != null);
    if (fallbackProject) {
      return fallbackProject.company_id;
    }

    const firstCompany = companies.find((company) => company.id != null);
    return firstCompany?.id ?? null;
  }, [companies, defaultCompanyId, effectiveDefaultProjectId, projects]);

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
        isEditing: false,
        description: entry.description ?? '',
        companyId: entry.company_id,
        projectId: entry.project_id ?? null
      };
    });
    
    setEntries(formattedEntries);
    setSelectedIds(new Set());
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

  // Selección múltiple
  const pageIds = useMemo(() => paginatedEntries.map((e) => e.id).filter((id): id is number => typeof id === 'number'), [paginatedEntries]);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };
  const toggleSelect = (id?: number) => {
    if (typeof id !== 'number') return; // No permitir selección sin ID real
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Estadísticas
  const stats = useMemo(() => {
    const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalDays = filteredEntries.length;
    const avgHours = totalDays > 0 ? totalHours / totalDays : 0;
    
    return { totalHours, totalDays, avgHours };
  }, [filteredEntries]);

  // Funciones CRUD
  const handleEdit = (entry: HourEntry) => {
    setEditingEntry({
      ...entry,
      projectId: entry.projectId ?? null,
      companyId: entry.companyId ?? null
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    if (editingEntry.projectId == null) {
      alert('Selecciona un proyecto antes de guardar la entrada.');
      return;
    }
    
    setLoading(true);
    try {
      // Usar el endpoint PUT para actualizar la entrada existente
      const response = await authFetch('/api/entries', {
        method: 'PUT',
        body: JSON.stringify({
          id: editingEntry.id,
          date: editingEntry.date,
          hours: editingEntry.hours,
          description: editingEntry.description ?? '',
          project_id: editingEntry.projectId ?? null
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
      const response = await authFetch('/api/entries', {
        method: 'DELETE',
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

  // Eliminación múltiple
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} registros seleccionados?`)) return;

    setLoading(true);
    try {
      let success = 0;
      for (const entry of entries) {
        if (!entry.id || !selectedIds.has(entry.id)) continue;
        try {
          const response = await authFetch('/api/entries', {
            method: 'DELETE',
            body: JSON.stringify({ id: entry.id }),
          });
          const data = await response.json();
          if (data.status === 'ok') success++;
        } catch (error) {
          console.error('Error al eliminar registro en lote', error);
        }
      }
      if (success === 0) {
        alert('No se eliminaron registros.');
      }
      clearSelection();
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  // Edición múltiple
  const openBulkEdit = () => setBulkEditOpen(true);
  const closeBulkEdit = () => setBulkEditOpen(false);
  const applyBulkEdit = async () => {
    if (selectedIds.size === 0) return;
    // Si no se ingresó ningún cambio, no hacemos nada
    const hasHours = bulkEditValues.hours.trim() !== '';
    const hasProject = bulkEditValues.projectId !== '';
    const hasDescription = bulkEditValues.description.trim() !== '';
    if (!hasHours && !hasProject && !hasDescription) {
      alert('Ingresa al menos un cambio para aplicar.');
      return;
    }

    setLoading(true);
    try {
      let success = 0;
      for (const entry of entries) {
        if (!entry.id || !selectedIds.has(entry.id)) continue;
        const nextHours = hasHours ? parseFloat(bulkEditValues.hours) : entry.hours;
        if (!Number.isFinite(nextHours)) continue;
        const nextDescription = hasDescription ? bulkEditValues.description : (entry.description ?? '');
        const payload: {
          id: number;
          date: string;
          hours: number;
          description: string;
          project_id?: number | null;
        } = {
          id: entry.id,
          date: entry.date,
          hours: nextHours,
          description: nextDescription,
        };
        if (hasProject) {
          payload.project_id = bulkEditValues.projectId === '' ? null : Number(bulkEditValues.projectId);
        }
        try {
          const response = await authFetch('/api/entries', {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (data.status === 'ok') success++;
        } catch (error) {
          console.error('Error al actualizar registro en lote', error);
        }
      }
      if (success === 0) {
        alert('No se actualizaron registros.');
      }
      closeBulkEdit();
      clearSelection();
      onRefresh();
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

    const projectValue = newEntry.projectId;
    const projectId = projectValue === '' ? null : Number(projectValue);
    if (projectId == null || Number.isNaN(projectId)) {
      alert('Selecciona un proyecto antes de agregar horas.');
      return;
    }

    const project = projectById.get(projectId);
    if (!project) {
      alert('Proyecto inválido. Actualiza la página e intenta de nuevo.');
      return;
    }

    const targetCompanyId = project.company_id ?? effectiveDefaultCompanyId;
    if (targetCompanyId == null) {
      alert('Debes seleccionar una empresa antes de agregar horas.');
      return;
    }
    
    setLoading(true);
    try {
      await onSave([{ date: newEntry.date, hours, companyId: targetCompanyId, projectId }]);
      setNewEntry({ date: '', hours: '', projectId });
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

  const handleOpenBulkMode = () => {
    if (!effectiveDefaultCompanyId) {
      alert('Necesitas seleccionar o crear una empresa antes de usar la asignación masiva.');
      return;
    }

    if (!startDate || !endDate) {
      const today = new Date();
      const defaultStart = toISODate(getMonday(today));
      const defaultEnd = toISODate(getSunday(today));

      if (!startDate) {
        setStartDate(defaultStart);
      }

      if (!endDate) {
        setEndDate(defaultEnd);
      }

      // Permitir que el estado se actualice antes de mostrar el modal
      requestAnimationFrame(() => setShowBulkMode(true));
      return;
    }

    setShowBulkMode(true);
  };

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
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Fecha Fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            onClick={handleOpenBulkMode}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Fecha</label>
                <input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Proyecto</label>
                <select
                  value={newEntry.projectId}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : Number(e.target.value);
                    setNewEntry({ ...newEntry, projectId: value });
                  }}
                  disabled={projectOptions.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Selecciona un proyecto…</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id ?? ''}>
                      {project.name}
                      {project.company_id && companyNameById.get(project.company_id)
                        ? ` · ${companyNameById.get(project.company_id)}`
                        : ''}
                    </option>
                  ))}
                </select>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAdd}
                  disabled={loading || projectOptions.length === 0}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>

          {/* Acciones de selección múltiple */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <span className="text-gray-900">Seleccionados: {selectedIds.size}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={openBulkEdit}
                  className="rounded-md border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
                >
                  Editar seleccionados
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="rounded-md border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
                >
                  Eliminar seleccionados
                </button>
                <button
                  onClick={clearSelection}
                  className="rounded-md border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {/* Tabla de entradas */}
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Día</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Proyecto</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Horas</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntries.map((entry) => (
                  <tr key={entry.id || entry.date} className={`border-b ${entry.weekday >= 5 ? 'bg-blue-50' : ''}`}>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={typeof entry.id === 'number' ? selectedIds.has(entry.id) : false}
                        onChange={() => toggleSelect(entry.id)}
                        disabled={typeof entry.id !== 'number'}
                        title={typeof entry.id !== 'number' ? 'No se puede seleccionar: falta ID' : 'Seleccionar'}
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-gray-900">{entry.date}</td>
                    <td className="py-3 px-4">
                      <span className={`capitalize font-medium ${
                        entry.weekday >= 5 ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {entry.weekdayName}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {editingEntry?.id === entry.id ? (
                        <select
                          value={editingEntry?.projectId ?? ''}
                          onChange={(e) => {
                            if (!editingEntry) return;

                            const value = e.target.value === '' ? null : Number(e.target.value);
                            if (value == null || Number.isNaN(value)) {
                              setEditingEntry({ ...editingEntry, projectId: null, companyId: null });
                              return;
                            }

                            const project = projectById.get(value);
                            setEditingEntry({
                              ...editingEntry,
                              projectId: value,
                              companyId: project?.company_id ?? editingEntry.companyId ?? null
                            });
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecciona un proyecto…</option>
                          {projectOptions.map((project) => (
                            <option key={project.id} value={project.id ?? ''}>
                              {project.name}
                              {project.company_id && companyNameById.get(project.company_id)
                                ? ` · ${companyNameById.get(project.company_id)}`
                                : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-900">
                          {entry.projectId != null
                            ? projectById.get(entry.projectId)?.name ?? 'Proyecto desconocido'
                            : 'Sin proyecto'}
                        </span>
                      )}
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
              companies={companies}
              defaultCompanyId={effectiveDefaultCompanyId}
              projects={projects}
              projectById={projectById}
              defaultProjectId={effectiveDefaultProjectId}
            />
          )}

          {/* Modal de edición múltiple */}
          {bulkEditOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Editar registros seleccionados</h3>
                  <button onClick={closeBulkEdit} className="text-gray-500 hover:text-gray-700" aria-label="Cerrar">
                    ✕
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Horas (opcional)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      placeholder="Dejar vacío para no cambiar"
                      value={bulkEditValues.hours}
                      onChange={(e) => setBulkEditValues((s) => ({ ...s, hours: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Proyecto (opcional)</label>
                    <select
                      value={bulkEditValues.projectId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBulkEditValues((s) => ({ ...s, projectId: val === '' ? '' : Number(val) }));
                      }}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No cambiar</option>
                      {projectOptions.map((project) => (
                        <option key={project.id} value={project.id ?? ''}>
                          {project.name}
                          {project.company_id && companyNameById.get(project.company_id)
                            ? ` · ${companyNameById.get(project.company_id)}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Descripción (opcional)</label>
                    <input
                      type="text"
                      placeholder="Dejar vacío para no cambiar"
                      value={bulkEditValues.description}
                      onChange={(e) => setBulkEditValues((s) => ({ ...s, description: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={closeBulkEdit} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cancelar</button>
                  <button onClick={applyBulkEdit} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">Aplicar cambios</button>
                </div>
              </div>
            </div>
          )}

    </div>
  );
}

// Componente Modal para Asignación Masiva
interface BulkDayCell {
  key: string;
  date: string | null;
  dayLabel: string;
  weekdayIndex: number;
  hours: string;
  description: string;
  showDescription: boolean;
  isDisabled: boolean;
  isExisting: boolean;
  existingHours?: number;
  existingDescription?: string;
  companyId: number | null;
  existingCompanyId?: number | null;
  projectId: number | null;
  existingProjectId?: number | null;
}

type BulkWeekRow = BulkDayCell[];

interface BulkAssignmentModalProps {
  startDate: string;
  endDate: string;
  existingEntries: HourEntry[];
  onSave: (entries: Array<{date: string, hours: number, companyId: number, projectId: number | null, description?: string}>) => Promise<void>;
  onRefresh: () => void;
  onClose: () => void;
  companies: Company[];
  defaultCompanyId: number | null;
  projects: Project[];
  projectById: Map<number, Project>;
  defaultProjectId: number | null;
}

const getWeekdayIndex = (value: Date) => {
  const day = value.getDay();
  return day === 0 ? 6 : day - 1;
};

function BulkAssignmentModal({
  startDate,
  endDate,
  existingEntries,
  onSave,
  onRefresh,
  onClose,
  companies,
  defaultCompanyId,
  projects,
  projectById,
  defaultProjectId
}: BulkAssignmentModalProps) {
  const [weeks, setWeeks] = useState<BulkWeekRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const modalProjectOptions = useMemo<Project[]>(() => projects.filter((project) => project.id != null), [projects]);

  const modalCompanyNameById = useMemo(() => {
    const map = new Map<number, string>();
    companies.forEach((company) => {
      if (company.id != null) {
        map.set(company.id, company.name);
      }
    });
    return map;
  }, [companies]);

  const fallbackProjectId = useMemo(() => {
    if (defaultProjectId != null) {
      return defaultProjectId;
    }
    const firstProject = projects.find((project) => project.id != null);
    return firstProject?.id ?? null;
  }, [defaultProjectId, projects]);

  const fallbackCompanyId = useMemo(() => {
    if (fallbackProjectId != null) {
      const project = projectById.get(fallbackProjectId);
      if (project) {
        return project.company_id;
      }
    }

    if (defaultCompanyId != null) {
      return defaultCompanyId;
    }

    const firstCompany = companies.find((company) => company.id != null);
    return firstCompany?.id ?? null;
  }, [companies, defaultCompanyId, fallbackProjectId, projectById]);

  const [bulkProjectId, setBulkProjectId] = useState<number | null>(fallbackProjectId);

  useEffect(() => {
    setBulkProjectId(fallbackProjectId);
  }, [fallbackProjectId]);

  const applyProjectToAllDays = () => {
    if (bulkProjectId == null) {
      alert('Selecciona un proyecto para aplicar.');
      return;
    }

    const project = projectById.get(bulkProjectId);
    if (!project) {
      alert('Proyecto no válido. Actualiza la página e intenta de nuevo.');
      return;
    }

    setWeeks((prev) =>
      prev.map((week) =>
        week.map((day) => {
          if (!day.isDisabled && !day.isExisting && day.projectId == null) {
            return { ...day, projectId: bulkProjectId, companyId: project.company_id };
          }
          return day;
        })
      )
    );
  };

  const range = useMemo(() => {
    const parseDate = (value?: string) => {
      if (!value) return null;
      const parsed = new Date(`${value}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const today = new Date();
    const startCandidate = parseDate(startDate) ?? getMonday(today);
    const endCandidate = parseDate(endDate) ?? getSunday(today);

    const start = getMonday(startCandidate);
    let end = normalizeStartOfDay(endCandidate);
    if (end < start) {
      end = new Date(start);
    }

    return { start, end };
  }, [startDate, endDate]);

  const rangeStart = range.start;
  const rangeEnd = range.end;

  const existingEntriesMap = useMemo(() => {
    const map = new Map<string, HourEntry>();
    existingEntries.forEach((entry) => {
      map.set(entry.date, entry);
    });
    return map;
  }, [existingEntries]);

  const historicalAverages = useMemo(() => {
    const totals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  const targetMonth = rangeStart.getMonth();
  const targetYear = rangeStart.getFullYear();

    existingEntries.forEach((entry) => {
      const entryDate = new Date(`${entry.date}T00:00:00`);
      if (Number.isNaN(entryDate.getTime())) return;

      // Excluir mes en curso para usar "otros meses" como referencia
      if (entryDate.getMonth() === targetMonth && entryDate.getFullYear() === targetYear) {
        return;
      }

      const idx = getWeekdayIndex(entryDate);
      totals[idx].sum += entry.hours;
      totals[idx].count += 1;
    });

    const averagesByWeekday = totals.map(({ sum, count }) =>
      count > 0 ? Number((sum / count).toFixed(2)) : null
    );

    const totalSum = totals.reduce((acc, item) => acc + item.sum, 0);
    const totalCount = totals.reduce((acc, item) => acc + item.count, 0);
    const overallAverage = totalCount > 0 ? Number((totalSum / totalCount).toFixed(2)) : null;

    return { averagesByWeekday, overallAverage };
  }, [existingEntries, rangeStart]);

  useEffect(() => {
  const monday = getMonday(rangeStart);
  const sunday = getSunday(rangeEnd);
    const formatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });

    const newWeeks: BulkWeekRow[] = [];
    for (let cursor = new Date(monday); cursor <= sunday; cursor.setDate(cursor.getDate() + 7)) {
      const weekStart = new Date(cursor);
      const weekCells: BulkWeekRow = [];

      for (let index = 0; index < 7; index++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + index);
        const isoDate = toISODate(dayDate);
        const withinRange = dayDate >= rangeStart && dayDate <= rangeEnd;
        const existingEntry = existingEntriesMap.get(isoDate);
        const isExisting = Boolean(existingEntry);
        const existingProjectId = existingEntry?.projectId ?? null;
        const projectId = existingProjectId ?? fallbackProjectId ?? null;
        const project = projectId != null ? projectById.get(projectId) : null;
        const companyId = existingEntry?.companyId ?? project?.company_id ?? fallbackCompanyId ?? null;
        const isDisabled = !withinRange || isExisting;

        weekCells.push({
          key: `${isoDate}-${index}`,
          date: withinRange ? isoDate : null,
          dayLabel: withinRange ? formatter.format(dayDate) : '',
          weekdayIndex: index,
          hours: '',
          description: '',
          showDescription: false,
          isDisabled,
          isExisting,
          existingHours: existingEntry?.hours,
          existingDescription: existingEntry?.description || '',
          companyId,
          existingCompanyId: existingEntry?.companyId,
          projectId,
          existingProjectId
        });
      }

      newWeeks.push(weekCells);
    }

    setWeeks(newWeeks);
  }, [existingEntriesMap, fallbackCompanyId, fallbackProjectId, projectById, rangeEnd, rangeStart]);

  const updateHours = (weekIndex: number, dayIndex: number, value: string) => {
    setWeeks((prev) =>
      prev.map((week, wi) =>
        week.map((day, di) => {
          if (wi === weekIndex && di === dayIndex) {
            return { ...day, hours: value };
          }
          return day;
        })
      )
    );
  };

  const updateDescription = (weekIndex: number, dayIndex: number, value: string) => {
    setWeeks((prev) =>
      prev.map((week, wi) =>
        week.map((day, di) => {
          if (wi === weekIndex && di === dayIndex) {
            return { ...day, description: value };
          }
          return day;
        })
      )
    );
  };

  const updateProjectSelection = (weekIndex: number, dayIndex: number, value: string) => {
    const parsed = value === '' ? null : Number(value);
    setWeeks((prev) =>
      prev.map((week, wi) =>
        week.map((day, di) => {
          if (wi === weekIndex && di === dayIndex) {
            if (parsed == null || Number.isNaN(parsed)) {
              return { ...day, projectId: null, companyId: null };
            }

            const project = projectById.get(parsed);
            if (!project) {
              return { ...day, projectId: null, companyId: null };
            }

            return { ...day, projectId: parsed, companyId: project.company_id };
          }
          return day;
        })
      )
    );
  };

  const toggleDescription = (weekIndex: number, dayIndex: number) => {
    setWeeks((prev) =>
      prev.map((week, wi) =>
        week.map((day, di) => {
          if (wi === weekIndex && di === dayIndex) {
            return { ...day, showDescription: !day.showDescription };
          }
          return day;
        })
      )
    );
  };

  const clearAllHours = () => {
    setWeeks((prev) =>
      prev.map((week) =>
        week.map((day) => ({
          ...day,
          hours: ''
        }))
      )
    );
  };

  const fillWithHistoricalAverage = () => {
    const { averagesByWeekday, overallAverage } = historicalAverages;
    if (!averagesByWeekday.some((value) => value !== null) && overallAverage === null) {
      alert('No hay datos históricos suficientes para calcular un promedio.');
      return;
    }

    setWeeks((prev) =>
      prev.map((week) =>
        week.map((day) => {
          if (day.isDisabled || !day.date) {
            return day;
          }

          const average = averagesByWeekday[day.weekdayIndex] ?? overallAverage;
          if (!average || average <= 0) {
            return { ...day, hours: '' };
          }

          const rounded = Math.round(average * 2) / 2;
          return { ...day, hours: rounded.toString() };
        })
      )
    );
  };

  const handleBulkSave = async () => {
    setIsLoading(true);
    try {
  const invalidDates: string[] = [];
  const missingProjects: string[] = [];
  const entriesToSave: Array<{ date: string; hours: number; companyId: number; projectId: number | null; description?: string }> = [];

      weeks.forEach((week) => {
        week.forEach((day) => {
          if (!day.date || day.isDisabled) return;
          if (day.hours === '') return;

          const parsed = parseFloat(day.hours);
          if (Number.isNaN(parsed) || parsed <= 0) {
            return;
          }

          if (parsed > 24) {
            invalidDates.push(day.dayLabel || day.date);
            return;
          }

          if (!day.projectId) {
            missingProjects.push(day.dayLabel || day.date);
            return;
          }

          const project = projectById.get(day.projectId);
          const projectCompanyId = project?.company_id ?? day.companyId;

          if (!projectCompanyId) {
            missingProjects.push(day.dayLabel || day.date);
            return;
          }

          const rounded = Math.round(parsed * 4) / 4;
          entriesToSave.push({
            date: day.date,
            hours: rounded,
            companyId: projectCompanyId,
            projectId: day.projectId,
            description: day.description.trim() || undefined
          });
        });
      });

      if (invalidDates.length > 0) {
        alert(`Revisa las horas asignadas en: ${invalidDates.join(', ')}. El máximo permitido es 24 horas.`);
        return;
      }

      if (missingProjects.length > 0) {
        const uniqueProjects = Array.from(new Set(missingProjects));
        alert(`Selecciona un proyecto para: ${uniqueProjects.join(', ')}.`);
        return;
      }

      if (entriesToSave.length === 0) {
        alert('No hay horas válidas para guardar. Agrega valores mayores a 0.');
        return;
      }

  await onSave(entriesToSave);
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error saving bulk entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const rangeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'long'
      }),
    []
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Asignación Masiva de Horas</h2>
            <p className="text-sm text-gray-600">
              Rango seleccionado: {rangeFormatter.format(rangeStart)} – {rangeFormatter.format(rangeEnd)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-gray-200">
          <button
            type="button"
            onClick={fillWithHistoricalAverage}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Autocompletar con promedio histórico
          </button>
          <button
            type="button"
            onClick={clearAllHours}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Limpiar horas
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-gray-700">
            <label htmlFor="bulk-project" className="font-medium">Proyecto predeterminado</label>
            <select
              id="bulk-project"
              value={bulkProjectId ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                const parsed = value === '' ? null : Number(value);
                setBulkProjectId(parsed !== null && !Number.isNaN(parsed) ? parsed : null);
              }}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona un proyecto…</option>
              {modalProjectOptions.map((project) => (
                <option key={project.id} value={project.id ?? ''}>
                  {project.name}
                  {project.company_id && modalCompanyNameById.get(project.company_id)
                    ? ` · ${modalCompanyNameById.get(project.company_id)}`
                    : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyProjectToAllDays}
              className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              Aplicar a días vacíos
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {weeks.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="grid grid-cols-1 gap-3 md:grid-cols-7">
              {week.map((day, dayIndex) => (
                <div
                  key={day.key}
                  className={`min-h-[160px] rounded-lg border p-3 transition-colors ${
                    day.isDisabled
                      ? 'border-dashed border-gray-200 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  {day.date ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {WEEKDAY_NAMES_ES[day.weekdayIndex]}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">{day.dayLabel}</p>
                        </div>
                        {day.isExisting && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                            Ya registrado
                          </span>
                        )}
                      </div>

                      {day.isDisabled ? (
                        <p className="mt-3 text-xs text-gray-500">
                          {day.isExisting
                            ? `Registrado: ${formatHours(day.existingHours || 0)}${day.existingProjectId != null ? ` · ${projectById.get(day.existingProjectId)?.name ?? 'Proyecto desconocido'}` : ''}`
                            : 'Fecha fuera del rango seleccionado'}
                        </p>
                      ) : (
                        <>
                          <label className="mt-2 block text-xs font-medium text-gray-700">Proyecto</label>
                          <select
                            value={day.projectId ?? ''}
                            onChange={(e) => updateProjectSelection(weekIndex, dayIndex, e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecciona un proyecto…</option>
                            {modalProjectOptions.map((project) => (
                              <option key={project.id} value={project.id ?? ''}>
                                {project.name}
                                {project.company_id && modalCompanyNameById.get(project.company_id)
                                  ? ` · ${modalCompanyNameById.get(project.company_id)}`
                                  : ''}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="24"
                            step="0.25"
                            value={day.hours}
                            onChange={(e) => updateHours(weekIndex, dayIndex, e.target.value)}
                            className="mt-3 w-full rounded-md border border-gray-300 px-2 py-1.5 text-center text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Horas"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => toggleDescription(weekIndex, dayIndex)}
                            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            {day.showDescription ? 'Ocultar descripción' : 'Añadir descripción'}
                          </button>
                          {day.showDescription && (
                            <textarea
                              value={day.description}
                              onChange={(e) => updateDescription(weekIndex, dayIndex, e.target.value)}
                              className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={2}
                              placeholder="Descripción opcional"
                            />
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                      Sin fecha
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleBulkSave}
            disabled={isLoading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : 'Guardar horas'}
          </button>
        </div>
      </div>
    </div>
  );
}
