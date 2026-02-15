import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Colors from '../../constants/colors';
import { parseDateParts, datePartsToISO } from '../../utils/dateUtils';
import { loadPrecipitations, upsertPrecipitation, deletePrecipitation, exportPrecipitations, PrecipitationEntry, getMonthlyTotals } from '../../utils/precipitations';
import { Trash2, Calendar, FileText } from 'lucide-react-native';

export default function PrecipitacionesScreen() {
  const today = new Date();
  const todayParts = parseDateParts(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);

  const [currentYear, setCurrentYear] = useState<number>(parseInt(todayParts.year, 10));
  const [currentMonth, setCurrentMonth] = useState<number>(parseInt(todayParts.month, 10));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [mm, setMm] = useState('');
  const [entries, setEntries] = useState<PrecipitationEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState(todayParts.year);

  useEffect(() => {
    (async () => {
      const all = await loadPrecipitations();
      setEntries(all);
    })();
  }, []);

  const onSaveForSelectedDay = async () => {
    if (selectedDay == null) return;
    const dayStr = String(selectedDay).padStart(2, '0');
    const monthStr = String(currentMonth).padStart(2, '0');
    const iso = `${currentYear}-${monthStr}-${dayStr}`;
    const val = parseFloat(mm.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      Alert.alert('Valor inválido', 'Ingrese mm válidos (número).');
      return;
    }
    const entry: PrecipitationEntry = {
      id: Date.now().toString() + Math.random().toString(36).slice(2,9),
      date: iso,
      mm: val,
      createdAt: new Date().toISOString(),
    };
    await upsertPrecipitation(entry);
    const all = await loadPrecipitations();
    setEntries(all);
    setMm('');
    setSelectedDay(null);
  };

  const onDelete = async (id: string) => {
    await deletePrecipitation(id);
    const all = await loadPrecipitations();
    setEntries(all);
  };

  const entriesForMonth = useMemo(() => {
    const monthKey = `${String(currentYear)}-${String(currentMonth).padStart(2, '0')}`;
    return entries.filter(e => e.date.startsWith(monthKey));
  }, [entries, currentYear, currentMonth]);

  const annualTotals = useMemo(() => getMonthlyTotals(entries, selectedYear), [entries, selectedYear]);

  const maxMonthly = Math.max(...annualTotals, 1);

  const onExport = async () => {
    await exportPrecipitations(entries.filter(e => e.date.startsWith(String(currentYear))), String(currentYear));
  };

  function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  const days = useMemo(() => {
    const d = daysInMonth(currentYear, currentMonth);
    return Array.from({ length: d }, (_, i) => i + 1);
  }, [currentYear, currentMonth]);

  const entriesMap = useMemo(() => {
    const map: Record<string, PrecipitationEntry> = {};
    entries.forEach(e => { map[e.date] = e; });
    return map;
  }, [entries]);

  const rainyDaysCount = entriesForMonth.filter(e => e.mm > 0).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y-1); } else setCurrentMonth(m => m-1); }} style={{ marginRight: 12 }}>
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionTitle, { fontSize: 16 }]}>{String(currentMonth).padStart(2,'0')}/{currentYear}</Text>
          <TouchableOpacity onPress={() => { if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y+1); } else setCurrentMonth(m => m+1); }} style={{ marginLeft: 12 }}>
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>{'>'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: Colors.textSecondary }}>{rainyDaysCount} días con precipitación</Text>
      </View>

      <View style={[styles.section, { padding: 12 }]}> 
        <View style={styles.calendarGrid}>
          {days.map(d => {
            const dayStr = String(d).padStart(2,'0');
            const monthStr = String(currentMonth).padStart(2,'0');
            const iso = `${currentYear}-${monthStr}-${dayStr}`;
            const entry = entriesMap[iso];
            return (
              <TouchableOpacity key={d} style={[styles.dayCell, selectedDay === d ? styles.dayCellSelected : undefined]} onPress={() => { setSelectedDay(d); setMm(entry ? String(entry.mm) : ''); }}>
                <Text style={styles.dayNumber}>{d}</Text>
                {entry ? <Text style={styles.dayMm}>{entry.mm} mm</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedDay ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Precipitaciones para {String(selectedDay).padStart(2,'0')}/{String(currentMonth).padStart(2,'0')}/{currentYear}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <TextInput value={mm} onChangeText={setMm} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} placeholder="mm" />
              <TouchableOpacity style={[styles.addButton, { marginLeft: 8 }]} onPress={onSaveForSelectedDay}>
                <Text style={styles.addButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Entradas - {String(currentMonth).padStart(2,'0')}/{currentYear}</Text>
        </View>
        {entriesForMonth.length === 0 ? (
          <Text style={styles.empty}>No hay registros para este mes.</Text>
        ) : (
          entriesForMonth.map(e => (
            <View key={e.id} style={styles.entryRow}>
              <Text style={styles.entryDate}>{e.date.split('-').reverse().join('/')}</Text>
              <Text style={styles.entryMm}>{e.mm} mm</Text>
              <TouchableOpacity onPress={() => onDelete(e.id)} style={styles.iconButton}>
                <Trash2 size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Totales año {selectedYear}</Text>
        <View style={styles.chartRow}>
          {annualTotals.map((val, idx) => (
            <View key={idx} style={styles.chartColumn}>
              <View style={[styles.bar, { height: `${(val / maxMonthly) * 100}%`, backgroundColor: Colors.primary }]} />
              <Text style={styles.chartLabel}>{String(idx+1).padStart(2,'0')}</Text>
            </View>
          ))}
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Total anual: {annualTotals.reduce((a,b)=>a+b,0)} mm</Text>
          <TouchableOpacity style={styles.exportButton} onPress={onExport}>
            <FileText size={18} color={Colors.textInverse} />
            <Text style={styles.exportText}>Exportar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  datePart: { flex: 0.8, marginRight: 8 },
  datePartLarge: { flex: 1.4 },
  label: { color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, padding: 8, borderRadius: 8, color: Colors.text },
  addButton: { marginLeft: 8, backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  addButtonText: { color: Colors.textInverse, fontWeight: '600' },
  section: { backgroundColor: Colors.surface, padding: 12, borderRadius: 10, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontWeight: '700', color: Colors.text },
  empty: { color: Colors.textSecondary, marginTop: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomColor: Colors.border, borderBottomWidth: 1 },
  entryDate: { flex: 1, color: Colors.text },
  entryMm: { width: 100, textAlign: 'right', color: Colors.text },
  iconButton: { marginLeft: 8 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 140, paddingTop: 10 },
  chartColumn: { flex: 1, alignItems: 'center' },
  bar: { width: 18, borderRadius: 4, alignSelf: 'center' },
  chartLabel: { marginTop: 6, color: Colors.textSecondary, fontSize: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  summaryText: { fontWeight: '600', color: Colors.text },
  exportButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, padding: 8, borderRadius: 8 },
  exportText: { color: Colors.textInverse, marginLeft: 8, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', padding: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.surfaceAlt, marginBottom: 8 },
  dayCellSelected: { borderWidth: 2, borderColor: Colors.primary },
  dayNumber: { color: Colors.text, fontWeight: '600' },
  dayMm: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
});
