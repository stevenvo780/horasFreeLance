'use client';

import { useState, useEffect } from 'react';
import { CompanyBillingInfo, UpdateCompanyBillingInfoRequest } from '@/lib/types';
import { 
  Building2, MapPin, User, Phone, Mail,
  Save, Loader2, AlertCircle, CheckCircle
} from 'lucide-react';

interface CompanyBillingFormProps {
  companyId: number;
  companyName: string;
  billingInfo: CompanyBillingInfo | null;
  onSave: (data: Omit<UpdateCompanyBillingInfoRequest, 'company_id'>) => Promise<void>;
  loading?: boolean;
}

export default function CompanyBillingForm({ 
  companyId: _companyId, 
  companyName, 
  billingInfo, 
  onSave, 
  loading = false 
}: CompanyBillingFormProps) {
  void _companyId; // Disponible para uso futuro
  const [formData, setFormData] = useState({
    legal_name: '',
    nit: '',
    address: '',
    city: '',
    contact_name: '',
    contact_phone: '',
    contact_email: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (billingInfo) {
      setFormData({
        legal_name: billingInfo.legal_name || '',
        nit: billingInfo.nit || '',
        address: billingInfo.address || '',
        city: billingInfo.city || '',
        contact_name: billingInfo.contact_name || '',
        contact_phone: billingInfo.contact_phone || '',
        contact_email: billingInfo.contact_email || ''
      });
    } else {
      // Si no hay billing info, usar el nombre de la empresa como legal_name
      setFormData(prev => ({
        ...prev,
        legal_name: companyName
      }));
    }
  }, [billingInfo, companyName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    setSaving(true);
    try {
      await onSave(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loading || saving;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mensaje de error/éxito */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Datos guardados</span>
        </div>
      )}

      {/* Datos de la empresa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            Razón Social
          </label>
          <input
            type="text"
            name="legal_name"
            value={formData.legal_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Nombre legal de la empresa"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            NIT
          </label>
          <input
            type="text"
            name="nit"
            value={formData.nit}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="NIT de la empresa"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Dirección */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Dirección
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Dirección de la empresa"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ciudad
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Ciudad, País"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Contacto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <User className="w-4 h-4" />
            Contacto
          </label>
          <input
            type="text"
            name="contact_name"
            value={formData.contact_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Nombre del contacto"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Phone className="w-4 h-4" />
            Teléfono
          </label>
          <input
            type="text"
            name="contact_phone"
            value={formData.contact_phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Teléfono"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Mail className="w-4 h-4" />
            Email
          </label>
          <input
            type="email"
            name="contact_email"
            value={formData.contact_email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="email@empresa.com"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
