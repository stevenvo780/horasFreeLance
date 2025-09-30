import React, { useState, useEffect } from 'react';
import { Download, Calendar, Building2, FileText } from 'lucide-react';
import jsPDF from 'jspdf';

interface Company {
  id?: number;
  name: string;
}

interface ReportData {
  company: {
    id: number;
    name: string;
  };
  period: {
    start_date: string;
    end_date: string;
  };
  projects: Array<{
    project_id: number | null;
    project_name: string;
    hours: number;
    amount: number;
    descriptions: string[];
  }>;
  summary: {
    total_hours: number;
    total_amount: number;
    hourly_rate: number;
  };
}

interface MonthlyReportProps {
  companies: Company[];
}

export default function MonthlyReport({ companies }: MonthlyReportProps) {
  const [selectedCompany, setSelectedCompany] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Establecer fechas por defecto al inicio del mes actual
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  const fetchReportData = async () => {
    if (!selectedCompany || !startDate || !endDate) {
      alert('Por favor selecciona una empresa y las fechas de corte');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/${selectedCompany}?startDate=${startDate}&endDate=${endDate}`,
        {
          credentials: 'include',
        }
      );

      const result = await response.json();
      
      if (result.status === 'ok') {
        setReportData(result.data);
      } else {
        alert('Error al obtener datos: ' + result.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const generatePDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Configurar fuente
    doc.setFont('helvetica');

    // Título del reporte
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte mensual de trabajo ILS', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Información de la empresa
    doc.setFontSize(14);
    doc.text(`Empresa: ${reportData.company.name}`, 20, yPosition);
    yPosition += 10;

    // Fechas de corte
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha inicio de corte: ${formatDate(reportData.period.start_date)}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Fecha fin de corte: ${formatDate(reportData.period.end_date)}`, 20, yPosition);
    yPosition += 15;

    // Proyectos
    reportData.projects.forEach((project) => {
      // Verificar si necesitamos nueva página
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Horas de proyecto: ${project.project_name} - ${project.hours.toFixed(2)}h`, 20, yPosition);
      yPosition += 8;

      // Descripciones de horas a facturar (solo si existen)
      if (project.descriptions.length > 0) {
        doc.text('Descripción horas a facturar:', 20, yPosition);
        yPosition += 6;
        
        project.descriptions.forEach(description => {
          if (yPosition > 260) {
            doc.addPage();
            yPosition = 20;
          }
          // Usar splitTextToSize para manejar texto largo
          const lines = doc.splitTextToSize(`• ${description}`, pageWidth - 40);
          doc.text(lines, 25, yPosition);
          yPosition += lines.length * 5;
        });
      }

      yPosition += 5;
      doc.text('Estado aprobación producer ILS: _______________', 20, yPosition);
      yPosition += 15;
    });

    // Totales
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Horas totales a facturar: ${reportData.summary.total_hours.toFixed(2)}h`, 20, yPosition);
    yPosition += 10;

    doc.text(`$ total a facturar: ${formatCurrency(reportData.summary.total_amount)}`, 20, yPosition);
    yPosition += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`(Tarifa por hora: ${formatCurrency(reportData.summary.hourly_rate)})`, 20, yPosition);

    // Guardar PDF
    const filename = `reporte-${reportData.company.name.replace(/\s+/g, '-')}-${reportData.period.start_date}-${reportData.period.end_date}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Generar Reporte Mensual</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Selector de empresa */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building2 className="inline h-4 w-4 mr-1" />
            Empresa
          </label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Seleccionar empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id || ''}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha inicio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Fecha inicio
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Fecha fin */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Fecha fin
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={fetchReportData}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? 'Cargando...' : 'Generar Vista Previa'}
        </button>

        {reportData && (
          <button
            onClick={generatePDF}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </button>
        )}
      </div>

      {/* Vista previa del reporte */}
      {reportData && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-bold mb-4">Vista Previa del Reporte</h3>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-bold text-center text-lg mb-4">Reporte mensual de trabajo ILS</h4>
            
            <div className="mb-4">
              <p><strong>Empresa:</strong> {reportData.company.name}</p>
              <p><strong>Fecha inicio de corte:</strong> {formatDate(reportData.period.start_date)}</p>
              <p><strong>Fecha fin de corte:</strong> {formatDate(reportData.period.end_date)}</p>
            </div>

            {reportData.projects.map((project, index) => (
              <div key={project.project_id || `unassigned-${index}`} className="mb-6 p-3 bg-white rounded border">
                <p><strong>Horas de proyecto:</strong> {project.project_name} - {project.hours.toFixed(2)}h</p>
                {project.descriptions.length > 0 && (
                  <>
                    <p><strong>Descripción horas a facturar:</strong></p>
                    <div className="ml-4 mb-2">
                      {project.descriptions.map((desc, i) => (
                        <p key={i} className="text-sm">• {desc}</p>
                      ))}
                    </div>
                  </>
                )}
                <p><strong>Estado aprobación producer ILS:</strong> _______________</p>
              </div>
            ))}

            <div className="border-t pt-4 mt-4">
              <p><strong>Horas totales a facturar:</strong> {reportData.summary.total_hours.toFixed(2)}h</p>
              <p><strong>$ total a facturar:</strong> {formatCurrency(reportData.summary.total_amount)}</p>
              <p className="text-sm text-gray-600">
                (Tarifa por hora: {formatCurrency(reportData.summary.hourly_rate)})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}