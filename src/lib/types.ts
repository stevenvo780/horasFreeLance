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