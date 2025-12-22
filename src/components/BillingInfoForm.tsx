'use client';

import { useState, useEffect } from 'react';
import { UserBillingInfo, UpdateUserBillingInfoRequest } from '@/lib/types';
import { 
  User, CreditCard, MapPin, Phone, 
  Save, Loader2, AlertCircle, CheckCircle
} from 'lucide-react';

interface BillingInfoFormProps {
  billingInfo: UserBillingInfo | null;
  onSave: (data: UpdateUserBillingInfoRequest) => Promise<void>;
  loading?: boolean;
}

const DEFAULT_DECLARATION = `Certifico bajo la gravedad de juramento que los aportes en salud corresponden a los ingresos provenientes del pago sujeto a retención.
En cumplimiento a la Ley 1819 de 2016, Artículo 17, 383 del Estatuto Tributario, se declara que no se tienen contratados 2 o más empleados.`;

export default function BillingInfoForm({ billingInfo, onSave, loading = false }: BillingInfoFormProps) {
  const [formData, setFormData] = useState<UpdateUserBillingInfoRequest>({
    name: '',
    id_type: 'C.C.',
    id_number: '',
    address: '',
    city: '',
    phone: '',
    bank_name: '',
    account_type: 'Ahorros',
    account_number: '',
    declaration: DEFAULT_DECLARATION
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  useEffect(() => {
    if (billingInfo) {
      setFormData({
        name: billingInfo.name || '',
        id_type: billingInfo.id_type || 'C.C.',
        id_number: billingInfo.id_number || '',
        address: billingInfo.address || '',
        city: billingInfo.city || '',
        phone: billingInfo.phone || '',
        bank_name: billingInfo.bank_name || '',
        account_type: billingInfo.account_type || 'Ahorros',
        account_number: billingInfo.account_number || '',
        signature_image: billingInfo.signature_image,
        declaration: billingInfo.declaration || DEFAULT_DECLARATION
      });
      if (billingInfo.signature_image) {
        setSignaturePreview(billingInfo.signature_image);
      }
    }
  }, [billingInfo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (máx 500KB)
    if (file.size > 500 * 1024) {
      setError('La imagen de firma no debe superar 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSignaturePreview(base64);
      setFormData(prev => ({ ...prev, signature_image: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validación
    if (!formData.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!formData.id_number.trim()) {
      setError('El número de identificación es obligatorio');
      return;
    }

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mensaje de error/éxito */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>Datos guardados correctamente</span>
        </div>
      )}

      {/* Datos personales */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Datos Personales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Tu nombre completo"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                Tipo ID
              </label>
              <select
                name="id_type"
                value={formData.id_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
              >
                <option value="C.C.">C.C.</option>
                <option value="NIT">NIT</option>
                <option value="C.E.">C.E.</option>
                <option value="Pasaporte">Pasaporte</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                Número *
              </label>
              <input
                type="text"
                name="id_number"
                value={formData.id_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Número de identificación"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dirección */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Dirección
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              Dirección
            </label>
            <input
              type="text"
              name="address"
              value={formData.address || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Calle, número, etc."
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              Ciudad
            </label>
            <input
              type="text"
              name="city"
              value={formData.city || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ciudad, País"
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
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Número de contacto"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Datos bancarios */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Datos Bancarios
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              Banco
            </label>
            <input
              type="text"
              name="bank_name"
              value={formData.bank_name || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Nombre del banco"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              Tipo de Cuenta
            </label>
            <select
              name="account_type"
              value={formData.account_type || 'Ahorros'}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="Ahorros">Ahorros</option>
              <option value="Corriente">Corriente</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              Número de Cuenta
            </label>
            <input
              type="text"
              name="account_number"
              value={formData.account_number || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Número de cuenta"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Firma y declaración */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Firma y Declaración Legal
        </h3>
        
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            Imagen de Firma (opcional)
          </label>
          <div className="flex items-start gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleSignatureUpload}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              disabled={isLoading}
            />
            {signaturePreview && (
              <div className="w-32 h-16 border border-gray-200 rounded overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={signaturePreview} 
                  alt="Vista previa de firma" 
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Máximo 500KB. Formatos: PNG, JPG</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            Declaración Legal
          </label>
          <textarea
            name="declaration"
            value={formData.declaration || ''}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Declaración legal que aparecerá en las cuentas de cobro"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {saving ? 'Guardando...' : 'Guardar Datos'}
        </button>
      </div>
    </form>
  );
}
