/**
 * Formatea un número con puntos de miles para Colombia
 * Ejemplo: 1234567.89 -> "1.234.567,89"
 */
export function formatColombiaCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea un número con puntos de miles y decimales para Colombia
 * Ejemplo: 1234567.89 -> "1.234.567,89"
 */
export function formatColombiaNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formatea un precio en pesos colombianos con símbolo personalizado
 * Ejemplo: 1234567 -> "$1.234.567"
 */
export function formatPrice(amount: number, showDecimals: boolean = false): string {
  const decimals = showDecimals ? 2 : 0;
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  
  return `$${formatted}`;
}

/**
 * Formatea horas con decimales para Colombia
 * Ejemplo: 8.5 -> "8,5"
 */
export function formatHours(hours: number): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(hours);
}