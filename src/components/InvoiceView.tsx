'use client';

import { useState, useCallback } from 'react';
import { Invoice, InvoiceStatus } from '@/lib/types';
import { formatPrice } from '@/lib/formatters';
import { 
  FileText, Building2, User, 
  CreditCard, Printer, Check, 
  Send, X
} from 'lucide-react';

interface InvoiceViewProps {
  invoice: Invoice;
  onStatusChange?: (invoiceId: number, status: InvoiceStatus) => Promise<void>;
  onClose?: () => void;
  printMode?: boolean;
}

const statusLabels: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-200 text-gray-700' },
  sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pagada', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' }
};

export default function InvoiceView({ invoice, onStatusChange, onClose, printMode = false }: InvoiceViewProps) {
  const [loading, setLoading] = useState(false);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleStatusChange = useCallback(async (newStatus: InvoiceStatus) => {
    if (!onStatusChange) return;
    setLoading(true);
    try {
      await onStatusChange(invoice.id!, newStatus);
    } finally {
      setLoading(false);
    }
  }, [invoice.id, onStatusChange]);

  const formatPeriod = (start: string, end: string) => {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const status = statusLabels[invoice.status];

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-4xl mx-auto print:shadow-none print:max-w-full">
      {/* Header con controles (ocultos en impresión) */}
      {!printMode && (
        <div className="flex justify-between items-center p-4 border-b print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <span className="font-medium">Cuenta de Cobro #{invoice.number}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {invoice.status === 'draft' && onStatusChange && (
              <button
                onClick={() => handleStatusChange('sent')}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Send className="w-4 h-4" />
                Marcar Enviada
              </button>
            )}
            {invoice.status === 'sent' && onStatusChange && (
              <button
                onClick={() => handleStatusChange('paid')}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Check className="w-4 h-4" />
                Marcar Pagada
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenido de la cuenta de cobro */}
      <div className="p-6 md:p-8">
        {/* Encabezado */}
        <header className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">CUENTA DE COBRO</h1>
            <p className="text-gray-500 text-lg">No. {invoice.number}</p>
          </div>
        </header>

        {/* Información de facturación */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* DEBE A (Emisor) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <User className="w-4 h-4" />
              DEBE A
            </h3>
            <p className="text-lg font-medium text-gray-800">{invoice.issuer_name}</p>
            <p className="text-gray-600">{invoice.issuer_id_type} {invoice.issuer_id_number}</p>
            {invoice.issuer_address && <p className="text-gray-600">{invoice.issuer_address}</p>}
            {invoice.issuer_city && <p className="text-gray-600">{invoice.issuer_city}</p>}
            {invoice.issuer_phone && <p className="text-gray-600">{invoice.issuer_phone}</p>}
          </div>

          {/* PARA (Cliente) */}
          <div className="md:text-right">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1 md:justify-end">
              <Building2 className="w-4 h-4" />
              PARA
            </h3>
            <p className="text-lg font-medium text-gray-800">{invoice.client_name}</p>
            {invoice.client_nit && <p className="text-gray-600">{invoice.client_nit}</p>}
            {invoice.client_address && <p className="text-gray-600">{invoice.client_address}</p>}
            {invoice.client_city && <p className="text-gray-600">{invoice.client_city}</p>}
            
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 md:justify-end">
                <span className="text-sm text-gray-500">Fecha de Emisión:</span>
                <span className="font-medium text-gray-700">
                  {new Date(invoice.issue_date + 'T00:00:00').toLocaleDateString('es-CO')}
                </span>
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <span className="text-sm text-gray-500">Periodo:</span>
                <span className="font-medium text-gray-700">
                  {formatPeriod(invoice.period_start, invoice.period_end)}
                </span>
              </div>
              {invoice.project_name && (
                <div className="flex items-center gap-2 md:justify-end">
                  <span className="text-sm text-gray-500">Proyecto:</span>
                  <span className="font-medium text-gray-700">{invoice.project_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla de servicios */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Detalles del Servicio</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 text-sm font-semibold text-gray-600 uppercase">Concepto</th>
                  <th className="p-3 text-sm font-semibold text-gray-600 uppercase text-center">Horas</th>
                  <th className="p-3 text-sm font-semibold text-gray-600 uppercase text-right">Tarifa por Hora</th>
                  <th className="p-3 text-sm font-semibold text-gray-600 uppercase text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, index) => (
                  <tr key={item.id || index} className="border-b border-gray-200">
                    <td className="p-3 text-gray-800">{item.concept}</td>
                    <td className="p-3 text-center text-gray-800">{item.hours}</td>
                    <td className="p-3 text-right text-gray-800">{formatPrice(item.rate)}</td>
                    <td className="p-3 text-right font-semibold text-gray-800">{formatPrice(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total */}
        <div className="mb-6">
          <div className="flex justify-between items-center bg-gray-800 text-white p-4 rounded-t-lg">
            <span className="text-xl font-bold">Total a Pagar</span>
            <span className="text-2xl font-bold">{formatPrice(invoice.total_amount)}</span>
          </div>
          
          {/* Información de pago */}
          {(invoice.issuer_bank_name || invoice.issuer_account_number) && (
            <div className="bg-gray-50 p-4 rounded-b-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <CreditCard className="w-4 h-4" />
                Información de Pago:
              </p>
              <div className="flex flex-wrap gap-4 md:gap-6">
                {invoice.issuer_bank_name && (
                  <div>
                    <span className="text-xs text-gray-500">Banco:</span>
                    <span className="ml-1 text-sm text-gray-700">{invoice.issuer_bank_name}</span>
                  </div>
                )}
                {invoice.issuer_account_type && (
                  <div>
                    <span className="text-xs text-gray-500">Tipo:</span>
                    <span className="ml-1 text-sm text-gray-700">{invoice.issuer_account_type}</span>
                  </div>
                )}
                {invoice.issuer_account_number && (
                  <div>
                    <span className="text-xs text-gray-500">Cuenta:</span>
                    <span className="ml-1 text-sm text-gray-700">{invoice.issuer_account_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Declaración */}
        {invoice.issuer_declaration && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{invoice.issuer_declaration}</p>
          </div>
        )}

        {/* Firma */}
        <footer className="pt-4 border-t border-gray-200 text-center">
          {invoice.issuer_signature_image && (
            <div className="w-48 h-16 mx-auto mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={invoice.issuer_signature_image} 
                alt="Firma" 
                className="max-w-full max-h-full object-contain mx-auto"
              />
            </div>
          )}
          <div className="border-t border-gray-400 w-64 mx-auto pt-2">
            <p className="text-sm font-medium text-gray-800">{invoice.issuer_name}</p>
            <p className="text-xs text-gray-500">Firma Autorizada</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
