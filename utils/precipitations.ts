import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMonthKeyFromISO, formatDisplayDate } from './dateUtils';
import XLSX from 'xlsx-js-style';
import { Platform, Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface PrecipitationEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mm: number;
  createdAt: string;
}

const STORAGE_KEY = '@precipitations_v1';

export async function loadPrecipitations(): Promise<PrecipitationEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PrecipitationEntry[];
  } catch (error) {
    console.error('[Precipitations] load error', error);
    return [];
  }
}

export async function savePrecipitation(entry: PrecipitationEntry): Promise<void> {
  const all = await loadPrecipitations();
  all.push(entry);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function upsertPrecipitation(entry: PrecipitationEntry): Promise<void> {
  const all = await loadPrecipitations();
  const existingIndex = all.findIndex(e => e.date === entry.date);
  if (existingIndex >= 0) {
    all[existingIndex] = entry;
  } else {
    all.push(entry);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function deletePrecipitation(id: string): Promise<void> {
  const all = await loadPrecipitations();
  const filtered = all.filter(e => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getMonthlyTotals(entries: PrecipitationEntry[], year: string): number[] {
  const totals = new Array(12).fill(0);
  entries.forEach(e => {
    if (!e.date) return;
    if (!e.date.startsWith(year)) return;
    const monthKey = getMonthKeyFromISO(e.date); // YYYY-MM
    const monthIndex = parseInt(monthKey.split('-')[1], 10) - 1;
    if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
      totals[monthIndex] += e.mm;
    }
  });
  return totals;
}

export async function exportPrecipitations(entries: PrecipitationEntry[], year: string): Promise<void> {
  try {
    const MONTH_NAMES = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];

    const wb = XLSX.utils.book_new();

    // Entries sheet
    const rows = [['Fecha', 'Precipitaciones (mm)']];
    const sorted = entries.slice().sort((a,b) => a.date.localeCompare(b.date));
    sorted.forEach(r => rows.push([formatDisplayDate(r.date), r.mm]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Entradas');

    // Annual summary
    const totals = getMonthlyTotals(entries, year);
    const summaryRows = [['Mes', 'Total (mm)']];
    for (let i = 0; i < 12; i++) {
      summaryRows.push([MONTH_NAMES[i], totals[i]]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen ' + year);

    const fileName = `Precipitaciones_${year}.xlsx`;

    if (Platform.OS === 'web') {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    const wout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(new Uint8Array(wout));
    const fileUri = file.uri;
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Exportar precipitaciones' });
    } else {
      Alert.alert('Exportado', `Archivo guardado en: ${fileUri}`);
    }
  } catch (error) {
    console.error('[Precipitations] export error', error);
    Alert.alert('Error', 'No se pudo exportar el archivo.');
  }
}
