import { HourEntry } from './types';

export interface PeriodStats {
  totalHours: number;
  workingDays: number;
  avgHoursPerDay: number;
  avgHoursPerWorkingDay: number;
  totalEarnings: number;
}

export interface WeeklyStats extends PeriodStats {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

export interface TrendAnalysis {
  thisWeek: WeeklyStats;
  lastWeek: WeeklyStats;
  thisMonth: PeriodStats;
  lastMonth: PeriodStats;
  weeklyTrend: 'up' | 'down' | 'stable';
  monthlyTrend: 'up' | 'down' | 'stable';
}

// Obtener el inicio y fin de la semana (lunes a domingo)
export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Lunes como primer día
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

// Obtener el inicio y fin del mes
export function getMonthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// Filtrar entradas por rango de fechas
export function filterEntriesByDateRange(entries: HourEntry[], start: Date, end: Date): HourEntry[] {
  return entries.filter(entry => {
    const entryDate = new Date(entry.date + 'T00:00:00');
    return entryDate >= start && entryDate <= end;
  });
}

// Calcular estadísticas para un periodo
export function calculatePeriodStats(entries: HourEntry[], hourlyRate: number): PeriodStats {
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const workingDays = entries.length;
  
  // Calcular días únicos en el rango (incluyendo fines de semana)
  const dates = entries.map(e => e.date);
  const uniqueDates = new Set(dates);
  const daysInPeriod = uniqueDates.size;
  
  return {
    totalHours,
    workingDays,
    avgHoursPerDay: daysInPeriod > 0 ? totalHours / daysInPeriod : 0,
    avgHoursPerWorkingDay: workingDays > 0 ? totalHours / workingDays : 0,
    totalEarnings: totalHours * hourlyRate
  };
}

// Calcular estadísticas de una semana específica
export function calculateWeekStats(entries: HourEntry[], date: Date, hourlyRate: number): WeeklyStats {
  const { start, end } = getWeekBounds(date);
  const weekEntries = filterEntriesByDateRange(entries, start, end);
  const stats = calculatePeriodStats(weekEntries, hourlyRate);
  
  // Número de semana del año
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  
  return {
    ...stats,
    weekNumber,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

// Analizar tendencias
export function analyzeTrends(entries: HourEntry[], hourlyRate: number): TrendAnalysis {
  const now = new Date();
  const lastWeek = new Date(now);
  lastWeek.setDate(now.getDate() - 7);
  
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const thisWeekStats = calculateWeekStats(entries, now, hourlyRate);
  const lastWeekStats = calculateWeekStats(entries, lastWeek, hourlyRate);
  
  const thisMonthBounds = getMonthBounds(now);
  const thisMonthEntries = filterEntriesByDateRange(entries, thisMonthBounds.start, thisMonthBounds.end);
  const thisMonthStats = calculatePeriodStats(thisMonthEntries, hourlyRate);
  
  const lastMonthBounds = { start: lastMonth, end: lastMonthEnd };
  const lastMonthEntries = filterEntriesByDateRange(entries, lastMonthBounds.start, lastMonthBounds.end);
  const lastMonthStats = calculatePeriodStats(lastMonthEntries, hourlyRate);
  
  // Calcular tendencias
  const weeklyDiff = thisWeekStats.totalHours - lastWeekStats.totalHours;
  const monthlyDiff = thisMonthStats.totalHours - lastMonthStats.totalHours;
  
  const weeklyTrend = Math.abs(weeklyDiff) < 1 ? 'stable' : weeklyDiff > 0 ? 'up' : 'down';
  const monthlyTrend = Math.abs(monthlyDiff) < 2 ? 'stable' : monthlyDiff > 0 ? 'up' : 'down';
  
  return {
    thisWeek: thisWeekStats,
    lastWeek: lastWeekStats,
    thisMonth: thisMonthStats,
    lastMonth: lastMonthStats,
    weeklyTrend,
    monthlyTrend
  };
}

// Obtener días faltantes de la semana actual
export function getMissingDaysThisWeek(entries: HourEntry[]): string[] {
  const { start, end } = getWeekBounds(new Date());
  const entryDates = new Set(entries.map(e => e.date));
  const missingDays: string[] = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!entryDates.has(dateStr) && d <= new Date()) { // Solo días pasados y hoy
      missingDays.push(dateStr);
    }
  }
  
  return missingDays;
}

// Calcular productividad por día de la semana
export function getProductivityByWeekday(entries: HourEntry[]) {
  const weekdayStats = Array(7).fill(0).map((_, index) => ({
    weekday: index,
    totalHours: 0,
    entryCount: 0,
    avgHours: 0
  }));
  
  entries.forEach(entry => {
    const date = new Date(entry.date + 'T00:00:00');
    const weekday = date.getDay() === 0 ? 6 : date.getDay() - 1; // Convertir domingo a 6
    
    weekdayStats[weekday].totalHours += entry.hours;
    weekdayStats[weekday].entryCount += 1;
  });
  
  weekdayStats.forEach(stat => {
    stat.avgHours = stat.entryCount > 0 ? stat.totalHours / stat.entryCount : 0;
  });
  
  return weekdayStats;
}

// Formatear diferencia de horas con signo
export function formatHoursDiff(diff: number): string {
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}h`;
}

// Formatear diferencia de porcentaje
export function formatPercentageDiff(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞%' : '0%';
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
}