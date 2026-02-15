import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import XLSX from 'xlsx-js-style';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
// DocumentPicker is dynamically imported in importAllData to avoid requiring
// the package at bundle time if not installed.

const TRANSACTIONS_KEY = 'inventory_transactions';
const SUGGESTIONS_KEY = 'inventory_suggestions';
const PRECIPITATIONS_KEY = '@precipitations_v1';

export async function exportAllData(): Promise<void> {
  try {
    const transactionsRaw = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    const suggestionsRaw = await AsyncStorage.getItem(SUGGESTIONS_KEY);
    const precipRaw = await AsyncStorage.getItem(PRECIPITATIONS_KEY);

    const payload = {
      exportedAt: new Date().toISOString(),
      transactions: transactionsRaw ? JSON.parse(transactionsRaw) : [],
      suggestions: suggestionsRaw ? JSON.parse(suggestionsRaw) : null,
      precipitations: precipRaw ? JSON.parse(precipRaw) : [],
    };

    const fileName = `rork_backup_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.json`;
    const content = JSON.stringify(payload, null, 2);

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'application/json' });
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

    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    await file.write(new TextEncoder().encode(content));
    const uri = file.uri;
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Backup de datos' });
    } else {
      Alert.alert('Backup creado', `Archivo guardado en: ${uri}`);
    }
  } catch (error) {
    console.error('[Backup] export error', error);
    Alert.alert('Error', 'No se pudo generar el backup.');
  }
}

export async function importAllData(): Promise<void> {
  try {
    const DocumentPickerModule = await import('expo-document-picker').catch(() => null);
    if (!DocumentPickerModule) {
      Alert.alert('Función no disponible', 'Instala el paquete expo-document-picker para poder importar backups.');
      return;
    }
    const DocumentPicker = DocumentPickerModule.default || DocumentPickerModule;
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (res.type !== 'success' || !res.uri) return;
    // read file
    let content: string;
    if (Platform.OS === 'web') {
      const resp = await fetch(res.uri);
      content = await resp.text();
    } else {
      const fs = await import('expo-file-system');
      content = await fs.readAsStringAsync(res.uri);
    }
    const data = JSON.parse(content);
    if (!data) throw new Error('Archivo inválido');

    if (data.transactions) {
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(data.transactions));
    }
    if (data.suggestions) {
      await AsyncStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(data.suggestions));
    }
    if (data.precipitations) {
      await AsyncStorage.setItem(PRECIPITATIONS_KEY, JSON.stringify(data.precipitations));
    }

    Alert.alert('Importado', 'Datos importados. Reinicie la app si no ve los cambios.');
  } catch (error) {
    console.error('[Backup] import error', error);
    Alert.alert('Error', 'No se pudo importar el archivo.');
  }
}
