/**
 * Utilidades para fechas en formato YYYY-MM-DD (sin timezone).
 * Evita el desfase de un día al usar new Date(dateString) en zonas con UTC negativo.
 */

/** Convierte YYYY-MM-DD a DD/MM/YYYY para mostrar (sin usar timezone). */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

/** Extrae día, mes y año de YYYY-MM-DD. */
export function parseDateParts(dateStr: string): { day: string; month: string; year: string } {
  if (!dateStr || dateStr.length < 10) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return { day: d, month: m, year: String(y) };
  }
  const [y, m, d] = dateStr.split('-');
  return {
    day: (d ?? '').padStart(2, '0'),
    month: (m ?? '').padStart(2, '0'),
    year: y ?? '',
  };
}

/** Arma YYYY-MM-DD desde partes; retorna null si no es válido. */
export function datePartsToISO(day: string, month: string, year: string): string | null {
  const d = day.replace(/\D/g, '').padStart(2, '0').slice(0, 2);
  const m = month.replace(/\D/g, '').padStart(2, '0').slice(0, 2);
  const y = year.replace(/\D/g, '').slice(0, 4);
  if (y.length !== 4 || m.length !== 2 || d.length !== 2) return null;
  const monthNum = parseInt(m, 10);
  const dayNum = parseInt(d, 10);
  const yearNum = parseInt(y, 10);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  const iso = `${y}-${m}-${d}`;
  const date = new Date(yearNum, monthNum - 1, dayNum);
  if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) return null;
  return iso;
}

/** Clave de mes desde YYYY-MM-DD (primeros 7 caracteres). */
export function getMonthKeyFromISO(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.substring(0, 7);
}

/** Ordenar por fecha YYYY-MM-DD sin crear Date (evita timezone). */
export function compareDateISO(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
