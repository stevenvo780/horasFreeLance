'use client';

import { useState, useEffect } from 'react';
import { Company, Project, CreateInvoiceFromHoursRequest } from '@/lib/types';
import { 
  FileText, Calendar, Building2, Briefcase,
  X, Loader2, AlertCircle
} from 'lucide-react';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateInvoiceFromHoursRequest) => Promise<void>;
  companies: Company[];
  projects: Project[];
  selectedCompanyId?: number | null;
}

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  onSubmit,
  companies,
  projects,
  selectedCompanyId
}: CreateInvoiceModalProps) {
  const [formData, setFormData] = useState<CreateInvoiceFromHoursRequest>({
    company_id: 0,
    period_start: '',
    period_end: '',
    project_id: null,
    issue_date: new Date().toISOString().split('T')[0],
    concept: 'Servicios de Desarrollo'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resetear form cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      // Calcular periodo del mes anterior por defecto
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      setFormData({
        company_id: selectedCompanyId || companies[0]?.id || 0,
        period_start: lastMonth.toISOString().split('T')[0],
        period_end: lastDayOfLastMonth.toISOString().split('T')[0],
        project_id: null,
        issue_date: now.toISOString().split('T')[0],
        concept: 'Servicios de Desarrollo'
      });
      setError(null);
    }
  }, [isOpen, selectedCompanyId, companies]);

  const filteredProjects = projects.filter(p => p.company_id === formData.company_id);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'company_id') {
      // Al cambiar empresa, resetear proyecto
      setFormData(prev => ({
        ...prev,
        company_id: parseInt(value),
        project_id: null
      }));
    } else if (name === 'project_id') {
      setFormData(prev => ({
        ...prev,
        project_id: value ? parseInt(value) : null
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validación
    if (!formData.company_id) {
      setError('Selecciona una empresa');
      return;
    }
    if (!formData.period_start || !formData.period_end) {
      setError('Selecciona el periodo de facturación');
      return;
    }
    if (formData.period_start > formData.period_end) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta de cobro');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Nueva Cuenta de Cobro
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              Empresa *
            </label>
            <select
              name="company_id"
              value={formData.company_id || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">Selecciona una empresa</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* Proyecto (opcional) */}
          {filteredProjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                Proyecto (opcional)
              </label>
              <select
                name="project_id"
                value={formData.project_id || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">Todos los proyectos</option>
                {filteredProjects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Periodo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Inicio del Periodo *
              </label>
              <input
                type="date"
                name="period_start"
                value={formData.period_start}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fin del Periodo *
              </label>
              <input
                type="date"
                name="period_end"
                value={formData.period_end}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
          </div>

          {/* Fecha de emisión */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Emisión
            </label>
            <input
              type="date"
              name="issue_date"
              value={formData.issue_date || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concepto del Servicio
            </label>
            <input
              type="text"
              name="concept"
              value={formData.concept || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ej: Servicios de Desarrollo y DevOps"
              disabled={loading}
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {loading ? 'Creando...' : 'Crear Cuenta de Cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
