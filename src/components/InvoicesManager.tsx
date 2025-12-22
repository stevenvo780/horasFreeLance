'use client';

import { useState, useEffect, useCallback } from 'react';
import { Invoice, InvoiceStatus, Company, Project, CreateInvoiceFromHoursRequest, UserBillingInfo, CompanyBillingInfo } from '@/lib/types';
import { formatPrice } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';
import InvoiceView from './InvoiceView';
import CreateInvoiceModal from './CreateInvoiceModal';
import BillingInfoForm from './BillingInfoForm';
import CompanyBillingForm from './CompanyBillingForm';
import { 
  FileText, Plus, Eye, Trash2, Settings,
  Loader2, AlertCircle, DollarSign,
  Clock, Building2, ChevronDown, ChevronUp
} from 'lucide-react';

interface InvoicesManagerProps {
  companies: Company[];
  projects: Project[];
  selectedCompanyId: number | null;
  onDataChange?: () => void;
}

const statusLabels: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-200 text-gray-700' },
  sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pagada', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' }
};

export default function InvoicesManager({ 
  companies, 
  projects, 
  selectedCompanyId,
  onDataChange 
}: InvoicesManagerProps) {
  const { authFetch } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [userBillingInfo, setUserBillingInfo] = useState<UserBillingInfo | null>(null);
  const [companyBillingInfoMap, setCompanyBillingInfoMap] = useState<Record<number, CompanyBillingInfo | null>>({});
  const [expandedCompanySettings, setExpandedCompanySettings] = useState<number | null>(null);
  const [loadingCompanyBilling, setLoadingCompanyBilling] = useState<number | null>(null);

  // Cargar facturas
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const url = selectedCompanyId 
        ? `/api/invoices?company_id=${selectedCompanyId}` 
        : '/api/invoices';
      const response = await authFetch(url);
      const data = await response.json();
      
      if (data.status === 'ok') {
        setInvoices(data.data || []);
      } else {
        setError(data.message);
      }
    } catch {
      setError('Error al cargar las cuentas de cobro');
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedCompanyId]);

  // Cargar billing info del usuario
  const fetchUserBillingInfo = useCallback(async () => {
    try {
      const response = await authFetch('/api/billing-info');
      const data = await response.json();
      if (data.status === 'ok') {
        setUserBillingInfo(data.data);
      }
    } catch (err) {
      console.error('Error fetching user billing info:', err);
    }
  }, [authFetch]);

  // Cargar billing info de empresa
  const fetchCompanyBillingInfo = useCallback(async (companyId: number) => {
    try {
      setLoadingCompanyBilling(companyId);
      const response = await authFetch(`/api/companies/${companyId}/billing-info`);
      const data = await response.json();
      if (data.status === 'ok') {
        setCompanyBillingInfoMap(prev => ({
          ...prev,
          [companyId]: data.data?.billing_info || null
        }));
      }
    } catch (err) {
      console.error('Error fetching company billing info:', err);
    } finally {
      setLoadingCompanyBilling(null);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchInvoices();
    fetchUserBillingInfo();
  }, [fetchInvoices, fetchUserBillingInfo]);

  useEffect(() => {
    if (selectedCompanyId && !(selectedCompanyId in companyBillingInfoMap)) {
      fetchCompanyBillingInfo(selectedCompanyId);
    }
  }, [selectedCompanyId, fetchCompanyBillingInfo, companyBillingInfoMap]);

  // Cargar billing info al expandir empresa en configuración
  useEffect(() => {
    if (expandedCompanySettings && !(expandedCompanySettings in companyBillingInfoMap)) {
      fetchCompanyBillingInfo(expandedCompanySettings);
    }
  }, [expandedCompanySettings, fetchCompanyBillingInfo, companyBillingInfoMap]);

  // Crear cuenta de cobro
  const handleCreateInvoice = async (data: CreateInvoiceFromHoursRequest) => {
    const response = await authFetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(result.message);
    }
    
    await fetchInvoices();
    onDataChange?.();
  };

  // Cambiar estado de cuenta
  const handleStatusChange = async (invoiceId: number, status: InvoiceStatus) => {
    const response = await authFetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(result.message);
    }
    
    // Actualizar la factura seleccionada si está abierta
    if (selectedInvoice?.id === invoiceId) {
      setSelectedInvoice(result.data);
    }
    
    await fetchInvoices();
  };

  // Eliminar cuenta
  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta cuenta de cobro?')) return;
    
    const response = await authFetch(`/api/invoices/${invoiceId}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    
    if (result.status !== 'ok') {
      alert(result.message);
      return;
    }
    
    await fetchInvoices();
  };

  // Ver detalle de factura
  const handleViewInvoice = async (invoiceId: number) => {
    const response = await authFetch(`/api/invoices/${invoiceId}`);
    const result = await response.json();
    
    if (result.status === 'ok') {
      setSelectedInvoice(result.data);
    }
  };

  // Guardar billing info usuario
  const handleSaveUserBillingInfo = async (data: Parameters<typeof BillingInfoForm>[0]['onSave'] extends (d: infer D) => unknown ? D : never) => {
    const response = await authFetch('/api/billing-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(result.message);
    }
    
    setUserBillingInfo(result.data);
  };

  // Guardar billing info empresa
  const handleSaveCompanyBillingInfo = async (companyId: number, data: Parameters<typeof CompanyBillingForm>[0]['onSave'] extends (d: infer D) => unknown ? D : never) => {
    const response = await authFetch(`/api/companies/${companyId}/billing-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(result.message);
    }
    
    setCompanyBillingInfoMap(prev => ({
      ...prev,
      [companyId]: result.data
    }));
  };

  // Stats
  const totalPending = invoices
    .filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + i.total_amount, 0);
  
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total_amount, 0);

  if (selectedInvoice) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 overflow-auto print:bg-white print:static">
        <div className="min-h-screen py-6 px-4 print:py-0 print:px-0">
          <InvoiceView
            invoice={selectedInvoice}
            onStatusChange={handleStatusChange}
            onClose={() => setSelectedInvoice(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cuentas de Cobro</h2>
          <p className="text-sm text-gray-500">Genera y gestiona tus cuentas de cobro</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              showSettings 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configuración
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!userBillingInfo}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!userBillingInfo ? 'Primero configura tus datos de facturación' : ''}
          >
            <Plus className="w-4 h-4" />
            Nueva Cuenta
          </button>
        </div>
      </div>

      {/* Alerta si no hay billing info */}
      {!userBillingInfo && !loading && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Configura tus datos de facturación</p>
            <p className="text-sm text-amber-700">
              Para crear cuentas de cobro, primero debes configurar tu información personal y bancaria.
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
          >
            Configurar
          </button>
        </div>
      )}

      {/* Panel de configuración */}
      {showSettings && (
        <div className="bg-gray-50 rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Configuración de Facturación</h3>
          
          {/* Datos del usuario */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Tus Datos (Emisor)</h4>
            <BillingInfoForm
              billingInfo={userBillingInfo}
              onSave={handleSaveUserBillingInfo}
            />
          </div>

          {/* Datos de empresas */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Datos de Empresas (Clientes)</h4>
            <div className="space-y-2">
              {companies.map(company => (
                <div key={company.id} className="bg-white rounded-lg border border-gray-200">
                  <button
                    onClick={() => setExpandedCompanySettings(
                      expandedCompanySettings === company.id ? null : company.id!
                    )}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-800 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {company.name}
                    </span>
                    {expandedCompanySettings === company.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {expandedCompanySettings === company.id && (
                    <div className="p-4 border-t">
                      <CompanyBillingForm
                        companyId={company.id!}
                        companyName={company.name}
                        billingInfo={companyBillingInfoMap[company.id!] || null}
                        onSave={(data) => handleSaveCompanyBillingInfo(company.id!, data)}
                        loading={loadingCompanyBilling === company.id}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Cuentas</p>
              <p className="text-xl font-bold text-gray-800">{invoices.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pendiente de Pago</p>
              <p className="text-xl font-bold text-blue-600">{formatPrice(totalPending)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Cobrado</p>
              <p className="text-xl font-bold text-green-600">{formatPrice(totalPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de facturas */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No hay cuentas de cobro</h3>
          <p className="text-gray-500 mb-4">
            {userBillingInfo 
              ? 'Crea tu primera cuenta de cobro desde las horas registradas'
              : 'Configura tus datos de facturación para empezar'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Periodo</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Horas</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Total</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map(invoice => {
                const status = statusLabels[invoice.status];
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      #{invoice.number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {invoice.client_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(invoice.period_start + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      {' - '}
                      {new Date(invoice.period_end + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 text-right">
                      {invoice.total_hours}h
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
                      {formatPrice(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewInvoice(invoice.id!)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Ver"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {invoice.status === 'draft' && (
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id!)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear cuenta */}
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateInvoice}
        companies={companies}
        projects={projects}
        selectedCompanyId={selectedCompanyId}
      />
    </div>
  );
}
