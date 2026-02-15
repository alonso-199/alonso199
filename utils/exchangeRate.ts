import AsyncStorage from '@react-native-async-storage/async-storage';

const EXCHANGE_RATE_KEY = 'bna_exchange_rate';
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

interface CachedRate {
  rate: number;
  timestamp: number;
  date: string;
}

export async function fetchBNAExchangeRate(): Promise<number> {
  return fetchBNAExchangeRateForDate(new Date().toISOString().split('T')[0]);
}

/** Obtiene la cotización del dólar oficial para una fecha YYYY-MM-DD. */
export async function fetchBNAExchangeRateForDate(dateStr: string): Promise<number> {
  try {
    const cached = await getCachedRateForDate(dateStr);
    if (cached) {
      console.log('[ExchangeRate] Using cached rate for', dateStr, ':', cached);
      return cached;
    }

    console.log('[ExchangeRate] Fetching rate for date:', dateStr);
    const rate = await fetchFromBNAForDate(dateStr);

    if (rate) {
      await cacheRateForDate(dateStr, rate);
      return rate;
    }

    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) {
      console.log('[ExchangeRate] Using fallback rate');
      return 1450;
    }
    // Si no hay cotización histórica, usar la de hoy
    console.log('[ExchangeRate] No historical rate for', dateStr, ', using current');
    return fetchBNAExchangeRateForDate(today);
  } catch (error) {
    console.error('[ExchangeRate] Error fetching rate for date:', dateStr, error);
    return 1450;
  }
}

async function fetchFromBNAForDate(dateStr: string): Promise<number | null> {
  const today = new Date().toISOString().split('T')[0];

  // Hoy: DolarAPI (solo cotización actual)
  if (dateStr === today) {
    try {
      const response = await fetch('https://dolarapi.com/v1/dolares/oficial', {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && typeof data.venta === 'number') {
        console.log('[ExchangeRate] DolarAPI (hoy):', data.venta);
        return data.venta;
      }
    } catch (error) {
      console.error('[ExchangeRate] DolarAPI error:', error);
    }
    return null;
  }

  // Fechas pasadas: intentar BCRA (cotización histórica oficial)
  try {
    const url = `https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD?fechaDesde=${dateStr}&fechaHasta=${dateStr}&limit=1`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (response.ok) {
      const json = await response.json();
      const results = json?.results;
      if (Array.isArray(results) && results.length > 0) {
        const item = results[0];
        const detalle = item?.detalle;
        if (Array.isArray(detalle)) {
          for (const d of detalle) {
            const valor = (d as any).valor ?? (d as any).valorVenta ?? (d as any).venta;
            if (typeof valor === 'number' && valor > 100) {
              console.log('[ExchangeRate] BCRA histórico', dateStr, ':', valor);
              return valor;
            }
          }
        }
        const v = (item as any).valor ?? (item as any).valorVenta;
        if (typeof v === 'number' && v > 100) {
          console.log('[ExchangeRate] BCRA histórico', dateStr, ':', v);
          return v;
        }
      }
    }
  } catch (error) {
    console.error('[ExchangeRate] BCRA error for', dateStr, error);
  }

  // Alternativa: ArgentinaDatos (array histórico; buscar la fecha exacta)
  try {
    const url = `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial?fechaDesde=${dateStr}&fechaHasta=${dateStr}&limit=5`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (response.ok) {
      const arr = await response.json();
      if (Array.isArray(arr)) {
        const found = arr.find((x: any) => x?.fecha === dateStr);
        const venta = found?.venta ?? found?.v;
        if (typeof venta === 'number' && venta > 100) {
          console.log('[ExchangeRate] ArgentinaDatos histórico', dateStr, ':', venta);
          return venta;
        }
      }
    }
  } catch (error) {
    console.error('[ExchangeRate] ArgentinaDatos error for', dateStr, error);
  }

  return null;
}

async function getCachedRateForDate(dateStr: string): Promise<number | null> {
  try {
    const key = `${EXCHANGE_RATE_KEY}_${dateStr}`;
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const cached: CachedRate = JSON.parse(stored);
    if (cached.rate < 500) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today && now - cached.timestamp >= CACHE_DURATION) return null;
    return cached.rate;
  } catch (error) {
    console.error('[ExchangeRate] Error reading cache:', error);
    return null;
  }
}

async function cacheRateForDate(dateStr: string, rate: number): Promise<void> {
  try {
    const key = `${EXCHANGE_RATE_KEY}_${dateStr}`;
    const cached: CachedRate = {
      rate,
      timestamp: Date.now(),
      date: dateStr,
    };
    await AsyncStorage.setItem(key, JSON.stringify(cached));
    console.log('[ExchangeRate] Rate cached for', dateStr, ':', rate);
  } catch (error) {
    console.error('[ExchangeRate] Error caching rate:', error);
  }
}

export function convertARStoUSD(arsAmount: number, exchangeRate: number): number {
  if (!exchangeRate || exchangeRate <= 0) return 0;
  return arsAmount / exchangeRate;
}

export function formatCurrencyWithUSD(arsAmount: number, exchangeRate?: number): string {
  const arsFormatted = arsAmount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (exchangeRate && exchangeRate > 0) {
    const usdAmount = convertARStoUSD(arsAmount, exchangeRate);
    const usdFormatted = usdAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `$${arsFormatted} (US$${usdFormatted})`;
  }

  return `$${arsFormatted}`;
}

export function formatUnitPriceWithUSD(arsAmount: number, exchangeRate?: number): string {
  const arsFormatted = arsAmount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (exchangeRate && exchangeRate > 0) {
    const usdAmount = convertARStoUSD(arsAmount, exchangeRate);
    const usdFormatted = usdAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${arsFormatted} (US${usdFormatted})`;
  }

  return `${arsFormatted}`;
}

export interface TransactionForUSD {
  totalValue: number;
  exchangeRate?: number;
}

export function calculateUSDTotalFromTransactions(transactions: TransactionForUSD[]): number {
  return transactions.reduce((sum, t) => {
    if (t.exchangeRate && t.exchangeRate > 0) {
      return sum + (t.totalValue / t.exchangeRate);
    }
    return sum;
  }, 0);
}

export function formatUSD(usdAmount: number): string {
  return `US${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function clearExchangeRateCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EXCHANGE_RATE_KEY);
    console.log('[ExchangeRate] Cache cleared');
  } catch (error) {
    console.error('[ExchangeRate] Error clearing cache:', error);
  }
}
