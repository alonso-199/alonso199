import XLSX from 'xlsx-js-style';
import { Platform, Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Transaction, MonthlySummary } from '../types/transaction';
import { formatDisplayDate, getMonthKeyFromISO } from './dateUtils';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function formatMonthName(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

export function formatCurrency(value: number, exchangeRate?: number): string {
  const arsFormatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);

  if (exchangeRate && exchangeRate > 0) {
    const usdValue = value / exchangeRate;
    const usdFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(usdValue);
    return `${arsFormatted} (${usdFormatted})`;
  }

  return arsFormatted;
}

export function formatDate(dateStr: string): string {
  return formatDisplayDate(dateStr);
}

function formatNumberAR(value: number, decimals: number = 2): string {
  const isWholeNumber = Number.isInteger(value);
  const actualDecimals = isWholeNumber ? 0 : decimals;
  const parts = value.toFixed(actualDecimals).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (isWholeNumber || actualDecimals === 0) {
    return integerPart;
  }
  const decimalPart = parts[1];
  return `${integerPart},${decimalPart}`;
}

const borderStyle = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
};

const headerStyle = {
  font: { bold: true, color: { rgb: '000000' } },
  fill: { fgColor: { rgb: 'E0E0E0' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: borderStyle,
};

const ventaRowStyle = {
  fill: { fgColor: { rgb: 'C8E6C9' } },
};

const compraRowStyle = {
  fill: { fgColor: { rgb: 'FFCDD2' } },
};

function getMonthKey(dateStr: string): string {
  return getMonthKeyFromISO(dateStr);
}

function getDayKey(dateStr: string): string {
  return formatDisplayDate(dateStr);
}

function groupTransactionsByMonth(transactions: Transaction[]): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();
  
  transactions.forEach(t => {
    const monthKey = getMonthKey(t.date);
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(t);
  });

  const sortedKeys = Array.from(grouped.keys()).sort();
  const sortedMap = new Map<string, Transaction[]>();
  sortedKeys.forEach(key => {
    sortedMap.set(key, grouped.get(key)!);
  });

  return sortedMap;
}

function calculateMonthlySummary(transactions: Transaction[]): MonthlySummary & { avgExchangeRate: number } {
  let totalEntradas = 0;
  let totalSalidas = 0;
  let exchangeRateSum = 0;
  let exchangeRateCount = 0;

  transactions.forEach(t => {
    if (t.type === 'entrada') {
      totalEntradas += t.totalValue;
    } else {
      totalSalidas += t.totalValue;
    }
    if (t.exchangeRate && t.exchangeRate > 0) {
      exchangeRateSum += t.exchangeRate;
      exchangeRateCount++;
    }
  });

  const avgExchangeRate = exchangeRateCount > 0 ? exchangeRateSum / exchangeRateCount : 0;

  return {
    month: '',
    year: new Date().getFullYear(),
    totalEntradas,
    totalSalidas,
    margenBruto: totalSalidas - totalEntradas,
    transactionCount: transactions.length,
    avgExchangeRate,
  };
}

function getDailyAggregates(transactions: Transaction[]): { day: string; ventas: number; compras: number }[] {
  const dailyMap = new Map<string, { ventas: number; compras: number }>();

  transactions.forEach(t => {
    const dayKey = getDayKey(t.date);
    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { ventas: 0, compras: 0 });
    }
    const daily = dailyMap.get(dayKey)!;
    if (t.type === 'entrada') {
      daily.compras += t.totalValue;
    } else {
      daily.ventas += t.totalValue;
    }
  });

  const result: { day: string; ventas: number; compras: number }[] = [];
  dailyMap.forEach((value, key) => {
    result.push({ day: key, ventas: value.ventas, compras: value.compras });
  });

  result.sort((a, b) => {
    const [dayA, monthA, yearA] = a.day.split('/').map(Number);
    const [dayB, monthB, yearB] = b.day.split('/').map(Number);
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateA.getTime() - dateB.getTime();
  });

  return result;
}

function createTransactionSheet(transactions: Transaction[]): XLSX.WorkSheet {
  const headers = [
    'Fecha', 'Tipo', 'Producto', 'Cantidad', 'Precio Unitario (ARS)', 
    'Precio Unitario (USD)', 'Valor Total (ARS)', 'Valor Total (USD)', 
    'Cotización USD', 'Notas'
  ];

  const numericColumns = [3, 4, 5, 6, 7, 8];

  const wsData: any[][] = [headers];
  
  transactions.forEach(t => {
    const unitPriceUSD = t.exchangeRate && t.unitPrice ? t.unitPrice / t.exchangeRate : 0;
    const totalUSD = t.exchangeRate ? t.totalValue / t.exchangeRate : 0;
    
    wsData.push([
      formatDate(t.date),
      t.type === 'entrada' ? 'COMPRA' : 'VENTA',
      t.productName,
      formatNumberAR(t.quantity, 0),
      formatNumberAR(t.unitPrice ?? 0, 2),
      t.exchangeRate && t.unitPrice ? formatNumberAR(unitPriceUSD, 2) : '-',
      formatNumberAR(t.totalValue, 2),
      t.exchangeRate ? formatNumberAR(totalUSD, 2) : '-',
      t.exchangeRate ? formatNumberAR(t.exchangeRate, 2) : '-',
      t.notes || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = [12, 10, 25, 12, 20, 20, 20, 20, 16, 25];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  for (let col = 0; col < headers.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[cellRef]) {
      ws[cellRef].s = { ...headerStyle };
    }
  }

  for (let row = 1; row < wsData.length; row++) {
    const transactionType = wsData[row][1];
    const isCompra = transactionType === 'COMPRA';
    const rowColor = isCompra ? compraRowStyle : ventaRowStyle;

    for (let col = 0; col < headers.length; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellRef]) {
        const isNumeric = numericColumns.includes(col);
        const isFirstColumn = col === 0;
        
        ws[cellRef].s = {
          ...rowColor,
          alignment: isNumeric ? { horizontal: 'right', vertical: 'center' } : { horizontal: 'center', vertical: 'center' },
          border: isFirstColumn ? borderStyle : undefined,
        };
      }
    }
  }

  return ws;
}

function createSummarySheet(
  summary: MonthlySummary & { avgExchangeRate: number },
  dailyData: { day: string; ventas: number; compras: number }[]
): XLSX.WorkSheet {
  const avgRate = summary.avgExchangeRate || 1;
  const isMarginPositive = summary.margenBruto >= 0;

  const summaryData: any[][] = [
    ['RESUMEN MENSUAL', '', '', ''],
    ['', '', '', ''],
    ['Concepto', 'Valor (ARS)', 'Valor (USD)', ''],
    ['Total Compras', formatNumberAR(summary.totalEntradas, 2), formatNumberAR(summary.totalEntradas / avgRate, 2), ''],
    ['Total Ventas', formatNumberAR(summary.totalSalidas, 2), formatNumberAR(summary.totalSalidas / avgRate, 2), ''],
    ['MARGEN BRUTO', formatNumberAR(summary.margenBruto, 2), formatNumberAR(summary.margenBruto / avgRate, 2), ''],
    ['Cantidad de Transacciones', summary.transactionCount.toString(), '', ''],
    ['Cotización USD Promedio', formatNumberAR(avgRate, 2), '', ''],
    ['', '', '', ''],
    ['', '', '', ''],
    ['DATOS PARA GRÁFICO (ARS)', '', '', ''],
    ['Día', 'Ventas (ARS)', 'Compras (ARS)', ''],
  ];

  dailyData.forEach(d => {
    summaryData.push([
      d.day,
      formatNumberAR(d.ventas, 2),
      formatNumberAR(d.compras, 2),
      '',
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 5 }];

  const titleCellRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (wsSummary[titleCellRef]) {
    wsSummary[titleCellRef].s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  for (let col = 0; col < 3; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: col });
    if (wsSummary[cellRef]) {
      wsSummary[cellRef].s = { ...headerStyle };
    }
  }

  const comprasRowColor = { fgColor: { rgb: 'FFCDD2' } };
  const ventasRowColor = { fgColor: { rgb: 'C8E6C9' } };
  const marginRowColor = isMarginPositive ? { fgColor: { rgb: 'C8E6C9' } } : { fgColor: { rgb: 'FFCDD2' } };

  for (let col = 0; col < 3; col++) {
    const cellRefCompras = XLSX.utils.encode_cell({ r: 3, c: col });
    const cellRefVentas = XLSX.utils.encode_cell({ r: 4, c: col });
    const cellRefMargen = XLSX.utils.encode_cell({ r: 5, c: col });
    
    if (wsSummary[cellRefCompras]) {
      wsSummary[cellRefCompras].s = {
        fill: comprasRowColor,
        alignment: col === 0 ? { horizontal: 'center', vertical: 'center' } : { horizontal: 'right', vertical: 'center' },
        border: col === 0 ? borderStyle : undefined,
      };
    }
    if (wsSummary[cellRefVentas]) {
      wsSummary[cellRefVentas].s = {
        fill: ventasRowColor,
        alignment: col === 0 ? { horizontal: 'center', vertical: 'center' } : { horizontal: 'right', vertical: 'center' },
        border: col === 0 ? borderStyle : undefined,
      };
    }
    if (wsSummary[cellRefMargen]) {
      wsSummary[cellRefMargen].s = {
        fill: marginRowColor,
        font: { bold: true },
        alignment: col === 0 ? { horizontal: 'center', vertical: 'center' } : { horizontal: 'right', vertical: 'center' },
        border: col === 0 ? borderStyle : undefined,
      };
    }
  }

  for (let row = 6; row <= 7; row++) {
    const cellRefA = XLSX.utils.encode_cell({ r: row, c: 0 });
    const cellRefB = XLSX.utils.encode_cell({ r: row, c: 1 });
    
    if (wsSummary[cellRefA]) {
      wsSummary[cellRefA].s = {
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderStyle,
      };
    }
    if (wsSummary[cellRefB]) {
      wsSummary[cellRefB].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
      };
    }
  }

  const chartTitleRef = XLSX.utils.encode_cell({ r: 10, c: 0 });
  if (wsSummary[chartTitleRef]) {
    wsSummary[chartTitleRef].s = {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  for (let col = 0; col < 3; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 11, c: col });
    if (wsSummary[cellRef]) {
      const isVentas = col === 1;
      const isCompras = col === 2;
      wsSummary[cellRef].s = {
        ...headerStyle,
        fill: isVentas ? { fgColor: { rgb: '4CAF50' } } : isCompras ? { fgColor: { rgb: 'F44336' } } : { fgColor: { rgb: 'E0E0E0' } },
        font: { bold: true, color: { rgb: isVentas || isCompras ? 'FFFFFF' : '000000' } },
      };
    }
  }

  for (let row = 12; row < summaryData.length; row++) {
    const cellRefA = XLSX.utils.encode_cell({ r: row, c: 0 });
    const cellRefB = XLSX.utils.encode_cell({ r: row, c: 1 });
    const cellRefC = XLSX.utils.encode_cell({ r: row, c: 2 });
    
    if (wsSummary[cellRefA]) {
      wsSummary[cellRefA].s = {
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderStyle,
      };
    }
    if (wsSummary[cellRefB]) {
      wsSummary[cellRefB].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: 'C8E6C9' } },
      };
    }
    if (wsSummary[cellRefC]) {
      wsSummary[cellRefC].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: 'FFCDD2' } },
      };
    }
  }

  return wsSummary;
}

function createMonthlyMarginChartSheet(
  monthlyMargins: { month: string; margenBruto: number }[]
): XLSX.WorkSheet {
  const chartData: any[][] = [
    ['MÁRGENES BRUTOS MENSUALES (ARS)', '', ''],
    ['', '', ''],
    ['Mes', 'Margen Bruto (ARS)', 'Estado'],
  ];

  monthlyMargins.forEach(m => {
    const isPositive = m.margenBruto >= 0;
    chartData.push([
      m.month,
      formatNumberAR(m.margenBruto, 2),
      isPositive ? 'POSITIVO' : 'NEGATIVO',
    ]);
  });

  const wsChart = XLSX.utils.aoa_to_sheet(chartData);
  
  wsChart['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }];

  const titleCellRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (wsChart[titleCellRef]) {
    wsChart[titleCellRef].s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  for (let col = 0; col < 3; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: col });
    if (wsChart[cellRef]) {
      wsChart[cellRef].s = { ...headerStyle };
    }
  }

  for (let row = 3; row < chartData.length; row++) {
    const margenValue = monthlyMargins[row - 3]?.margenBruto ?? 0;
    const isPositive = margenValue >= 0;
    const rowFill = isPositive ? { fgColor: { rgb: 'C8E6C9' } } : { fgColor: { rgb: 'FFCDD2' } };

    for (let col = 0; col < 3; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (wsChart[cellRef]) {
        wsChart[cellRef].s = {
          fill: rowFill,
          alignment: col === 1 ? { horizontal: 'right', vertical: 'center' } : { horizontal: 'center', vertical: 'center' },
          border: col === 0 ? borderStyle : undefined,
          font: col === 2 ? { bold: true, color: { rgb: isPositive ? '2E7D32' : 'C62828' } } : undefined,
        };
      }
    }
  }

  return wsChart;
}

export async function exportToExcel(
  transactions: Transaction[],
  summary: MonthlySummary,
  monthStr: string
): Promise<void> {
  console.log('[ExcelExport] Starting export for', monthStr);
  
  const wb = XLSX.utils.book_new();

  const groupedByMonth = groupTransactionsByMonth(transactions);
  const monthlyMargins: { month: string; margenBruto: number }[] = [];

  groupedByMonth.forEach((monthTransactions, monthKey) => {
    const monthName = formatMonthName(monthKey);
    
    const wsTransactions = createTransactionSheet(monthTransactions);
    XLSX.utils.book_append_sheet(wb, wsTransactions, `Trans ${monthName.substring(0, 3)} ${monthKey.split('-')[0].slice(-2)}`);

    const monthlySummary = calculateMonthlySummary(monthTransactions);
    const dailyData = getDailyAggregates(monthTransactions);
    const wsSummary = createSummarySheet(monthlySummary, dailyData);
    XLSX.utils.book_append_sheet(wb, wsSummary, `Res ${monthName.substring(0, 3)} ${monthKey.split('-')[0].slice(-2)}`);

    monthlyMargins.push({
      month: monthName,
      margenBruto: monthlySummary.margenBruto,
    });
  });

  if (monthlyMargins.length > 0) {
    const wsMarginChart = createMonthlyMarginChartSheet(monthlyMargins);
    XLSX.utils.book_append_sheet(wb, wsMarginChart, 'Márgenes Mensuales');
  }

  if (groupedByMonth.size === 0) {
    const wsEmpty = XLSX.utils.aoa_to_sheet([['Sin transacciones']]);
    XLSX.utils.book_append_sheet(wb, wsEmpty, 'Sin datos');
  }

  const fileName = `Inventario_${formatMonthName(monthStr).replace(' ', '_')}.xlsx`;
  
  if (Platform.OS === 'web') {
    try {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[ExcelExport] Web download initiated');
    } catch (webError) {
      console.error('[ExcelExport] Web export error:', webError);
      Alert.alert('Error', 'No se pudo exportar el archivo en web.');
    }
  } else {
    try {
      const wout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const file = new File(Paths.cache, fileName);
      file.create({ overwrite: true });
      file.write(new Uint8Array(wout));
      const fileUri = file.uri;
      
      console.log('[ExcelExport] File saved to', fileUri);
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Exportar planilla de inventario',
        });
      } else {
        Alert.alert('Éxito', `Archivo guardado en: ${fileUri}`);
      }
    } catch (error) {
      console.error('[ExcelExport] Native export error:', error);
      Alert.alert('Error', 'No se pudo exportar el archivo. ' + (error instanceof Error ? error.message : ''));
    }
  }
}
