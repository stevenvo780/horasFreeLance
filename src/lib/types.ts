// Types for the hours tracking application

export interface HourEntry {
  id?: number;
  date: string; // ISO date string (YYYY-MM-DD)
  hours: number;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  id?: number;
  hourly_rate: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface EntryChange {
  date: string;
  old_value: number | null;
  new_value: number | null;
}

export interface WeekdayAverage {
  weekday: number; // 0 = Monday, 6 = Sunday
  average: number;
  total_hours: number;
  entry_count: number;
}

export interface BulkAddRequest {
  start_date: string;
  end_date: string;
  hours: number;
  weekdays?: string[];
  mode: 'set' | 'accumulate' | 'error';
  skip_existing?: boolean;
}

export interface FillAverageRequest {
  start_date: string;
  end_date: string;
  overwrite?: boolean;
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