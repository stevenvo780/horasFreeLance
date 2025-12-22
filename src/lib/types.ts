// Types for the hours tracking application

export interface User {
  id?: number;
  email: string;
  password_hash: string;
  name: string;
  created_at?: string;
}

export interface Company {
  id?: number;
  name: string;
  hourly_rate: number;
  billing_cycle_day: number; // Day of month when billing cycle starts (1-31)
  user_id: number;
  created_at?: string;
}

export interface Project {
  id?: number;
  name: string;
  company_id: number;
  user_id: number;
  created_at?: string;
}

export interface HourEntry {
  id?: number;
  date: string; // ISO date string (YYYY-MM-DD)
  hours: number;
  description?: string;
  company_id: number;
  project_id?: number | null;
  created_at?: string;
}

export interface Settings {
  hourly_rate: number | null;
}

export interface EntryChange {
  date: string;
  old_value: number | null;
  new_value: number | null;
}

export interface WeekdayAverage {
  id?: number;
  weekday: number; // 0 = Sunday, 6 = Saturday
  average_hours: number;
  company_id: number;
}

export interface BulkAddRequest {
  start_date: string;
  end_date: string;
  hours: number;
  weekdays?: string[];
  mode: 'set' | 'accumulate' | 'error';
  skip_existing?: boolean;
  company_id: number;
  project_id?: number;
}

export interface FillAverageRequest {
  start_date: string;
  end_date: string;
  overwrite?: boolean;
  company_id: number;
}

export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  message: string;
  data?: T;
  changes?: EntryChange[];
}

export const WEEKDAY_NAMES_ES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

export const WEEKDAY_ALIASES: Record<string, number> = {
  'mon': 0, 'monday': 0, 'lunes': 0,
  'tue': 1, 'tues': 1, 'tuesday': 1, 'martes': 1,
  'wed': 2, 'weds': 2, 'wednesday': 2, 'miercoles': 2, 'miércoles': 2,
  'thu': 3, 'thurs': 3, 'thursday': 3, 'jueves': 3,
  'fri': 4, 'friday': 4, 'viernes': 4,
  'sat': 5, 'saturday': 5, 'sabado': 5, 'sábado': 5,
  'sun': 6, 'sunday': 6, 'domingo': 6,
};

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  status: 'ok' | 'error';
  message: string;
  token?: string;
  user?: Omit<User, 'password_hash'>;
}

export interface JWTPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface CreateCompanyRequest {
  name: string;
  description?: string;
  hourly_rate?: number;
  billing_cycle_day?: number;
}

// Billing cycle and earnings statistics
export interface BillingCycleStats {
  cycle_start: string; // ISO date
  cycle_end: string; // ISO date
  total_hours: number;
  total_earnings: number;
  days_worked: number;
  average_hours_per_day: number;
}

export interface MonthlyEarnings {
  month: string; // YYYY-MM format
  total_hours: number;
  total_earnings: number;
  billing_cycles: BillingCycleStats[];
}

// ========== Cuentas de Cobro (Invoice) Types ==========

// User billing info - Datos del freelancer/contratista que emite la cuenta
export interface UserBillingInfo {
  id?: number;
  user_id: number;
  name: string; // Nombre completo
  id_type: string; // C.C., NIT, etc.
  id_number: string; // Número de identificación
  address?: string;
  city?: string;
  phone?: string;
  bank_name?: string;
  account_type?: string; // Ahorros, Corriente
  account_number?: string;
  signature_image?: string; // Base64 o URL de imagen de firma
  declaration?: string; // Declaración legal estándar
  created_at?: string;
  updated_at?: string;
}

// Company billing info - Datos adicionales de facturación para el cliente/empresa
export interface CompanyBillingInfo {
  id?: number;
  company_id: number;
  legal_name?: string; // Razón social (si difiere del nombre)
  nit?: string; // NIT de la empresa
  address?: string;
  city?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  created_at?: string;
  updated_at?: string;
}

// Invoice item - Línea individual de la cuenta de cobro
export interface InvoiceItem {
  id?: number;
  invoice_id: number;
  concept: string;
  hours: number;
  rate: number;
  total: number; // hours * rate
  project_id?: number | null;
}

// Invoice status
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

// Invoice - Cuenta de cobro
export interface Invoice {
  id?: number;
  user_id: number;
  company_id: number;
  number: string; // Número de la cuenta (001, 002, etc.)
  issue_date: string; // Fecha de emisión (YYYY-MM-DD)
  period_start: string; // Inicio del periodo de trabajo
  period_end: string; // Fin del periodo de trabajo
  project_name?: string; // Nombre del proyecto (opcional)
  status: InvoiceStatus;
  // Datos del emisor (copiados al momento de crear)
  issuer_name: string;
  issuer_id_type: string;
  issuer_id_number: string;
  issuer_address?: string;
  issuer_city?: string;
  issuer_phone?: string;
  issuer_bank_name?: string;
  issuer_account_type?: string;
  issuer_account_number?: string;
  issuer_signature_image?: string;
  issuer_declaration?: string;
  // Datos del cliente (copiados al momento de crear)
  client_name: string;
  client_nit?: string;
  client_address?: string;
  client_city?: string;
  // Totales
  total_hours: number;
  total_amount: number;
  // Items (para respuestas con JOIN)
  items?: InvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

// Request para crear invoice desde horas registradas
export interface CreateInvoiceFromHoursRequest {
  company_id: number;
  period_start: string;
  period_end: string;
  project_id?: number | null; // Filtrar por proyecto opcional
  issue_date?: string; // Fecha de emisión (default: hoy)
  concept?: string; // Descripción del servicio (default: "Servicios de Desarrollo")
}

// Request para crear/actualizar billing info del usuario
export interface UpdateUserBillingInfoRequest {
  name: string;
  id_type: string;
  id_number: string;
  address?: string;
  city?: string;
  phone?: string;
  bank_name?: string;
  account_type?: string;
  account_number?: string;
  signature_image?: string;
  declaration?: string;
}

// Request para crear/actualizar billing info de empresa
export interface UpdateCompanyBillingInfoRequest {
  company_id: number;
  legal_name?: string;
  nit?: string;
  address?: string;
  city?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}